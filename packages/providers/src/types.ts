/**
 * Provider-neutral model interface (PLAN §12). The design chat and the planner talk to models
 * only through `ModelProvider`, so an adapter for another vendor is a new file, not a rewrite.
 */

export type ImageMediaType = "image/png" | "image/jpeg" | "image/webp";

export type ContentPart =
  | { type: "text"; text: string }
  /** `data` is base64, without a `data:` prefix. */
  | { type: "image"; mediaType: ImageMediaType; data: string };

/**
 * One item of a conversation. Requests send the whole conversation every time (adapters keep no
 * server-side state), and responses return the items to append to it.
 */
export type ModelItem =
  | { type: "message"; role: "user" | "assistant"; content: ContentPart[] }
  | { type: "tool-call"; callId: string; name: string; arguments: string }
  | { type: "tool-result"; callId: string; output: string }
  /**
   * Provider-specific state that must be sent back as-is (e.g. OpenAI reasoning items). Adapters
   * drop opaque items that belong to another provider.
   */
  | { type: "opaque"; provider: string; data: unknown };

export type ToolDefinition = {
  name: string;
  description: string;
  /** JSON Schema for the arguments object. */
  parameters: Record<string, unknown>;
};

export type ModelRequest = {
  model: string;
  instructions: string;
  items: ModelItem[];
  tools: ToolDefinition[];
  maxOutputTokens?: number;
};

export type ToolCall = { callId: string; name: string; arguments: string };

/** Token usage as reported by the provider. `null` on a response means "unknown". */
export type Usage = { inputTokens: number; outputTokens: number; cachedInputTokens?: number };

export type StopReason = "end" | "tool-calls" | "max-tokens";

export type ModelResponse = {
  /** Output items, in order, to append to the conversation. */
  items: ModelItem[];
  /** Assistant text from this response, concatenated. */
  text: string;
  toolCalls: ToolCall[];
  usage: Usage | null;
  stop: StopReason;
};

export type ModelEvent = { type: "text-delta"; delta: string };

export type RespondOptions = {
  signal?: AbortSignal;
  /** Streamed progress. Called before `respond` resolves. */
  onEvent?: (event: ModelEvent) => void;
};

export type ModelCapabilities = {
  tools: boolean;
  imageInput: boolean;
  streaming: boolean;
  usage: boolean;
};

export interface ModelProvider {
  /** Stable provider ID, e.g. `openai`. Also the `provider` of its opaque items. */
  readonly id: string;
  readonly capabilities: ModelCapabilities;
  respond(request: ModelRequest, options?: RespondOptions): Promise<ModelResponse>;
}

export type ModelRole = "designChat" | "planner" | "coding";
export const modelRoles: readonly ModelRole[] = ["designChat", "planner", "coding"];
