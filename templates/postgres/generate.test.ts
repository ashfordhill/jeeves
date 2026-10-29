import { composeToYaml, createGenerateContext, mergeCompose } from "@jeeves/template-kit";
import { describe, expect, it } from "vitest";
import { lookup, sharedDatabaseDesign } from "./conformance/fixtures/design.ts";
import { generate, initSql } from "./generate.ts";

const generateFor = (extra: string[] = []) =>
  generate(createGenerateContext(sharedDatabaseDesign(extra), lookup, "main-db"));

describe("postgres generate", () => {
  it("writes one role and database per consumer, sorted, as generated-owned SQL", () => {
    const result = generateFor(["audit"]);
    const init = result.files.find((f) => f.path === "databases/main-db/init/10-consumers.sql");
    expect(init?.ownership).toBe("generated");
    const order = ["audit", "links", "stats"].map((id) =>
      init?.contents.indexOf(`-- ${id} service`),
    );
    expect(order).toEqual([...order].sort((a = 0, b = 0) => a - b));
    expect(init?.contents).toContain(`CREATE DATABASE "links" OWNER "links"`);
    expect(init?.contents).toContain(`REVOKE CONNECT ON DATABASE "links" FROM PUBLIC;`);
  });

  it("scaffolds a schema, drizzle config, and empty journal in each consumer", () => {
    const scaffold = generateFor().files.filter((f) => f.ownership === "scaffold");
    expect(scaffold.map((f) => f.path)).toEqual([
      "services/links/drizzle.config.ts",
      "services/links/migrations/meta/_journal.json",
      "services/links/src/db/schema.ts",
      "services/stats/drizzle.config.ts",
      "services/stats/migrations/meta/_journal.json",
      "services/stats/src/db/schema.ts",
    ]);
    const schema = scaffold.find((f) => f.path === "services/links/src/db/schema.ts");
    expect(schema?.contents).toContain(`links service's own database, served by the "Main DB"`);
  });

  it("wires each consumer with DATABASE_URL and waits for the database and init job", () => {
    const { compose, runtimeDependencies } = generateFor();
    expect(compose.services?.links).toEqual({
      environment: { DATABASE_URL: "postgres://links:links-local@main-db:5432/links" },
      depends_on: {
        "main-db": { condition: "service_healthy" },
        "main-db-init": { condition: "service_completed_successfully" },
      },
    });
    expect(compose.services?.["main-db"]?.image).toBe("postgres:17-alpine");
    expect(compose.volumes).toEqual({ "main-db-data": {} });
    expect(runtimeDependencies).toEqual([
      { element: "links", name: "@jeeves/postgres-runtime" },
      { element: "stats", name: "@jeeves/postgres-runtime" },
    ]);
  });

  it("is deterministic regardless of connection order", () => {
    const design = sharedDatabaseDesign(["audit"]);
    const reversed = { ...design, connections: [...design.connections].reverse() };
    const a = generate(createGenerateContext(design, lookup, "main-db"));
    const b = generate(createGenerateContext(reversed, lookup, "main-db"));
    expect(b.files).toEqual(a.files);
    expect(composeToYaml(mergeCompose([b.compose]))).toBe(composeToYaml(mergeCompose([a.compose])));
  });

  it("still generates the database with no consumers", () => {
    expect(initSql("solo", [])).not.toContain("CREATE ROLE");
  });

  it("refuses an element ID that clashes with the init job", () => {
    const design = sharedDatabaseDesign();
    const [first] = design.elements;
    if (first) design.elements.push({ ...first, id: "main-db-init", name: "Clash" });
    expect(() => generate(createGenerateContext(design, lookup, "main-db"))).toThrow(/clashes/);
  });
});
