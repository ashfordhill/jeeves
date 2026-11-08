import { readFileSync } from "node:fs";
import { Client } from "@opensearch-project/opensearch";
const client = new Client({
  node: "http://search-index:9200",
  maxRetries: 0,
  requestTimeout: 5000,
});
try {
  const config = JSON.parse(readFileSync("infra/search/index.json", "utf8"));
  if (!(await client.indices.exists({ index: config.index })).body)
    await client.indices.create({ index: config.index, body: { settings: config.settings } });
  const result = (await client.indices.getSettings({ index: config.index })).body[config.index]
    ?.settings?.index;
  if (
    !result ||
    Object.entries(config.settings).some(([key, value]) => String(result[key]) !== String(value))
  )
    throw new Error(
      "Existing search index settings are incompatible. Preserve data and apply an explicit migration.",
    );
  console.log(
    "Local index settings asserted (1 shard, 0 replicas). Mapping/query/publication remain for FP07a.",
  );
} finally {
  await client.close();
}
