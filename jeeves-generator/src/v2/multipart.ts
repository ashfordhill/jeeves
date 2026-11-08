import { generationRuntime } from "@jeeves/spec";
import { pointerPart } from "../json.ts";
import type { V2Emitter } from "./registry.ts";

/** Actual transport library and minimal object access; compiled application bindings and the
 * service constructor remain required before installing source-bound multipart support. */
export function createLocalMultipart(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.multipart",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description: "Owned signed multipart engine, S3 adapter and explicitly mounted HTTP handlers.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    local: ({ model }) => {
      const selections = model.selections.filter((s) => s.binding.kind === "owned-multipart");
      if (!selections.length) return undefined;
      return {
        sourcePaths: selections.map(
          (s) => `/${s.sourcePath.map((p) => pointerPart(String(p))).join("/")}`,
        ),
        storage: selections.map((s) => {
          const objects = s.resources.find((r) => r.field === "objects");
          if (!objects) throw new Error("Normalized multipart object binding required");
          return { resource: objects.identity.local, host: s.host, corsPut: true };
        }),
      };
    },
    render: ({ model, asset }) => {
      const paths = model.selections
        .filter((s) => s.binding.kind === "owned-multipart")
        .map((s) => `/${s.sourcePath.map((p) => pointerPart(String(p))).join("/")}`);
      if (!paths.length) return { files: [] };
      return {
        files: ["multipart", "multipart-objects", "multipart-http"].map((name) => ({
          path: `src/runtime/${name}.ts`,
          content: asset(
            `jeeves-generator/templates/local-v2/assets/src/runtime/${name}.ts.template`,
          ),
          ownership: "generated-scaffold" as const,
          sourcePaths: paths,
        })),
        gaps: [
          {
            id: "multipart-application-bindings",
            status: "unfinished" as const,
            required: true,
            description:
              "Bind verified principal, content/metadata codecs, transaction/repository/completion hooks, object namespace/identity metadata and explicit HTTP/service mounts in a compiled recipe. Transport libraries and storage access alone do not install an application.",
            sourcePaths: paths,
          },
        ],
      };
    },
  };
}
