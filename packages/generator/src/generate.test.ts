import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DesignDocument } from "@jeeves/spec";
import { afterEach, describe, expect, it } from "vitest";
import { LOCK_PATH } from "./documents.ts";
import { type GenerateProjectResult, generateProject } from "./generate.ts";
import { readLock } from "./lock.ts";
import { fakeVendor, fixtureDesign } from "./test-support.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-generator-"));
  dirs.push(dir);
  return dir;
}

const generate = (dir: string, design: DesignDocument, git = false) =>
  generateProject({ dir, design, projectName: "Shorty", vendor: fakeVendor, git });

function ok(result: GenerateProjectResult) {
  if (!result.ok) throw new Error(`expected success: ${JSON.stringify(result.problems)}`);
  return result;
}

const read = (dir: string, path: string) => readFileSync(join(dir, path), "utf8");

/** The fixture plus a second web app ("admin") that calls the links API. */
function withAdmin(design: DesignDocument): DesignDocument {
  const next = structuredClone(design);
  next.revision += 1;
  next.elements.push({
    id: "admin",
    name: "Admin",
    template: { id: "web-app", version: "0.1.0" },
    config: { title: "Admin", port: 5174 },
    attachments: [
      {
        id: "admin-links-client",
        template: { id: "rest-api-client", version: "0.1.0" },
        config: {},
        notes: "",
      },
    ],
    notes: "Lists every link.",
  });
  next.connections.push({
    id: "admin-calls-links",
    kind: "calls",
    from: { element: "admin", attachment: "admin-links-client" },
    to: { element: "links", attachment: "links-api" },
  });
  return next;
}

/** Every file under `dir` except `.git`, with its contents. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const files = execFileSync("find", [".", "-type", "f", "-not", "-path", "./.git/*"], {
    cwd: dir,
    encoding: "utf8",
  });
  for (const file of files.trim().split("\n").sort()) out[file.slice(2)] = read(dir, file);
  return out;
}

describe("generateProject", () => {
  const design = fixtureDesign("link-shortener");

  it("writes the same bytes for the same design, and a rerun changes nothing", async () => {
    const a = tempDir();
    const b = tempDir();
    const first = ok(await generate(a, design));
    ok(await generate(b, design));
    expect(snapshot(a)).toEqual(snapshot(b));
    expect(first.firstGeneration).toBe(true);

    const before = snapshot(a);
    const again = ok(await generate(a, design));
    expect(again.written).toEqual([]);
    expect(again.scaffolded).toEqual([]);
    expect(again.packages).toEqual([]);
    expect(again.firstGeneration).toBe(false);
    expect(snapshot(a)).toEqual(before);
  });

  it("records generated-owned files with hashes, the runtimes, and the elements in the lock", async () => {
    const dir = tempDir();
    const result = ok(await generate(dir, design));
    const lock = readLock(dir);
    expect(lock).toEqual(result.lock);
    expect(Object.keys(lock?.files ?? {})).toContain("docker-compose.yml");
    expect(Object.keys(lock?.files ?? {})).not.toContain("services/links/src/main.ts");
    expect(lock?.files["docker-compose.yml"]).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(lock?.designRevision).toBe(design.revision);
    expect(lock?.runtimes.map((r) => r.tarball)).toContain(
      "vendor/jeeves/jeeves-service-runtime-0.1.0.tgz",
    );
  });

  it("adds runtime and package dependencies to each element's package.json", async () => {
    const dir = tempDir();
    ok(await generate(dir, design));
    const service = JSON.parse(read(dir, "services/links/package.json"));
    expect(service.dependencies).toMatchObject({
      "@jeeves/service-runtime": "file:../../vendor/jeeves/jeeves-service-runtime-0.1.0.tgz",
      "@jeeves/rest-server": "file:../../vendor/jeeves/jeeves-rest-server-0.2.0.tgz",
      "@jeeves/postgres-runtime": "file:../../vendor/jeeves/jeeves-postgres-runtime-0.1.0.tgz",
      "drizzle-orm": "0.45.4",
    });
    const web = JSON.parse(read(dir, "frontends/web/package.json"));
    expect(web.scripts.pretypecheck).toBe("jeeves-rest-client-types");
  });

  it("regenerating after adding an element keeps project-owned files untouched", async () => {
    const dir = tempDir();
    ok(await generate(dir, design));
    // What an agent or a person would have changed in project-owned files.
    const feature = "services/links/src/features/ping/index.ts";
    writeFileSync(join(dir, feature), "// implemented by hand\n");
    const pkgPath = "services/links/package.json";
    const pkg = JSON.parse(read(dir, pkgPath));
    pkg.dependencies.nanoid = "5.1.6";
    pkg.dependencies["drizzle-orm"] = "0.45.5";
    writeFileSync(join(dir, pkgPath), `${JSON.stringify(pkg, null, 2)}\n`);
    writeFileSync(join(dir, "contracts/links.openapi.yaml"), "# changed contract\n");

    const result = ok(await generate(dir, withAdmin(design)));

    expect(read(dir, feature)).toBe("// implemented by hand\n");
    expect(read(dir, "contracts/links.openapi.yaml")).toBe("# changed contract\n");
    const after = JSON.parse(read(dir, pkgPath));
    expect(after.dependencies.nanoid).toBe("5.1.6");
    expect(after.dependencies["drizzle-orm"]).toBe("0.45.5");
    expect(result.kept).toContain(feature);
    expect(result.scaffolded).toContain("frontends/admin/package.json");
    expect(result.written).toContain("frontends/admin/src/clients/links.generated.ts");
    expect(result.written).toContain("docker-compose.yml");
    expect(read(dir, "docker-compose.yml")).toContain("  admin:\n");
    expect(JSON.parse(read(dir, "frontends/admin/package.json")).dependencies).toHaveProperty(
      "@jeeves/web-runtime",
    );
    expect(readLock(dir)?.elements.map((e) => e.id)).toEqual(["links", "links-db", "web", "admin"]);
  });

  it("a hand-edited generated-owned file stops regeneration and nothing is written", async () => {
    const dir = tempDir();
    ok(await generate(dir, design));
    const compose = `${read(dir, "docker-compose.yml")}# tuned by hand\n`;
    writeFileSync(join(dir, "docker-compose.yml"), compose);
    const before = snapshot(dir);

    const result = await generate(dir, withAdmin(design));

    expect(result).toEqual({
      ok: false,
      reason: "ownership",
      problems: [
        {
          path: "docker-compose.yml",
          kind: "edited",
          message: expect.stringContaining("docker-compose.yml was changed by hand"),
        },
      ],
    });
    expect(snapshot(dir)).toEqual(before);
    expect(existsSync(join(dir, "frontends/admin"))).toBe(false);
  });

  it("refuses to overwrite a file Jeeves would generate but didn't", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "docker-compose.yml"), "services: {}\n");
    const result = await generate(dir, design);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problems.map((p) => [p.path, p.kind])).toEqual([
      ["docker-compose.yml", "unmanaged"],
    ]);
    expect(existsSync(join(dir, LOCK_PATH))).toBe(false);
  });

  it("generates a deleted generated-owned file again", async () => {
    const dir = tempDir();
    ok(await generate(dir, design));
    const expected = read(dir, "services/links/src/jeeves.generated.ts");
    rmSync(join(dir, "services/links/src/jeeves.generated.ts"));
    const result = ok(await generate(dir, design));
    expect(result.written).toEqual(["services/links/src/jeeves.generated.ts"]);
    expect(read(dir, "services/links/src/jeeves.generated.ts")).toBe(expected);
  });

  it("reports removed elements and leaves their files in place", async () => {
    const dir = tempDir();
    ok(await generate(dir, withAdmin(design)));
    const result = ok(await generate(dir, { ...design, revision: design.revision + 2 }));
    expect(result.removedElements.map((e) => e.id)).toEqual(["admin"]);
    expect(result.orphaned).toEqual([
      "frontends/admin/nginx/default.conf.template",
      "frontends/admin/nginx/jeeves-config.json.template",
      "frontends/admin/src/clients/links.generated.ts",
      "frontends/admin/src/jeeves.generated.ts",
      "jeeves/elements/admin.md",
    ]);
    expect(existsSync(join(dir, "frontends/admin/src/jeeves.generated.ts"))).toBe(true);
    expect(read(dir, "docker-compose.yml")).not.toContain("  admin:\n");
    expect(Object.keys(readLock(dir)?.files ?? {})).not.toContain("jeeves/elements/admin.md");
  });

  it("initializes a git repository with an initial commit, once", async () => {
    const dir = tempDir();
    const first = ok(await generate(dir, design, true));
    expect(first.git).toBe("initialized");
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
    expect(git("log", "--format=%s")).toBe(
      `Generate template project from design revision ${design.revision}`,
    );
    expect(git("status", "--porcelain")).toBe("");
    expect(git("ls-files")).toContain(LOCK_PATH);

    const second = ok(await generate(dir, withAdmin(design), true));
    expect(second.git).toBe("existing");
    expect(git("rev-list", "--count", "HEAD")).toBe("1");
  });

  it("doesn't start a repository inside an existing one", async () => {
    const parent = tempDir();
    execFileSync("git", ["init", "--quiet"], { cwd: parent });
    const dir = join(parent, "app");
    mkdirSync(dir);
    const result = ok(await generate(dir, design, true));
    expect(result.git).toBe("existing");
    expect(existsSync(join(dir, ".git"))).toBe(false);
  });
});
