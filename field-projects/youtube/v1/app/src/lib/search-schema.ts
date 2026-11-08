import type { Client } from "@opensearch-project/opensearch";
import { videoPublished } from "../contracts/v1.ts";
import { readyVideo } from "../state/watch.ts";
export const index = "videos";
// Public projection only: no creator subject, original, upload, job or private lifecycle fields.
export const publicDocument = readyVideo.safeExtend({
  visibility: videoPublished.shape.visibility,
  state: videoPublished.shape.state,
});
export const mapping = {
  dynamic: "strict" as const,
  properties: {
    videoId: { type: "keyword" as const },
    publicationVersion: { type: "integer" as const },
    visibility: { type: "keyword" as const },
    state: { type: "keyword" as const },
    title: { type: "text" as const },
    description: { type: "text" as const },
    channel: { type: "text" as const },
    durationSeconds: { type: "double" as const },
    manifest: { type: "keyword" as const, index: false },
    thumbnail: { type: "keyword" as const, index: false },
    publishedAt: { type: "date" as const },
  },
};
export async function assertSearch(client: Client) {
  if (!(await client.indices.exists({ index })).body)
    await client.indices.create({
      index,
      body: {
        settings: { number_of_shards: 1, number_of_replicas: 0 },
        mappings: mapping,
      },
    });
  const settings = (await client.indices.getSettings({ index })).body[index]?.settings?.index;
  if (String(settings?.number_of_shards) !== "1" || String(settings?.number_of_replicas) !== "0")
    throw new Error(
      "Search videos settings incompatible: require 1 shard/0 replicas; preserve data and migrate explicitly.",
    );
  const existing = (await client.indices.getMapping({ index })).body[index]?.mappings ?? {};
  const fail = (field: string) => {
    throw new Error(
      `Search videos mapping incompatible at ${field}; preserve data and migrate explicitly.`,
    );
  };
  if (
    existing._source?.enabled === false ||
    existing.enabled === false ||
    existing.dynamic_templates?.length
  )
    fail("_source/enabled/dynamic_templates");
  for (const [name, value] of Object.entries(existing.properties ?? {})) {
    const wanted = mapping.properties[name as keyof typeof mapping.properties];
    if (!wanted) fail(`properties.${name} (unexpected public field)`);
    // Reject alternate analyzers, subfields and changed indexing/doc-values behavior.
    for (const [key, actual] of Object.entries(value))
      if (actual !== (wanted as Record<string, unknown>)[key]) fail(`properties.${name}.${key}`);
    if (value.type !== wanted.type) fail(`properties.${name}.type`);
    for (const [key, expected] of Object.entries(wanted))
      if (value[key as keyof typeof value] !== expected) fail(`properties.${name}.${key}`);
  }
  const missing = Object.keys(mapping.properties).filter((k) => !existing.properties?.[k]);
  if (missing.length && (await client.count({ index })).body.count !== 0)
    fail(`missing ${missing.join(",")} on nonempty index`);
  // Add the explicit mapping to the historical empty settings-only index; never delete/reset it.
  await client.indices.putMapping({ index, body: mapping });
}
