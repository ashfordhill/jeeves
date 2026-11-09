import { isDeepStrictEqual } from "node:util";
import type { Client } from "@opensearch-project/opensearch";
import { validateSearchIndex, type SearchIndex } from "./search-contract.ts";

/** Same explicit version/properties/settings as foundation search-init. Never delete, reset,
 * or mutate an existing index to make readiness pass. Migration is a separate owner action. */
export async function assertSearchIndex(client: Pick<Client, "indices">, binding: SearchIndex) {
  validateSearchIndex(binding);
  const { index, version, properties } = binding;
  if (!(await client.indices.exists({ index })).body)
    await client.indices.create({
      index,
      body: {
        settings: { number_of_shards: 1, number_of_replicas: 0 },
        mappings: { dynamic: "strict", _meta: { version }, properties },
      },
    });
  const current = (await client.indices.getMapping({ index })).body[index]?.mappings;
  if (
    !isDeepStrictEqual(current?._meta, { version }) ||
    !isDeepStrictEqual(current?.properties, properties) ||
    current?.dynamic !== "strict" ||
    current?._source?.enabled === false ||
    current?.enabled === false ||
    current?.dynamic_templates?.length
  )
    throw new Error(`Search mapping ${index} incompatible; preserve data and migrate explicitly.`);
  const settings = (await client.indices.getSettings({ index })).body[index]?.settings?.index;
  if (String(settings?.number_of_shards) !== "1" || String(settings?.number_of_replicas) !== "0")
    throw new Error(
      `Search settings ${index} incompatible; require one shard/no replicas, preserve data and migrate explicitly.`,
    );
}
