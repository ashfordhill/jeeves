import { createGenerateContext } from "@jeeves/template-kit";
import { describe, expect, it } from "vitest";
import { type DesignOptions, lookup, serviceDesign } from "./conformance/fixtures/design.ts";
import { generate, wiringSource } from "./generate.ts";

const ctxFor = (options: DesignOptions = {}) =>
  createGenerateContext(serviceDesign(options), lookup, "links");

describe("http-service generate", () => {
  it("scaffolds the service once and generates its wiring", () => {
    const { files, runtimeDependencies } = generate(ctxFor());
    expect(files.filter((f) => f.ownership === "scaffold").map((f) => f.path)).toEqual([
      "services/links/Dockerfile",
      "services/links/Dockerfile.dockerignore",
      "services/links/package.json",
      "services/links/src/features/README.md",
      "services/links/src/main.ts",
      "services/links/test/README.md",
      "services/links/tsconfig.json",
    ]);
    const wiring = files.find((f) => f.path === "services/links/src/jeeves.generated.ts");
    expect(wiring?.ownership).toBe("generated");
    expect(runtimeDependencies).toEqual([{ element: "links", name: "@jeeves/service-runtime" }]);
    const dockerfile = files.find((f) => f.path.endsWith("/Dockerfile"))?.contents;
    expect(dockerfile).toContain("COPY services/links/package.json services/links/");
  });

  it("builds from the project root, publishes on loopback, and checks /ready", () => {
    const service = generate(ctxFor({ config: { port: 9090, logLevel: "debug" } })).compose.services
      ?.links;
    expect(service).toMatchObject({
      build: { context: ".", dockerfile: "services/links/Dockerfile" },
      environment: { PORT: "9090", LOG_LEVEL: "debug", SHUTDOWN_TIMEOUT_MS: "10000" },
      ports: ["127.0.0.1::9090"],
      restart: "unless-stopped",
      stop_grace_period: "15s",
    });
    expect(service?.healthcheck?.test.join(" ")).toContain("http://127.0.0.1:9090/ready");
  });

  it("wires nothing extra for a service alone", () => {
    const source = wiringSource(ctxFor());
    expect(source).not.toContain("postgres-runtime");
    expect(source).not.toContain("rest-server");
    expect(source).toContain("dependencies: [],");
    expect(source).toContain('defaults: { port: 8080, logLevel: "info" },');
  });

  it("wires a connected database and a REST server", () => {
    const source = wiringSource(ctxFor({ database: true, restServer: { basePath: "/v1" } }));
    expect(source).toContain('import { postgresDependency } from "@jeeves/postgres-runtime";');
    expect(source).toContain('name: "main-db",');
    expect(source).toContain('migrationsFolder: path("../migrations"),');
    expect(source).toContain("dependencies: [database],");
    expect(source).toContain('contract: path("../../../contracts/links.openapi.yaml"),');
    expect(source).toContain('basePath: "/v1",');
    expect(source).toContain('auth: "none",');
  });

  it("is deterministic", () => {
    const options = { database: true, restServer: {} };
    expect(generate(ctxFor(options))).toEqual(generate(ctxFor(options)));
  });
});
