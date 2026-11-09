import { isDeepStrictEqual } from "node:util";
import { Client } from "@opensearch-project/opensearch";
import { plan } from "./common.mjs";

for (const mapping of plan.search) {
  const client = new Client({
    node: `http://search-${mapping.resource}:9200`,
    requestTimeout: 5000,
  });
  try {
    if ((await client.indices.exists({ index: mapping.resource })).body) {
      const current = (await client.indices.getMapping({ index: mapping.resource })).body[
        mapping.resource
      ]?.mappings;
      if (
        !isDeepStrictEqual(current?._meta, { version: mapping.version }) ||
        !isDeepStrictEqual(current?.properties, mapping.properties) ||
        current?.dynamic !== "strict" ||
        current?._source?.enabled === false ||
        current?.enabled === false ||
        current?.dynamic_templates?.length
      )
        throw new Error(
          `Search mapping ${mapping.resource} differs; explicit migration required, no reset performed.`,
        );
    } else
      await client.indices.create({
        index: mapping.resource,
        body: {
          settings: { number_of_shards: 1, number_of_replicas: 0 },
          mappings: {
            dynamic: "strict",
            _meta: { version: mapping.version },
            properties: mapping.properties,
          },
        },
      });
    const settings = (await client.indices.getSettings({ index: mapping.resource })).body[
      mapping.resource
    ]?.settings?.index;
    if (String(settings?.number_of_shards) !== "1" || String(settings?.number_of_replicas) !== "0")
      throw new Error(
        `Search settings ${mapping.resource} differ; require one shard/no replicas, preserve data and migrate explicitly.`,
      );
  } finally {
    await client.close();
  }
}
console.log("Contributed versioned search mappings current without data reset.");
