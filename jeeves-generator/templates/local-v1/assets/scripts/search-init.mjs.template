import { readFileSync } from "node:fs";
import { Client } from "@opensearch-project/opensearch";

const client = new Client({ node: "http://search-index:9200", maxRetries: 0 });
const config = JSON.parse(readFileSync("infra/search/index.json", "utf8"));
if ((await client.indices.exists({ index: config.index })).body) {
  throw new Error("Search index already exists; preserve it. Schema migration/reset is custom work.");
}
await client.indices.create({ index: config.index, body: { settings: config.settings } });
console.log("Empty local index created (1 shard, 0 replicas); mapping/publication/query policy remain custom.");
