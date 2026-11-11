// Generated scaffold: what a module's entry point receives and answers when its tile runs.
// Export rewrites this file. A route stub takes a ModuleRequest; a loop stub takes a ModuleMessage.

/** Who called (v3 contract, section 2): an account the tile's Auth guard verified, or anonymous.
 * Always anonymous in a tile with no Auth guard. */
export type Caller =
  | { signedIn: true; principal: { subject: string; claims: Record<string, unknown> } }
  | { signedIn: false };

/** One HTTP request to /modules/<module id> or a path below it. */
export type ModuleRequest = {
  method: string;
  /** The path below /modules/<module id>: "/" for the module's own path. */
  path: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  /** Parsed JSON or text, up to 64 KiB; undefined when there is none. */
  body: unknown;
  caller: Caller;
};

/** What a route stub answers: 200 and no body unless it says otherwise. */
export type ModuleResponse = {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
};

/** One message from a queue or topic the module consumes. */
export type ModuleMessage = {
  body: Uint8Array;
  messageId?: string;
  headers: Record<string, unknown>;
  /** 1 on its first delivery. */
  attempt: number;
  /** The queue it came from. */
  source: string;
};
