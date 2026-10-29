import { describe, expect, it } from "vitest";
import { lockFor, lockToJson } from "./lock.ts";
import { templateSet } from "./modules.ts";
import { GenerationError, planProject } from "./plan.ts";
import { fixtureDesign } from "./test-support.ts";

const templates = templateSet();
const design = fixtureDesign("link-shortener");
const golden = (path: string) => `../golden/link-shortener/${path}`;

describe("planProject", () => {
  const plan = planProject(design, templates, { projectName: "Shorty" });

  // Golden files: `pnpm vitest run packages/generator -u` rewrites them after a deliberate change.
  it.each(plan.files.map((f) => [f.path, f] as const))(
    "%s matches its golden file",
    async (_, file) => {
      await expect(file.contents).toMatchFileSnapshot(golden(file.path));
    },
  );

  it("the lock matches its golden file", async () => {
    await expect(lockToJson(lockFor(plan, design.revision))).toMatchFileSnapshot(
      golden("jeeves/lock.json"),
    );
  });

  it("is deterministic: planning the same design again gives identical output", () => {
    const again = planProject(structuredClone(design), templateSet(), { projectName: "Shorty" });
    expect(again.files).toEqual(plan.files);
    expect(lockToJson(lockFor(again, design.revision))).toBe(
      lockToJson(lockFor(plan, design.revision)),
    );
  });

  it("lays the project out per PLAN §9 and marks ownership", () => {
    const ownership = Object.fromEntries(plan.files.map((f) => [f.path, f.ownership]));
    expect(ownership).toMatchObject({
      "docker-compose.yml": "generated",
      "AGENTS.md": "generated",
      "jeeves/design.json": "generated",
      "jeeves/elements/links.md": "generated",
      "jeeves/elements/links-db.md": "generated",
      "jeeves/elements/web.md": "generated",
      "services/links/src/jeeves.generated.ts": "generated",
      "services/links/src/main.ts": "scaffold",
      "frontends/web/src/clients/links.generated.ts": "generated",
      "databases/links-db/init/10-consumers.sql": "generated",
      "contracts/links.openapi.yaml": "scaffold",
      "package.json": "scaffold",
      "pnpm-workspace.yaml": "scaffold",
    });
    expect(plan.runtimes.map((r) => r.name)).toEqual([
      "@jeeves/postgres-runtime",
      "@jeeves/rest-client",
      "@jeeves/rest-server",
      "@jeeves/service-runtime",
      "@jeeves/web-runtime",
    ]);
  });

  it("gives each element its owned paths, including contracts it scaffolds", () => {
    expect(plan.elements).toEqual([
      {
        id: "links",
        template: "http-service@0.1.0",
        dir: "services/links",
        ownedPaths: ["contracts/links.openapi.yaml", "services/links/"],
      },
      {
        id: "links-db",
        template: "postgres@0.1.0",
        dir: "databases/links-db",
        ownedPaths: ["databases/links-db/"],
      },
      {
        id: "web",
        template: "web-app@0.1.0",
        dir: "frontends/web",
        ownedPaths: ["frontends/web/"],
      },
    ]);
  });

  it("lists every element and attachment as a test-pack subject", () => {
    expect(plan.subjects).toEqual([
      { element: "links", template: "http-service@0.1.0" },
      { element: "links", attachment: "links-api", template: "rest-api-server@0.1.0" },
      { element: "links-db", template: "postgres@0.1.0" },
      { element: "web", template: "web-app@0.1.0" },
      { element: "web", attachment: "web-links-client", template: "rest-api-client@0.1.0" },
    ]);
  });

  it("puts the notes and every template's agent guide in the element notes file", () => {
    const notes = plan.files.find((f) => f.path === "jeeves/elements/links.md")?.contents ?? "";
    expect(notes).toContain("Create short links; redirect GET /:code with 302; count clicks.");
    expect(notes).toContain("POST /links creates a short link from a URL.");
    expect(notes).toContain("# Working with an http-service element");
    expect(notes).toContain("<!-- Agent guide for rest-api-server@0.1.0 -->");
    expect(notes).toContain('"basePath": "/api"');
  });

  it("refuses an element that needs a template", () => {
    expect(() => planProject(fixtureDesign("incomplete"), templates, { projectName: "x" })).toThrow(
      GenerationError,
    );
  });
});
