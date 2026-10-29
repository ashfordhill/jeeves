import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { GenerateContext, GenerateResult } from "@jeeves/template-kit";
import { renderScaffold, renderText } from "@jeeves/template-kit";

const CONTRACT = fileURLToPath(new URL("./scaffold/openapi.yaml", import.meta.url));
const FEATURES = fileURLToPath(new URL("./scaffold/features", import.meta.url));

/** The service's contract file (PLAN §9 layout); one rest-api-server per service. */
export function contractPath(serviceId: string): string {
  return `contracts/${serviceId}.openapi.yaml`;
}

/** The local-only token compose gives a service whose API uses bearer auth. */
export function bearerToken(serviceId: string): string {
  return `${serviceId}-local-token`;
}

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
