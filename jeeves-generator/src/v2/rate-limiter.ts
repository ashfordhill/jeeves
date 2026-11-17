import { generationRuntime, rateLimiterCallableContracts } from "@jeeves/spec";
import { mountedHooksGap } from "./module-stubs.ts";
import type { V2Emitter } from "./registry.ts";

export function createLocalRateLimiter(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.rate-limiter",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description:
      "Callable per-key rolling-window admission through one atomic shared-store log, with protected fail-closed refusals.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    provides: {
      callables: rateLimiterCallableContracts.map((contract) => ({
        contract,
        outputPaths: ["src/runtime/rate-limiter.ts"],
      })),
    },
    render: ({ model, asset }) => {
      const selections = model.selections.filter((s) => s.binding.kind === "rate-limiter");
      if (!selections.length) return { files: [] };
      const paths = selections.map((s) => `/${s.sourcePath.join("/")}`);
      return {
        files: [
          {
            path: "src/runtime/rate-limiter.ts",
            content: asset(
              "jeeves-generator/templates/local-v2/assets/src/runtime/rate-limiter.ts.template",
            ),
            ownership: "generated-scaffold",
            sourcePaths: paths,
          },
        ],
        gaps: [
          mountedHooksGap(
            model,
            selections,
            {
              id: "rate-limiter-key-policy",
              status: "unfinished",
              required: true,
              description:
                "Supply a pure bounded key policy over verified subject facts and call the generated admission handle from new-work admission. No address trust or per-copy fallback is provided.",
              sourcePaths: paths,
            },
            "admission remains unavailable until its key policy is written",
          ),
        ],
      };
    },
  };
}
