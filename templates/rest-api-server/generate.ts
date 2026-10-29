import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { GenerateContext, GenerateResult } from "@jeeves/template-kit";
import { bearerToken, contractPath, renderScaffold, renderText } from "@jeeves/template-kit";

export { bearerToken, contractPath };

const CONTRACT = fileURLToPath(new URL("./scaffold/openapi.yaml", import.meta.url));
const FEATURES = fileURLToPath(new URL("./scaffold/features", import.meta.url));

/**
 * Scaffolds the contract and a ping feature that implements it. The service's own generated
 * wiring (http-service) adds `restServer(...)` with this attachment's config.
 */
export function generate(ctx: GenerateContext): GenerateResult {
  const { element, config, dir } = ctx;
  const vars = { serviceName: element.name, basePath: String(config.basePath) };
  const files = [
    {
      path: contractPath(element.id),
      contents: renderText(readFileSync(CONTRACT, "utf8"), vars, CONTRACT),
      ownership: "scaffold" as const,
    },
    ...renderScaffold(FEATURES, `${dir}/src/features`, vars),
  ];
  const bearer = config.auth === "bearer";
  return {
    files,
    compose: bearer
      ? {
          services: {
            [element.id]: { environment: { REST_BEARER_TOKEN: bearerToken(element.id) } },
          },
        }
      : {},
    runtimeDependencies: [{ element: element.id, name: "@jeeves/rest-server" }],
  };
}
