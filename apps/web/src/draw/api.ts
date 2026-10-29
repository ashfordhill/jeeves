/**
 * Thin client for the design API (S3). Routes live under /api, which the Vite proxy strips.
 * Response shapes mirror apps/server/src/routes/*.ts.
 */
import type { TemplateDescription } from "@jeeves/registry";
import type { DesignDocument, Finding, LayoutDocument, OperationInput } from "@jeeves/spec";

export type Project = { id: string; name: string; revision: number; updatedAt: string };

export type DesignState = {
  projectId: string;
  design: DesignDocument;
  findings: Finding[];
  /** `latestEdit` is the operation ID the next undo reverts, if any. */
  history: { canUndo: boolean; canRedo: boolean; latestEdit: number | null };
};

export type PaletteEntry = { group: string; templates: { id: string; version: string }[] };

export type TemplateCatalog = { templates: TemplateDescription[]; palette: PaletteEntry[] };

/** Outcome of `POST /projects/:id/operations`, `/undo`, or `/redo`. */
export type EditResult =
  | { ok: true; state: DesignState }
  | { ok: false; reason: "conflict"; message: string; state: DesignState }
  | { ok: false; reason: "invalid"; message: string; errors: Finding[] };

export type FileInfo = { id: string; name: string; mediaType: string; size: number };

export type ChatQuestion = { question: string; choices: string[]; allowFreeText: boolean };
export type ChatActivity = { tool: string; ok: boolean; summary: string };

/** One chat turn, as `apps/server/src/chat/service.ts` returns it. */
export type ChatTurn = {
  id: number;
  message: string;
  files: FileInfo[];
  selection: string[];
  status: "running" | "done" | "failed";
  reply: string;
  question: ChatQuestion | null;
  operationId: number | null;
  changed: string[];
  activity: ChatActivity[];
  usage: { inputTokens: number; outputTokens: number; known: boolean } | null;
  model: string | null;
  error: string | null;
  createdAt: string;
};

/** Streamed by `POST /projects/:id/chat`, one JSON object per line. */
export type ChatEvent =
  | { type: "turn"; turn: ChatTurn }
  | { type: "text"; delta: string }
  | { type: "activity"; activity: ChatActivity }
  | { type: "done"; turn: ChatTurn; state: DesignState; layout: LayoutDocument };

export type ModelRole = "designChat" | "planner" | "coding";

export type SettingsView = {
  configPath: string;
  providers: {
    id: string;
    name: string;
    configured: boolean;
    source: "env" | "file" | null;
    envVar: string;
  }[];
  models: Record<ModelRole, string>;
  fakeModel: boolean;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export const api = {
  listProjects: () => request<{ projects: Project[] }>("/projects").then((r) => r.projects),

  createProject: (name: string) =>
    request<{ project: Project }>("/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }).then((r) => r.project),

  getProject: (id: string) =>
    request<{ project: Project }>(`/projects/${id}`).then((r) => r.project),

  getDesign: (id: string) => request<DesignState>(`/projects/${id}/design`),

  getLayout: (id: string) =>
    request<{ layout: LayoutDocument }>(`/projects/${id}/layout`).then((r) => r.layout),

  putLayout: (id: string, layout: LayoutDocument) =>
    request<{ layout: LayoutDocument }>(`/projects/${id}/layout`, {
      method: "PUT",
      body: JSON.stringify(layout),
    }),

  templates: () => request<TemplateCatalog>("/templates"),

  edit: (id: string, baseRevision: number, ops: OperationInput[]) =>
    change(`/projects/${id}/operations`, { baseRevision, ops, source: "canvas" }),

  undo: (id: string, baseRevision: number) =>
    change(`/projects/${id}/undo`, { baseRevision, source: "canvas" }),

  redo: (id: string, baseRevision: number) =>
    change(`/projects/${id}/redo`, { baseRevision, source: "canvas" }),

  chatTurns: (id: string) =>
    request<{ turns: ChatTurn[] }>(`/projects/${id}/chat`).then((r) => r.turns),

  /** Sends a chat message; `onEvent` gets each streamed event, ending with `done`. */
  chat: async (
    id: string,
    body: { message: string; fileIds: string[]; selection: string[] },
    onEvent: (event: ChatEvent) => void,
  ) => {
    const res = await fetch(`/api/projects/${id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      const error = (await res.json().catch(() => ({}))) as { message?: string };
      throw new ApiError(res.status, error.message ?? `${res.status} ${res.statusText}`);
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buffer += value;
      const lines = buffer.split("\n");
      buffer = done ? "" : (lines.pop() ?? "");
      for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as ChatEvent);
      if (done) break;
    }
  },

  uploadFile: (id: string, file: File, mediaType: string) =>
    fetch(`/api/projects/${id}/files`, {
      method: "POST",
      headers: { "content-type": mediaType, "x-file-name": encodeURIComponent(file.name) },
      body: file,
    }).then(async (res) => {
      const body = (await res.json().catch(() => ({}))) as { file?: FileInfo; message?: string };
      if (!res.ok || !body.file) throw new ApiError(res.status, body.message ?? res.statusText);
      return body.file;
    }),

  fileUrl: (id: string, fileId: string) => `/api/projects/${id}/files/${fileId}`,

  settings: () => request<SettingsView>("/settings"),

  setModels: (models: Partial<Record<ModelRole, string>>) =>
    request<SettingsView>("/settings/models", { method: "PUT", body: JSON.stringify(models) }),
};

/** Posts a design change (operations, undo, or redo) and sorts the answer into an EditResult. */
async function change(path: string, payload: unknown): Promise<EditResult> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<DesignState> & {
    message?: string;
    errors?: Finding[];
  };
  if (res.ok) return { ok: true, state: body as DesignState };
  const message = body.message ?? `${res.status} ${res.statusText}`;
  if (res.status === 409)
    return { ok: false, reason: "conflict", message, state: body as DesignState };
  if (res.status === 422)
    return { ok: false, reason: "invalid", message, errors: body.errors ?? [] };
  throw new ApiError(res.status, message);
}
