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
  history: { canUndo: boolean; canRedo: boolean };
};

export type PaletteEntry = { group: string; templates: { id: string; version: string }[] };

export type TemplateCatalog = { templates: TemplateDescription[]; palette: PaletteEntry[] };

/** Outcome of `POST /projects/:id/operations`. */
export type EditResult =
  | { ok: true; state: DesignState }
  | { ok: false; reason: "conflict"; message: string; state: DesignState }
  | { ok: false; reason: "invalid"; message: string; errors: Finding[] };

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

  async edit(id: string, baseRevision: number, ops: OperationInput[]): Promise<EditResult> {
    const res = await fetch(`/api/projects/${id}/operations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseRevision, ops, source: "canvas" }),
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
  },
};
