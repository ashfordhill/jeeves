import { Client } from "@opensearch-project/opensearch";

/** No index/mapping/query or product policy is inferred from the endpoint. */
export function createSearch(options: { endpoint: string; requestTimeoutMs: number }) {
  return new Client({
    node: options.endpoint,
    requestTimeout: options.requestTimeoutMs,
    maxRetries: 0,
  });
}
