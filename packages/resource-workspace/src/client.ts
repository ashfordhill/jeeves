import { z } from "zod";
import {
  inputSchema,
  type RecordInput,
  type ResourceRecord,
  recordSchema,
  type WorkspaceCollection,
  type WorkspaceDefinition,
  workspaceDefinitionSchema,
} from "./definition.ts";

const identitySchema = z.strictObject({
  id: z.uuid(),
  csrfToken: z.string().regex(/^[a-f0-9]{64}$/),
});
const credentialsSchema = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});
export type WorkspaceIdentity = Readonly<z.output<typeof identitySchema>>;
export type ResourcePage = { items: ResourceRecord[]; nextCursor: string | null };
export type WorkspaceErrorKind =
  | "HTTP"
  | "NETWORK"
  | "TIMEOUT"
  | "CANCELLED"
  | "SESSION_CHANGED"
  | "PROTOCOL"
  | "CONFIGURATION";
export class WorkspaceError extends Error {
  constructor(
    readonly kind: WorkspaceErrorKind,
    readonly status?: number,
  ) {
    super(
      kind === "HTTP"
        ? ({
            400: "The submitted values were refused. Review the form and try again.",
            401: "Your session has ended. Sign in again.",
            403: "Your session cannot authorize this change. Sign in again or contact the application owner.",
            404: "This record or a related record is no longer available.",
            409: "That account already exists. Try signing in.",
          }[status ?? 0] ??
            "The service could not complete this request. Refresh before retrying a change.")
        : {
            NETWORK: "Connection interrupted. Check your records before retrying a change.",
            TIMEOUT: "The request took too long. Refresh before trying a change again.",
            CANCELLED: "The request was cancelled.",
            SESSION_CHANGED: "Your account changed. Refresh this view.",
            PROTOCOL:
              "The service returned an unexpected response. Refresh or contact the application owner.",
            CONFIGURATION:
              "This workspace connection is unavailable. Contact the application owner.",
          }[kind],
    );
    this.name = "WorkspaceError";
  }
}
export const workspaceErrorMessage = (error: unknown) =>
  error instanceof WorkspaceError ? error.message : "The action could not be completed. Try again.";
export const isSessionError = (error: unknown) =>
  error instanceof WorkspaceError && (error.status === 401 || error.kind === "SESSION_CHANGED");

export interface WorkspaceClient {
  readonly definition: WorkspaceDefinition;
  identity(): WorkspaceIdentity | undefined;
  subscribe(listener: () => void): () => void;
  restore(signal?: AbortSignal): Promise<WorkspaceIdentity | undefined>;
  authenticate(
    action: "login" | "register",
    credentials: { email: string; password: string },
    signal?: AbortSignal,
  ): Promise<WorkspaceIdentity>;
  logout(signal?: AbortSignal): Promise<void>;
  list(collection: string, cursor?: string, signal?: AbortSignal): Promise<ResourcePage>;
  read(collection: string, id: string, signal?: AbortSignal): Promise<ResourceRecord>;
  create(collection: string, values: RecordInput, signal?: AbortSignal): Promise<ResourceRecord>;
  update(
    collection: string,
    id: string,
    values: RecordInput,
    signal?: AbortSignal,
  ): Promise<ResourceRecord>;
}

/** Same-origin cookie/CSRF transport. No token persistence, mutation retries or arbitrary endpoints. */
export function createWorkspaceClient(options: {
  definition: unknown;
  baseUrl: string | (() => string);
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}): WorkspaceClient {
  const definition = workspaceDefinitionSchema.parse(options.definition);
  const freeze = (value: unknown): void => {
    if (value && typeof value === "object") {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
  };
  freeze(definition);
  const timeoutMs = options.timeoutMs ?? 10000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000)
    throw new Error("Workspace timeout must be 100–60000ms");
  let identity: WorkspaceIdentity | undefined,
    epoch = 0;
  const listeners = new Set<() => void>();
  const setIdentity = (next: WorkspaceIdentity | undefined) => {
    identity = next && Object.freeze(next);
    epoch++;
    for (const listener of listeners) listener();
  };
  const collection = (id: string, operation: WorkspaceCollection["operations"][number]) => {
    const value = definition.collections.find((item) => item.id === id);
    if (!value?.operations.includes(operation))
      throw new Error(`Workspace does not provide ${operation} for ${id}`);
    return value;
  };
  const request = async (
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
    authenticated = true,
  ): Promise<unknown> => {
    if (authenticated && !identity) throw new WorkspaceError("HTTP", 401);
    const started = epoch;
    const base = new URL(
      typeof options.baseUrl === "function" ? options.baseUrl() : options.baseUrl,
      globalThis.location.href,
    );
    if (
      base.origin !== globalThis.location.origin ||
      base.search ||
      base.hash ||
      base.username ||
      base.password ||
      !["http:", "https:"].includes(base.protocol)
    )
      throw new WorkspaceError("CONFIGURATION");
    const controller = new AbortController();
    let timedOut = false,
      networkComplete = false;
    const abort = () => controller.abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) controller.abort();
    const finishNetwork = () => {
      networkComplete = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    try {
      const response = await (options.fetch ?? globalThis.fetch)(
        `${base.href.replace(/\/$/, "")}${path}`,
        {
          method,
          credentials: "same-origin",
          redirect: "error",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            ...(body !== undefined && { "Content-Type": "application/json" }),
            ...(authenticated &&
              method !== "GET" &&
              identity && { "X-CSRF-Token": identity.csrfToken }),
          },
          ...(body !== undefined && { body: JSON.stringify(body) }),
        },
      );
      if (started !== epoch) {
        await response.body?.cancel();
        throw new WorkspaceError("SESSION_CHANGED");
      }
      if (!response.ok) {
        await readResponseText(response);
        finishNetwork();
        if (started !== epoch) throw new WorkspaceError("SESSION_CHANGED");
        if (authenticated && response.status === 401) setIdentity(undefined);
        throw new WorkspaceError("HTTP", response.status);
      }
      if (response.status === 204) {
        await response.arrayBuffer();
        finishNetwork();
        if (started !== epoch) throw new WorkspaceError("SESSION_CHANGED");
        return undefined;
      }
      if (!response.headers.get("content-type")?.includes("application/json")) {
        await response.body?.cancel();
        throw new WorkspaceError("PROTOCOL");
      }
      const text = await readResponseText(response);
      finishNetwork();
      if (started !== epoch) throw new WorkspaceError("SESSION_CHANGED");
      try {
        return JSON.parse(text);
      } catch {
        throw new WorkspaceError("PROTOCOL");
      }
    } catch (error) {
      if (signal?.aborted && !networkComplete) throw new WorkspaceError("CANCELLED");
      if (timedOut) throw new WorkspaceError("TIMEOUT");
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError("NETWORK");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  };
  const parsed = <T>(schema: z.ZodType<T>, value: unknown): T => {
    const result = schema.safeParse(value);
    if (!result.success) throw new WorkspaceError("PROTOCOL");
    return result.data;
  };
  const record = (resource: WorkspaceCollection, value: unknown) =>
    parsed(recordSchema(resource), value) as ResourceRecord;
  return {
    definition,
    identity: () => identity,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async restore(signal) {
      const started = epoch;
      try {
        const next = parsed(
          identitySchema,
          await request("GET", "/auth/session", undefined, signal, false),
        );
        if (started !== epoch) throw new WorkspaceError("SESSION_CHANGED");
        setIdentity(next);
        return next;
      } catch (error) {
        if (error instanceof WorkspaceError && error.status === 401) {
          if (started !== epoch) throw new WorkspaceError("SESSION_CHANGED");
          setIdentity(undefined);
          return undefined;
        }
        throw error;
      }
    },
    async authenticate(action, credentials, signal) {
      const mode = z.enum(["login", "register"]).parse(action);
      const body = credentialsSchema.parse(credentials);
      setIdentity(undefined);
      const started = epoch;
      const next = parsed(
        identitySchema,
        await request("POST", `/auth/${mode}`, body, signal, false),
      );
      if (started !== epoch) throw new WorkspaceError("SESSION_CHANGED");
      setIdentity(next);
      return next;
    },
    async logout(signal) {
      const started = epoch;
      try {
        await request("POST", "/auth/logout", undefined, signal);
      } catch (error) {
        if (!(error instanceof WorkspaceError && error.status === 401)) throw error;
        return;
      }
      if (started !== epoch) throw new WorkspaceError("SESSION_CHANGED");
      setIdentity(undefined);
    },
    async list(id, cursor, signal) {
      const resource = collection(id, "list");
      if (cursor !== undefined && (typeof cursor !== "string" || cursor.length > 512))
        throw new Error("Invalid cursor");
      const query = new URLSearchParams({
        limit: String(definition.pageSize),
        ...(cursor && { cursor }),
      });
      const data = await request("GET", `/api/${resource.name}?${query}`, undefined, signal);
      return parsed(
        z.strictObject({
          items: z.array(recordSchema(resource)).max(definition.pageSize),
          nextCursor: z.string().min(1).max(512).nullable(),
        }),
        data,
      ) as ResourcePage;
    },
    async read(id, recordId, signal) {
      const resource = collection(id, "read");
      return record(
        resource,
        await request(
          "GET",
          `/api/${resource.name}/${z.uuid().parse(recordId)}`,
          undefined,
          signal,
        ),
      );
    },
    async create(id, values, signal) {
      const resource = collection(id, "create");
      return record(
        resource,
        await request("POST", `/api/${resource.name}`, inputSchema(resource).parse(values), signal),
      );
    },
    async update(id, recordId, values, signal) {
      const resource = collection(id, "update");
      return record(
        resource,
        await request(
          "PATCH",
          `/api/${resource.name}/${z.uuid().parse(recordId)}`,
          inputSchema(resource).parse(values),
          signal,
        ),
      );
    },
  };
}

/** Drain complete HTTP bodies, including expected errors, without manufacturing request aborts. */
async function readResponseText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new WorkspaceError("PROTOCOL");
  const decoder = new TextDecoder();
  let text = "",
    bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 8 * 1024 * 1024) {
        await reader.cancel();
        throw new WorkspaceError("PROTOCOL");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return text;
}
