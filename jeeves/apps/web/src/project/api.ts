/**
 * Thin client for the design API. Routes live under /api, which the Vite proxy strips.
 * Response shapes mirror apps/server/src/routes/*.ts.
 */
import type {
  DesignDocument,
  Finding,
  GenerationInstalledSupport,
  OperationInput,
  Rekey,
} from "@jeeves/spec";

export type Project = {
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
};

export type DesignState = {
  projectId: string;
  design: DesignDocument;
  findings: Finding[];
  /** `latestEdit` is the operation ID the next undo reverts, if any. */
  history: { canUndo: boolean; canRedo: boolean; latestEdit: number | null };
  /** The tile and module IDs a change re-keyed (IDs follow names), in order; absent when none. */
  renamed?: Rekey[];
};

/** Outcome of `POST /projects/:id/operations`, `/undo`, or `/redo`. */
export type EditResult =
  | { ok: true; state: DesignState }
  | { ok: false; reason: "conflict"; message: string; state: DesignState }
  | { ok: false; reason: "invalid"; message: string; errors: Finding[] };

export type FileInfo = { id: string; name: string; mediaType: string; size: number };

export type ChatQuestion = {
  question: string;
  choices: string[];
  allowFreeText: boolean;
};
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
  usage: {
    inputTokens: number;
    outputTokens: number;
    known: boolean;
    cachedInputTokens?: number;
    costUsd?: number;
  } | null;
  model: string | null;
  error: string | null;
  createdAt: string;
};

/** Streamed by `POST /projects/:id/chat`, one JSON object per line. */
export type ChatEvent =
  | { type: "turn"; turn: ChatTurn }
  | { type: "text"; delta: string }
  | { type: "activity"; activity: ChatActivity }
  | { type: "done"; turn: ChatTurn; state: DesignState | null };

export type ModelRole = "designChat";

export type ProviderId = "openai" | "codex" | "anthropic" | "custom";

export type ProviderAuth =
  | { type: "api-key"; envVar: string; configKey: string }
  | { type: "cli-login"; command: string }
  /** The custom endpoint: a name, a base URL and a key, saved together. */
  | { type: "endpoint" };

export type ProviderStatus = {
  id: ProviderId;
  name: string;
  description: string;
  auth: ProviderAuth;
  suggestedModels: string[];
  /** An empty model name means the provider's own default. */
  defaultModelAllowed: boolean;
  ready: boolean;
  status: string;
  help: string | null;
  /** Where its API key comes from: the environment, the config file, or none. */
  keySource: "env" | "file" | null;
};

export type RoleModel = {
  provider: ProviderId;
  model: string;
};

/** Settings' Sign in with ChatGPT: the server's `codex login`. */
export type CodexLoginState =
  | { state: "idle" }
  /** `url` is the sign-in page Codex printed, once it has. */
  | { state: "waiting"; url?: string }
  /** `message` is the login's last output line. */
  | { state: "failed"; message: string };

/** What Settings saves for the custom endpoint. The key goes in and never comes back. */
export type CustomEndpointInput = { name: string; baseUrl: string; apiKey: string };

/** One model in the chat's picker; numbers are `null` when models.dev doesn't know them. */
export type ModelOption = {
  id: string;
  name: string;
  /** Tokens. */
  contextWindow: number | null;
  /** US dollars per million input and output tokens. */
  inputPrice: number | null;
  outputPrice: number | null;
};

/** One provider's section in the picker. */
export type ProviderModels = {
  id: ProviderId;
  name: string;
  ready: boolean;
  status: string;
  models: ModelOption[];
};

/** `GET /models`, as `apps/server/src/model-catalog.ts` builds it. */
export type ModelsView = { selected: RoleModel; providers: ProviderModels[] };

/** A host the custom endpoint's card can fill in (a models.dev provider with a base URL). */
export type KnownHost = { id: string; name: string; baseUrl: string };

export type SettingsView = {
  configPath: string;
  providers: ProviderStatus[];
  /** The custom endpoint's name and base URL, or `null` when it isn't set up. */
  custom: { name: string; baseUrl: string } | null;
  roles: Record<ModelRole, RoleModel>;
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
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  generationSupport: () => request<GenerationInstalledSupport>("/generation-support"),
  listProjects: () => request<{ projects: Project[] }>("/projects").then((r) => r.projects),

  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" }),
  renameProject: (id: string, name: string) =>
    request<{ project: Project }>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }).then((r) => r.project),

  createProject: (name: string) =>
    request<{ project: Project }>("/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }).then((r) => r.project),

  getProject: (id: string) =>
    request<{ project: Project }>(`/projects/${id}`).then((r) => r.project),

  getDesign: (id: string, signal?: AbortSignal) =>
    request<DesignState>(`/projects/${id}/design`, { signal }),

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
    body: {
      message: string;
      fileIds: string[];
      selection: string[];
      baseRevision: number;
    },
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
    await readLines(res.body, (line) => onEvent(JSON.parse(line) as ChatEvent));
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

  /** The design chat's model and every provider's models, for the chat's model picker. */
  models: () => request<ModelsView>("/models"),

  knownHosts: () => request<{ hosts: KnownHost[] }>("/models/hosts").then((r) => r.hosts),

  setRoles: (roles: Partial<Record<ModelRole, RoleModel>>) =>
    request<SettingsView>("/settings/roles", { method: "PUT", body: JSON.stringify(roles) }),

  /** Saves or replaces a provider's API key. The answer never holds a key. */
  setKey: (id: ProviderId, key: string) =>
    request<SettingsView>(`/settings/providers/${id}/key`, {
      method: "PUT",
      body: JSON.stringify({ key }),
    }),

  removeKey: (id: ProviderId) =>
    request<SettingsView>(`/settings/providers/${id}/key`, { method: "DELETE" }),

  /** Saves or replaces the custom endpoint (all three at once). The answer never holds the key. */
  setCustomEndpoint: (endpoint: CustomEndpointInput) =>
    request<SettingsView>("/settings/custom", { method: "PUT", body: JSON.stringify(endpoint) }),

  removeCustomEndpoint: () => request<SettingsView>("/settings/custom", { method: "DELETE" }),

  /** Starts `codex login` on the server (or answers with the one running). */
  codexSignIn: () => request<CodexLoginState>("/settings/codex/login", { method: "POST" }),

  codexSignInState: () => request<CodexLoginState>("/settings/codex/login"),

  codexSignOut: () => request<SettingsView>("/settings/codex/logout", { method: "POST" }),
};

/** Calls `onLine` for each non-empty line of a newline-delimited stream. */
async function readLines(body: NonNullable<Response["body"]>, onLine: (line: string) => void) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) if (line.trim()) onLine(line);
    if (done) break;
  }
}

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
