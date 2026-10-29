import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DesignDocument } from "@jeeves/spec";
import { afterAll, describe, expect, it } from "vitest";
import { type BaselineEvent, runBaseline } from "../src/baseline/index.ts";
import { generateProject } from "../src/generate.ts";
import { fixtureDesign } from "../src/test-support.ts";

// The S10 acceptance fixture: service + REST server + Postgres + web app + client.
const design = fixtureDesign("link-shortener");
const dir = mkdtempSync(join(tmpdir(), "jeeves-baseline-"));

afterAll(() => {
  execFileSync("docker", ["compose", "down", "--volumes", "--rmi", "local"], {
    cwd: dir,
    stdio: "ignore",
  });
  rmSync(dir, { recursive: true, force: true });
});

async function generateAndCheck(next: DesignDocument) {
  const generated = await generateProject({ dir, design: next, projectName: "Shorty" });
  if (!generated.ok) throw new Error(JSON.stringify(generated.problems));
  const events: BaselineEvent[] = [];
  const result = await runBaseline({
    dir,
    design: next,
    subjects: generated.plan.subjects,
    onEvent: (event) => events.push(event),
  });
  const failures = result.checks.filter((c) => c.status === "failed");
  if (!result.ok) {
    const logs = events.flatMap((e) => (e.type === "log" ? [e.line] : [])).slice(-80);
    throw new Error(
      `Baseline failed: ${JSON.stringify(result.steps)}\n${JSON.stringify(failures)}\n${logs.join("\n")}`,
    );
  }
  return { generated, result };
}

describe("generator baseline: the link-shortener fixture", () => {
  it("generates a project whose baseline is green", async () => {
    const { generated, result } = await generateAndCheck(design);
    expect(generated.git).toBe("initialized");
    expect(result.steps.map((s) => [s.step, s.status])).toEqual([
      ["install", "passed"],
      ["typecheck", "passed"],
      ["compose-up", "passed"],
      ["test-packs", "passed"],
      ["compose-down", "passed"],
    ]);
    // Every template's pack ran for its subject.
    expect([...new Set(result.checks.map((c) => `${c.template} ${c.subject}`))]).toEqual([
      "web-app@0.1.0 web",
      "rest-api-client@0.1.0 web/web-links-client",
      "rest-api-server@0.1.0 links/links-api",
      "postgres@0.1.0 links-db",
      "http-service@0.1.0 links",
    ]);
    expect(result.checks.every((c) => c.status === "passed")).toBe(true);
  });

  it("stays green after adding an element, with project-owned edits kept", async () => {
    const feature = join(dir, "services/links/src/features/ping/index.ts");
    const edited = readFileSync(feature, "utf8").replace("Project-owned:", "Project-owned (kept):");
    writeFileSync(feature, edited);
    const next = structuredClone(design);
    next.revision += 1;
    next.elements.push({
      id: "stats",
      name: "Stats service",
      template: { id: "http-service", version: "0.1.0" },
      config: { port: 8081 },
      attachments: [],
      notes: "Counts clicks per day.",
    });
    next.connections.push({
      id: "stats-uses-db",
      kind: "uses-database",
      from: { element: "stats" },
      to: { element: "links-db" },
    });

    const { generated, result } = await generateAndCheck(next);
    expect(generated.git).toBe("existing");
    expect(generated.kept).toContain("services/links/src/features/ping/index.ts");
    expect(readFileSync(feature, "utf8")).toBe(edited);
    expect(result.checks.some((c) => c.subject === "stats" && c.id === "ready")).toBe(true);
  });
});
