import { generationCapabilities, generationRuntime } from "@jeeves/spec";
import { pointerPart } from "../json.ts";
import { type V2Emitter, v2Compare } from "./registry.ts";

const assets = "jeeves-generator/templates/local-v2/assets/src/runtime/";

/** Dependency libraries install no user-facing feature or application hook. */
export function createLocalRuntimePrimitives(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.primitives",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description: "Reusable HTTP, verified identity, confirmed messaging and resource clients only.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    render: ({ model, asset }) => {
      const modules = new Map<string, Set<string>>();
      const add = (names: string[], path: readonly (string | number)[]) => {
        for (const name of names) {
          const paths = modules.get(name) ?? new Set<string>();
          paths.add(`/${path.map((part) => pointerPart(String(part))).join("/")}`);
          modules.set(name, paths);
        }
      };
      // An HTTP process serves through the shared HTTP service, with or without a template.
      for (const process of model.processes ?? [])
        if (process.shape === "http") add(["admission", "http"], ["generation", "processes"]);
      for (const selection of model.selections) {
        if ("host.requestTimeoutMs" in selection.inputs)
          add(["admission", "http"], selection.sourcePath);
        if (selection.identity) add(["identity"], selection.sourcePath);
        for (const resource of selection.resources) {
          const kind = generationCapabilities[selection.binding.kind].resources.find(
            (requirement) => requirement.field === resource.field,
          )?.kind;
          const names =
            kind === "database"
              ? ["postgres"]
              : kind === "queue"
                ? ["delivery", "amqp"]
                : kind === "object-store"
                  ? ["objects"]
                  : kind === "search"
                    ? ["search"]
                    : [];
          add(names, resource.sourcePath);
        }
      }
      return {
        files: [...modules]
          .sort(([a], [b]) => v2Compare(a, b))
          .map(([name, paths]) => ({
            path: `src/runtime/${name}.ts`,
            content: asset(`${assets}${name}.ts.template`),
            ownership: "generated-scaffold" as const,
            sourcePaths: [...paths].sort(),
          })),
      };
    },
  };
}
