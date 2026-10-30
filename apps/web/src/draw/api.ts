/**
 * Thin client for the design API (S3). Routes live under /api, which the Vite proxy strips.
 * Response shapes mirror apps/server/src/routes/*.ts.
 */
import type { TemplateDescription } from "@jeeves/registry";
import type {
  DesignDocument,
  Finding,
  LayoutDocument,
  OperationInput,
  SubtypeReview,
} from "@jeeves/spec";

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

export type ChatQuestion = {
  question: string;
  choices: string[];
  allowFreeText: boolean;
  subtypeReview?: SubtypeReview;
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

export type ProviderId = "openai" | "codex" | "local";

export type ProviderStatus = {
  id: ProviderId;
  name: string;
  description: string;
  kinds: ("model" | "coding")[];
  /** `false` for a provider that is listed but not built yet. */
  available: boolean;
  suggestedModels: string[];
  /** An empty model name means the provider's own default. */
  defaultModelAllowed: boolean;
  ready: boolean;
  status: string;
  help: string | null;
};

export type RoleModel = { provider: ProviderId; model: string };

export type SettingsView = {
  configPath: string;
  providers: ProviderStatus[];
  roles: Record<ModelRole, RoleModel>;
  fakeModel: boolean;
};

export type GenerationStepId =
  | "generate"
  | "install"
  | "typecheck"
  | "compose-up"
  | "test-packs"
  | "behavior"
  | "compose-down";

export type GenerationStep = {
  id: GenerationStepId;
  title: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  durationMs?: number;
  message?: string;
};

export type GenerationCheck = {
  subject: string;
  template: string;
  id: string;
  title: string;
  status: "passed" | "failed" | "skipped";
  reason?: string;
  layer?: "infrastructure" | "template" | "application";
  acceptanceIds?: string[];
  durationMs: number;
  error?: string;
};

export type GenerationLogLine = { step: GenerationStepId; line: string };

/** One Generate run, as `apps/server/src/generate/service.ts` returns it. */
export type Generation = {
  id: number;
  projectId: string;
  revision: number;
  outputDir: string;
  baseline: boolean;
  status: "running" | "succeeded" | "failed" | "blocked" | "cancelled" | "interrupted";
  steps: GenerationStep[];
  checks: GenerationCheck[];
  log: GenerationLogLine[];
  report: {
    written: string[];
    scaffolded: string[];
    kept: string[];
    packages: string[];
    vendored: string[];
    removedElements: { id: string; dir: string }[];
    orphaned: string[];
    git: "initialized" | "existing" | "disabled";
    problems: { path: string; kind: "edited" | "unmanaged"; message: string }[];
  } | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type GenerationOverview = {
  outputDir: string | null;
  defaultOutputDir: string;
  latest: Generation | null;
};

/** Streamed by `GET /projects/:id/generations/:generationId/events`, one JSON object per line. */
export type GenerationEvent =
  | { type: "snapshot"; generation: Generation }
  | { type: "step"; step: GenerationStep }
  | { type: "log"; line: GenerationLogLine }
  | { type: "check"; check: GenerationCheck }
  | { type: "done"; generation: Generation };

export type RunStatus =
  | "planning"
  | "planned"
  | "running"
  | "paused"
  | "needs-attention"
  | "waiting_for_provider"
  | "cancelled"
  | "failed"
  | "succeeded";
export type RunAction = "start" | "pause" | "resume" | "cancel" | "replan";
export type Usage = { inputTokens: number; outputTokens: number; known: boolean; costUsd?: number };
export type UsageTotals = Usage & {
  records: number;
  tokenRecords: number;
  costRecords: number;
  knownCostUsd: number;
};
export type ExecutionMode = "continuous" | "review-after-task";
export type UsageEntry = {
  id: number;
  taskId: number | null;
  taskKey: string | null;
  attemptId: number | null;
  kind: "planning" | "coding" | "legacy";
  status: string;
  provider: string | null;
  model: string | null;
  request: Record<string, unknown> | null;
  usage: Usage | null;
  startedAt: string;
  finishedAt: string | null;
};
export type GitStrategy = "direct" | "branch-per-task";
export type RunSettings = { gitStrategy: GitStrategy; maxRetries: number };

/** One orchestration run, as `apps/server/src/runs/service.ts` returns it. */
export type Run = {
  id: number;
  projectId: string;
  status: RunStatus;
  statusReason: string | null;
  executionMode: ExecutionMode;
  kind: "initial-build" | "feature" | null;
  parentRunId: number | null;
  evidence: {
    designHash: string;
    templates: string[];
    startingCommit: string | null;
    coding: { provider: string; model: string } | null;
  } | null;
  interventions: { at: string; action: string; note: string; taskId?: number }[];
  outputDir: string;
  designRevision: number | null;
  planner: {
    mode: "refined" | "seed";
    model: string | null;
    message: string | null;
    usage: Usage | null;
  } | null;
  warnings: string[];
  gitStrategy: GitStrategy;
  maxRetries: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type RunSummary = Run & { taskCount: number; doneCount: number };

export type CheckStatus = "running" | "passed" | "failed" | "skipped";

export type AttemptChecks = {
  ok: boolean;
  rejectedPaths: string[];
  steps: {
    step: string;
    title: string;
    status: CheckStatus;
    durationMs: number;
    message?: string;
  }[];
  checks: {
    subject: string;
    id: string;
    title: string;
    status: "passed" | "failed" | "skipped";
    reason?: string;
    layer?: "infrastructure" | "template" | "application";
    acceptanceIds?: string[];
    durationMs: number;
    error?: string;
  }[];
};

export type FileChange = { path: string; status: "added" | "modified" | "deleted" | "renamed" };

export type Attempt = {
  id: number;
  number: number;
  status: "running" | "succeeded" | "failed" | "interrupted" | "cancelled";
  summary: string | null;
  usage: Usage | null;
  error: string | null;
  sessionId: string | null;
  checks: AttemptChecks | null;
  changes: FileChange[] | null;
  commit: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type AttemptEvent = {
  t: number;
  kind:
    | "message"
    | "reasoning"
    | "command"
    | "files"
    | "todo"
    | "warning"
    | "step"
    | "check"
    | "log"
    | "git";
  text: string;
  status?: CheckStatus;
};

/** One attempt with its live log and diff (`GET …/attempts/:attemptId`). */
export type AttemptDetail = Attempt & {
  events: AttemptEvent[];
  diff: string | null;
  feedback: string | null;
};

export type RunTask = {
  id: number;
  position: number;
  key: string;
  element: string;
  attachment: string | null;
  title: string;
  description: string;
  acceptance: string[];
  ownedPaths: string[];
  dependsOn: string[];
  source: "seed" | "planner";
  edited: boolean;
  status: "pending" | "running" | "done" | "needs-attention" | "cancelled";
  workspace: { runBranch: string; branch: string; baseCommit: string } | null;
  commit: string | null;
  attempts: Attempt[];
};

export type RunDetail = {
  run: Run;
  tasks: RunTask[];
  actions: RunAction[];
  editable: boolean;
  orderProblems: { taskId: number; message: string }[];
  usage: { planner: Usage | null; attempts: Usage; total: Usage };
  ledger: UsageEntry[];
  implementation: UsageTotals;
  taskUsage: Record<number, UsageTotals>;
  coding: { provider: string; model: string } | null;
  capabilities: string[];
  activity: string | null;
};

export type RunsOverview = {
  implementation: UsageTotals;
  runs: RunSummary[];
  readiness: { outputDir: string | null; ready: boolean; reason: string | null };
};

export type TaskPatch = { title?: string; description?: string; acceptance?: string[] };

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
  listProjects: () => request<{ projects: Project[] }>("/projects").then((r) => r.projects),

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

  generation: (id: string) => request<GenerationOverview>(`/projects/${id}/generation`),

  startGeneration: (id: string, body: { outputDir: string; baseline: boolean }) =>
    request<{ generation: Generation }>(`/projects/${id}/generations`, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.generation),

  /** Follows a generation; `onEvent` gets a snapshot, live events, and finally `done`. */
  followGeneration: async (
    id: string,
    generationId: number,
    onEvent: (event: GenerationEvent) => void,
    signal?: AbortSignal,
  ) => {
    const res = await fetch(`/api/projects/${id}/generations/${generationId}/events`, {
      ...(signal && { signal }),
    });
    if (!res.ok || !res.body) throw new ApiError(res.status, `${res.status} ${res.statusText}`);
    await readLines(res.body, (line) => onEvent(JSON.parse(line) as GenerationEvent));
  },

  cancelGeneration: (id: string, generationId: number) =>
    request<{ cancelling: boolean }>(`/projects/${id}/generations/${generationId}/cancel`, {
      method: "POST",
    }),

  runs: (id: string) => request<RunsOverview>(`/projects/${id}/runs`),

  planRun: (id: string) =>
    request<{ run: Run }>(`/projects/${id}/runs`, { method: "POST" }).then((r) => r.run),

  run: (id: string, runId: number) => request<RunDetail>(`/projects/${id}/runs/${runId}`),

  runMode: (id: string, runId: number, executionMode: ExecutionMode) =>
    request(`/projects/${id}/runs/${runId}/mode`, {
      method: "PATCH",
      body: JSON.stringify({ executionMode }),
    }),
  runNote: (id: string, runId: number, note: string) =>
    request(`/projects/${id}/runs/${runId}/interventions`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),

  runAction: (id: string, runId: number, action: RunAction) =>
    request<{ run: Run }>(`/projects/${id}/runs/${runId}/${action}`, { method: "POST" }),

  editTask: (id: string, runId: number, taskId: number, patch: TaskPatch) =>
    request<{ task: RunTask }>(`/projects/${id}/runs/${runId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  removeTask: (id: string, runId: number, taskId: number) =>
    request<void>(`/projects/${id}/runs/${runId}/tasks/${taskId}`, { method: "DELETE" }),

  attempt: (id: string, runId: number, attemptId: number) =>
    request<{ attempt: AttemptDetail }>(`/projects/${id}/runs/${runId}/attempts/${attemptId}`).then(
      (r) => r.attempt,
    ),

  runSettings: (id: string) => request<RunSettings>(`/projects/${id}/run-settings`),

  saveRunSettings: (id: string, patch: Partial<RunSettings>) =>
    request<RunSettings>(`/projects/${id}/run-settings`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  reorderTasks: (id: string, runId: number, taskIds: number[]) =>
    request<void>(`/projects/${id}/runs/${runId}/order`, {
      method: "PUT",
      body: JSON.stringify({ taskIds }),
    }),

  settings: () => request<SettingsView>("/settings"),

  setRoles: (roles: Partial<Record<ModelRole, RoleModel>>) =>
    request<SettingsView>("/settings/roles", { method: "PUT", body: JSON.stringify(roles) }),
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
