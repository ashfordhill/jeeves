/** Read-only native010 topology, with experimental declarations kept outside frozen v1 inputs. */
import native from "../../../../../field-projects/youtube/v1/diagrams/010-readable-upload-role/design.json" with {
  type: "json",
};
import { designSchema } from "../design.ts";
import { type Generation, type GenerationBinding, generationSchema } from "../generation.ts";
import {
  generationPresets,
  generationRuntime,
  generationTemplates,
} from "../generation-catalog.ts";

const dependency = (resource: string, connection: string) => ({ resource, connection });
const selection = (id: string, element: string, binding: GenerationBinding) => ({
  id,
  target: { kind: "element" as const, element },
  template: generationTemplates[binding.kind].ref,
  binding,
});
export const generationSourceFixture = () => designSchema.parse(structuredClone(native));
export const generationSelectionsFixture = (): Generation =>
  generationSchema.parse({
    version: 1,
    runtime: generationRuntime.ref,
    preset: generationPresets.youtube.ref,
    selections: [
      selection("owned-upload", "upload", {
        kind: "owned-multipart",
        state: dependency("metadata-db", "upload-state"),
        objects: dependency("originals", "upload-originals"),
        identity: { element: "identity", guard: "upload-auth" },
        jobs: dependency("upload-queue", "upload-publish"),
      }),
      selection("lifecycle", "completion-handler", {
        kind: "asset-lifecycle",
        upload: "owned-upload",
        state: dependency("metadata-db", "handler-metadata"),
        results: dependency("completion-events", "completions-handler"),
        publication: dependency("publication-events", "handler-publication"),
      }),
      selection("hls", "transcoder", {
        kind: "video-hls",
        originals: dependency("originals", "transcoder-read"),
        outputs: dependency("transcoded", "transcoder-write"),
        jobs: dependency("upload-queue", "jobs-transcoder"),
        results: dependency("completion-events", "transcoder-publish"),
      }),
      selection("ready-reader", "watch", {
        kind: "positive-cache-read",
        source: dependency("metadata-db", "watch-metadata"),
        cache: dependency("metadata-cache", "watch-cache"),
      }),
      selection("counter", "view-counter", {
        kind: "event-counter",
        state: dependency("view-counts", "counter-write"),
        events: dependency("view-events", "views-counter"),
      }),
      selection("projection", "search-indexer", {
        kind: "search-projection",
        index: dependency("search-index", "indexer-write"),
        events: dependency("publication-events", "publications-indexer"),
      }),
      selection("query", "search", {
        kind: "search-query",
        index: dependency("search-index", "search-read"),
      }),
      selection("upload-api", "upload", {
        kind: "youtube-upload",
        upload: "owned-upload",
        lifecycle: "lifecycle",
      }),
      selection("watch-api", "watch", {
        kind: "youtube-watch",
        reader: "ready-reader",
        counts: dependency("view-counts", "watch-counts-read"),
        events: dependency("view-events", "watch-views-publish"),
      }),
      selection("search-api", "search", { kind: "youtube-search", query: "query" }),
    ],
  });
