import { createGenerateContext } from "@jeeves/template-kit";
import { describe, expect, it } from "vitest";
import { clientDesign, lookup } from "./conformance/fixtures/design.ts";
import { clientSource, generate } from "./generate.ts";

const ctxFor = (config: Record<string, unknown> = {}) =>
  createGenerateContext(clientDesign(config), lookup, "stats", "stats-links");

describe("rest-api-client generate", () => {
  it("generates the client module and adds the runtime and the types script", () => {
    const result = generate(ctxFor());
    expect(result.files.map((f) => [f.path, f.ownership])).toEqual([
      ["services/stats/src/clients/links.generated.ts", "generated"],
    ]);
    expect(result.runtimeDependencies).toEqual([{ element: "stats", name: "@jeeves/rest-client" }]);
    expect(result.packageScripts).toEqual([
      { element: "stats", name: "pretypecheck", command: "jeeves-rest-client-types" },
    ]);
  });

  it("points the caller at the target in compose and waits for it to be ready", () => {
    expect(generate(ctxFor()).compose).toEqual({
      services: {
        stats: {
          environment: {
            API_LINKS_URL: "http://links:8080",
            API_LINKS_TOKEN: "links-local-token",
          },
          depends_on: { links: { condition: "service_healthy" } },
        },
      },
    });
  });

  it("writes a service client configured from the environment", () => {
    const source = clientSource(ctxFor({ timeoutMs: 1500, retries: 2 }));
    expect(source).toContain("// @jeeves-contract ../../../../contracts/links.openapi.yaml");
    expect(source).toContain('import { serviceRestClient } from "@jeeves/rest-client/service";');
    expect(source).toContain('import type { paths } from "./links.openapi.ts";');
    expect(source).toContain("export const linksClient = serviceRestClient<paths>({");
    expect(source).toContain('  basePath: "/v1",');
    expect(source).toContain('  urlEnv: "API_LINKS_URL",');
    expect(source).toContain('  tokenEnv: "API_LINKS_TOKEN",');
    expect(source).toContain("  timeoutMs: 1500,\n  retries: 2,");
  });

  it("writes a browser client that resolves its base URL from the web app's runtime config", () => {
    const ctx = createGenerateContext(clientDesign({}, "web-app"), lookup, "stats", "stats-links");
    const source = clientSource(ctx);
    expect(source).toContain('import { createRestClient } from "@jeeves/rest-client";');
    expect(source).toContain('import { apiUrl } from "@jeeves/web-runtime";');
    expect(source).toContain(`  baseUrl: () => \`\${apiUrl("links")}/v1\`,`);
    expect(source).not.toContain("tokenEnv");
    expect(generate(ctx).files[0]?.path).toBe("frontends/stats/src/clients/links.generated.ts");
  });

  it("refuses a client on an element it can't be generated into", () => {
    const ctx = createGenerateContext(clientDesign(), lookup, "stats", "stats-links");
    const elsewhere = {
      ...ctx,
      element: { ...ctx.element, template: { id: "worker", version: "0.1.0" } },
    };
    expect(() => generate(elsewhere)).toThrow("A REST client can't be generated into worker");
  });

  it("is deterministic", () => {
    expect(generate(ctxFor())).toEqual(generate(ctxFor()));
  });
});
