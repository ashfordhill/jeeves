import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { restServer } from "@jeeves/rest-server";
import {
  defineFeature,
  defineService,
  type Feature,
  type OperationHandler,
  runService,
} from "@jeeves/service-runtime";
import {
  type CheckResult,
  createGenerateContext,
  runTestPack,
  type TestPackContext,
} from "@jeeves/template-kit";
import { afterEach, describe, expect, it } from "vitest";
import { lookup, serverDesign } from "../conformance/fixtures/design.ts";
import { generate } from "../generate.ts";
import ping from "../scaffold/features/ping/index.ts";
import { testPack } from "./index.ts";

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

/**
 * Generates the attachment's files into a temp project, then runs the service in-process with
 * the given features and a `TestPackContext` pointing at it.
 */
async function runPack(options: {
  features: Feature[];
  extraPaths?: string;
  contractText?: string;
}) {
  const design = serverDesign();
  const subject = createGenerateContext(design, lookup, "links", "links-api");
  const dir = mkdtempSync(join(tmpdir(), "jeeves-rest-pack-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const files = generate(subject).files;
  for (const file of files) {
    mkdirSync(dirname(join(dir, file.path)), { recursive: true });
    writeFileSync(join(dir, file.path), file.contents);
  }
  const contract = join(dir, "contracts/links.openapi.yaml");
  if (options.extraPaths) {
    const text = files[0]?.contents ?? "";
    writeFileSync(contract, text.replace("paths:\n", `paths:\n${options.extraPaths}`));
  }
  if (options.contractText) writeFileSync(contract, options.contractText);
  const service = await runService(
    defineService({ name: "links", plugins: [restServer({ contract, basePath: "/api" })] }),
    {
      logger: false,
      features: options.features,
      env: { PORT: String(await freePort()), HOST: "127.0.0.1" },
    },
  );
  cleanups.push(() => service.stop());
  const ctx: TestPackContext = {
    projectDir: dir,
    subject,
    compose: { services: { links: { environment: { PORT: "8080" } } } },
    service: (name) => ({
      name,
      endpoint: async () => ({ host: "127.0.0.1", port: service.config.port }),
      exec: () => Promise.reject(new Error("not in-process")),
      restart: () => Promise.reject(new Error("not in-process")),
      stop: () => Promise.reject(new Error("not in-process")),
      start: () => Promise.reject(new Error("not in-process")),
      run: () => Promise.reject(new Error("not in-process")),
    }),
    log: () => {},
  };
  const results = await runTestPack(testPack, ctx);
  return Object.fromEntries(results.map((r) => [r.id, r])) as Record<string, CheckResult>;
}

const getLinkPath = `  /links/{code}:
    get:
      operationId: getLink
      parameters:
        - name: code
          in: path
          required: true
          schema: { type: string }
          example: jv
      responses:
        "200":
          description: The link
          content:
            application/json:
              schema:
                type: object
                required: [target]
                properties: { target: { type: string } }
`;

describe("rest-api-server test pack", () => {
  it("passes for the scaffolded contract and ping feature", async () => {
    const results = await runPack({ features: [ping] });
    expect(Object.values(results).map((r) => [r.id, r.status, r.error])).toEqual([
      ["openapi-served", "passed", undefined],
      ["handlers", "passed", undefined],
      ["contract-smoke", "passed", undefined],
      ["invalid-requests", "passed", undefined],
    ]);
  });

  it("names operations that have no handler", async () => {
    const results = await runPack({ features: [ping], extraPaths: getLinkPath });
    expect(results.handlers?.status).toBe("failed");
    expect(results.handlers?.error).toBe("No handler for getLink (GET /api/links/{code})");
  });

  it("fails the smoke check when a documented example gets an invalid response", async () => {
    const getLink: OperationHandler = () => ({ status: 200, body: { target: 42 } });
    const links = defineFeature({ name: "links", operations: { getLink } });
    const results = await runPack({ features: [ping, links], extraPaths: getLinkPath });
    expect(results.handlers?.status).toBe("passed");
    expect(results["contract-smoke"]?.status).toBe("failed");
    // The server itself refuses the bad response, and the check sees the undocumented 500.
    expect(results["contract-smoke"]?.error).toContain(
      "getLink → 500: / status 500 isn't documented",
    );
  });

  it("fails eligible operations missing examples, even when another request passed", async () => {
    const results = await runPack({
      features: [ping],
      extraPaths: getLinkPath.replace("          example: jv\n", ""),
    });
    expect(results["contract-smoke"]?.error).toContain(
      "getLink: eligible operation is missing required request examples",
    );
  });

  it("fails a required empty smoke check instead of reporting success", async () => {
    const results = await runPack({
      features: [],
      contractText: 'openapi: 3.1.0\ninfo: {title: Empty, version: "1"}\npaths: {}\n',
    });
    expect(results["contract-smoke"]?.status).toBe("failed");
    expect(results["contract-smoke"]?.error).toContain("ran zero requests");
  });

  it("checks redirect headers without following Location", async () => {
    const path = `  /redirect:
    get:
      operationId: redirect
      responses:
        "302":
          description: Redirect
          headers:
            Location: {required: true, schema: {type: string, format: uri}}
            Cache-Control: {required: true, schema: {type: string, const: no-store}}
`;
    const redirect = defineFeature({
      name: "redirect",
      operations: {
        redirect: () => ({
          status: 302,
          headers: { Location: "http://127.0.0.1:1/must-not-follow", "Cache-Control": "no-store" },
        }),
      },
    });
    const results = await runPack({ features: [ping, redirect], extraPaths: path });
    expect(results["contract-smoke"]?.status).toBe("passed");
  });
});

async function freePort(): Promise<number> {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as { port: number };
  server.close();
  return port;
}
