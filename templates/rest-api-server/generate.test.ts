import { createGenerateContext } from "@jeeves/template-kit";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { lookup, serverDesign } from "./conformance/fixtures/design.ts";
import { generate } from "./generate.ts";

const generateFor = (config: Record<string, unknown> = {}) =>
  generate(createGenerateContext(serverDesign(config), lookup, "links", "links-api"));

describe("rest-api-server generate", () => {
  it("scaffolds the contract and a ping feature that implements it", () => {
    const { files, runtimeDependencies } = generateFor({ basePath: "/v1" });
    expect(files.map((f) => [f.path, f.ownership])).toEqual([
      ["contracts/links.openapi.yaml", "scaffold"],
      ["services/links/src/features/ping/index.ts", "scaffold"],
    ]);
    const contract = parse(files[0]?.contents ?? "");
    expect(contract.openapi).toBe("3.1.0");
    expect(contract.info.title).toBe("Links service API");
    expect(contract.servers).toEqual([{ url: "/v1" }]);
    expect(contract.paths["/ping"].get.operationId).toBe("ping");
    expect(runtimeDependencies).toEqual([{ element: "links", name: "@jeeves/rest-server" }]);
  });

  it("gives the service a local bearer token only when auth is bearer", () => {
    expect(generateFor().compose).toEqual({});
    expect(generateFor({ auth: "bearer" }).compose.services?.links?.environment).toEqual({
      REST_BEARER_TOKEN: "links-local-token",
    });
  });
});
