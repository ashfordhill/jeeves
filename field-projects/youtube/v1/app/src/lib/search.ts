import { Client } from "@opensearch-project/opensearch";
export function searchClient() {
  return new Client({ node: "http://search-index:9200", requestTimeout: 5000, maxRetries: 0 });
}
// Single-node transport only; public filtering, mapping, queries and publication remain G02/G03.
