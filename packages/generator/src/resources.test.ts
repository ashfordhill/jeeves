import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type DesignDocument, type ResourceConfig, validateDesign } from "@jeeves/spec";
import { afterEach, describe, expect, it } from "vitest";
import { generateProject } from "./generate.ts";
import { hashContents, readLock } from "./lock.ts";
import { templateSet } from "./modules.ts";
import { planProject } from "./plan.ts";
import { fakeVendor, fixtureDesign } from "./test-support.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-resources-"));
  dirs.push(dir);
  return dir;
};
const model = (d: DesignDocument) => d.elements[0]!.attachments[0]!.config.model as ResourceConfig;
const generate = (dir: string, design: DesignDocument) =>
  generateProject({ dir, design, projectName: "Resources", vendor: fakeVendor, git: false });
const contents = (dir: string, p: string) => readFileSync(join(dir, p), "utf8");
const snapshot = (dir: string): Record<string, string> =>
  Object.fromEntries(
    readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => {
        const p = join(d.parentPath, d.name);
        return [p.slice(dir.length), readFileSync(p, "utf8")];
      }),
  );

describe("deterministic resource generation", () => {
  it("generates contracts, standard routes, clients, secret wiring and stable storage", () => {
    const design = fixtureDesign("resources");
    expect(validateDesign(design, templateSet().lookup)).toEqual([]);
    const plan = planProject(design, templateSet(), { projectName: "Resources" });
    expect(plan).toEqual(planProject(design, templateSet(), { projectName: "Resources" }));
    const files = Object.fromEntries(plan.files.map((f) => [f.path, f]));
    expect(files["contracts/links.openapi.yaml"]!.ownership).toBe("generated");
    expect(files["contracts/links.openapi.yaml"]!.contents).toContain("createQr");
    expect(files["services/links/src/generated/routes.ts"]!.contents).toContain("resourceServer");
    expect(files["frontends/web/src/clients/links.openapi.ts"]!.contents).toContain("destination");
    expect(files["frontends/web/src/clients/links.generated.ts"]!.contents).not.toContain(
      "links}/api",
    );
    expect(plan.compose.services!.links!.environment).toMatchObject({
      DATABASE_PASSWORD: "${DB_LINKS_PASSWORD:?Set the isolated consumer database password}",
      PUBLIC_ORIGIN: "${LINKS_PUBLIC_ORIGIN:?Set the deployment public origin}",
    });
    expect(files["services/links/resource-migrations/0001.sql"]!.contents).toContain(
      "REFERENCES app_user(id)",
    );
    expect(files["services/links/src/features/activity/index.ts"]!.ownership).toBe("scaffold");
    expect(plan.elements.find((e) => e.id === "links")!.ownedPaths).not.toContain(
      "contracts/links.openapi.yaml",
    );
  });
  it("preserves custom code, immutable SQL and bytes on repeated generation; nullable additions and renames migrate safely", async () => {
    const dir = temp();
    const d = fixtureDesign("resources");
    expect((await generate(dir, d)).ok).toBe(true);
    const migration = contents(dir, "services/links/resource-migrations/0001.sql");
    const custom = "// custom implementation stays here\n";
    writeFileSync(join(dir, "services/links/src/features/activity/index.ts"), custom);
    const before = snapshot(dir);
    const rerun = await generate(dir, d);
    expect(rerun.ok && rerun.written).toEqual([]);
    expect(snapshot(dir)).toEqual(before);
    model(d).resources[0]!.name = "code";
    model(d).resources[0]!.fields[0]!.name = "target";
    model(d).resources[0]!.fields.push({
      id: "label",
      name: "label",
      type: "text",
      required: false,
      maxLength: 60,
    });
    d.revision++;
    expect((await generate(dir, d)).ok).toBe(true);
    expect(contents(dir, "services/links/resource-migrations/0001.sql")).toBe(migration);
    const sql = contents(dir, "services/links/resource-migrations/0002.sql");
    expect(sql).toContain("ADD COLUMN");
    expect(sql).not.toMatch(/DROP|CREATE TABLE/);
    expect(contents(dir, "services/links/src/features/activity/index.ts")).toBe(custom);
    expect((await generate(dir, d)).ok).toBe(true);
    expect(contents(dir, "services/links/resource-migrations/0002.sql")).toBe(sql);
  });
  it.each(["required-addition", "drop", "narrow", "owner", "relation", "move-store"])(
    "blocks %s before writing anything",
    async (kind) => {
      const dir = temp();
      const d = fixtureDesign("resources");
      await generate(dir, d);
      const before = snapshot(dir);
      const m = model(d);
      const qr = m.resources[0]!;
      if (kind === "required-addition")
        qr.fields.push({
          id: "required",
          name: "required",
          type: "text",
          required: true,
          maxLength: 20,
        });
      if (kind === "drop") qr.fields.pop();
      if (kind === "narrow") {
        const field = qr.fields[1]!;
        if (field.type === "text") field.maxLength = 10;
      }
      if (kind === "owner") {
        qr.access = "internal";
        qr.operations = [];
      }
      if (kind === "relation") qr.belongsTo.push({ id: "scan", resource: "scan", required: true });
      if (kind === "move-store") {
        d.connections[0]!.id = "other-store";
        m.storeConnection = "other-store";
      }
      await expect(generate(dir, d)).rejects.toThrow(/migration|cycle/i);
      expect(snapshot(dir)).toEqual(before);
    },
  );
  it.each(["migration-edit", "migration-delete", "contract-edit"])("refuses %s", async (kind) => {
    const dir = temp();
    const d = fixtureDesign("resources");
    await generate(dir, d);
    if (kind === "migration-delete")
      rmSync(join(dir, "services/links/resource-migrations/0001.sql"));
    else
      writeFileSync(
        join(
          dir,
          kind === "contract-edit"
            ? "contracts/links.openapi.yaml"
            : "services/links/resource-migrations/0001.sql",
        ),
        "-- modified",
      );
    expect(await generate(dir, d)).toMatchObject({ ok: false, reason: "ownership" });
  });
  it("reports changed store targets even when the connection ID is unchanged", async () => {
    const dir = temp();
    const d = fixtureDesign("resources");
    await generate(dir, d);
    const before = snapshot(dir);
    d.elements[1]!.id = "different-db";
    d.connections[0]!.to.element = "different-db";
    await expect(generate(dir, d)).rejects.toThrow(/store changed/);
    expect(snapshot(dir)).toEqual(before);
  });
  it("accepts explicit migration SQL only for the reviewed previous/next model fingerprints", async () => {
    const dir = temp();
    const d = fixtureDesign("resources");
    await generate(dir, d);
    const fromFingerprint = readLock(dir)!.resourceFingerprints!.links!;
    model(d).resources[0]!.fields.push({
      id: "required",
      name: "required",
      type: "text",
      required: true,
      maxLength: 20,
    });
    const toFingerprint = hashContents(JSON.stringify(model(d).resources)).replace("sha256-", "");
    const reviewed = {
      fromFingerprint,
      toFingerprint,
      sql: "-- Explicit human-reviewed migration/backfill\nSELECT 1;",
    };
    const options = { dir, design: d, projectName: "Resources", vendor: fakeVendor, git: false };
    await expect(
      generateProject({
        ...options,
        reviewedMigrations: { links: { ...reviewed, fromFingerprint: "stale" } },
      }),
    ).rejects.toThrow(/fingerprints/);
    const result = await generateProject({ ...options, reviewedMigrations: { links: reviewed } });
    expect(result.ok).toBe(true);
    expect(contents(dir, "services/links/resource-migrations/0002.sql")).toContain(reviewed.sql);
  });
  it("reports retained project-owned implementations when an extension is removed", async () => {
    const dir = temp();
    const d = fixtureDesign("resources");
    await generate(dir, d);
    const path = "services/links/src/features/activity/index.ts";
    writeFileSync(join(dir, path), "// project implementation\n");
    model(d).extensions = [];
    const logs: string[] = [];
    const result = await generateProject({
      dir,
      design: d,
      projectName: "Resources",
      vendor: fakeVendor,
      git: false,
      log: (line) => logs.push(line),
    });
    expect(result.ok && result.kept).toContain(path);
    expect(contents(dir, path)).toBe("// project implementation\n");
    expect(logs.some((l) => l.includes("Removed extension links/activity"))).toBe(true);
  });
});
