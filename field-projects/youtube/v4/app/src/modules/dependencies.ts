// Generated scaffold: the minimal interfaces module stubs take, one per tile kind and use.
// Export rewrites this file. Back each one with a real client when you write a module.

/** A database a module only reads. */
export interface DatabaseReader {
  query<Row = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<Row[]>;
}

/** A database a module reads and writes. */
export interface DatabaseReadWriter extends DatabaseReader {
  execute(sql: string, values?: readonly unknown[]): Promise<{ rowCount: number }>;
}

/** A queue or topic a module publishes to. `messageId` is the message's ID (a fresh one when it
 * is absent), so a consumer whose receipts are keyed on it takes a repeat once. */
export interface QueuePublisher {
  publish(message: Uint8Array, options?: { key?: string; messageId?: string }): Promise<void>;
}

/** A queue or topic a module consumes from. */
export interface QueueConsumer {
  consume(handler: (message: Uint8Array) => Promise<void>): Promise<{ close(): Promise<void> }>;
}

/** Object storage a module reads. */
export interface ObjectReader {
  get(key: string): Promise<Uint8Array | undefined>;
}

/** Object storage a module writes. */
export interface ObjectWriter {
  put(key: string, body: Uint8Array, contentType?: string): Promise<void>;
}

/** Object storage a module reads and writes. */
export interface ObjectStore extends ObjectReader, ObjectWriter {}

/** A cache. */
export interface CacheClient {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/** A search index a module queries. */
export interface SearchReader {
  search<Hit = Record<string, unknown>>(query: Record<string, unknown>): Promise<Hit[]>;
}

/** A search index a module writes. */
export interface SearchWriter {
  index(id: string, document: Record<string, unknown>): Promise<void>;
  remove(id: string): Promise<void>;
}

/** A search index a module queries and writes. */
export interface SearchIndex extends SearchReader, SearchWriter {}

/** An identity service that verifies a caller's token. */
export interface TokenVerifier {
  verify(token: string): Promise<{ subject: string; claims: Record<string, unknown> }>;
}

/** An HTTP target: another application, an external API, an identity service or a CDN. */
export interface HttpTarget {
  request(path: string, init?: RequestInit): Promise<Response>;
}

/** Another module in the same tile. */
export type ModuleCall<Input = unknown, Output = unknown> = (input: Input) => Promise<Output>;
