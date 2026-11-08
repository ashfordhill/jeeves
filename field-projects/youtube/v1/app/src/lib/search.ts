import { Client } from "@opensearch-project/opensearch";
export function searchClient(requestTimeout = 5000) {
  return new Client({ node: "http://search-index:9200", requestTimeout, maxRetries: 0 });
}
