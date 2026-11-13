import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DesignDocument } from "@jeeves/spec";
import { expect, test } from "vitest";
import { type Application, withApplication } from "../harness/application.ts";
import { hash, sourceSnapshot } from "../harness/process.ts";
import {
  diskHashes,
  expiryBehavior,
  fixtureRoot,
  preservation,
  regenerationTemplates,
  resumed,
  retainedData,
  update,
  verifyTransition,
} from "../harness/regeneration.ts";

test("B10: independent A/B TTL behavior and public regeneration retain owned code, runtime and durable data", async () => {
  let oracle: Pick<Application, "manifest" | "manifestHash" | "report"> | undefined;
  await withApplication(
    "regeneration",
    regenerationTemplates,
    async (app) => {
      await expiryBehavior(app, "b", "fresh-b");
      await app.scaffoldCheck("fresh-b");
      oracle = { manifest: app.manifest, manifestHash: app.manifestHash, report: app.report };
    },
    "design-b.json",
  );
  expect(oracle).toBeDefined();
  const freshB = oracle;
  if (!freshB) throw new Error("Fresh B was not independently verified");
  await withApplication("regeneration", regenerationTemplates, async (app) => {
    const source = await sourceSnapshot();
    const a = JSON.parse(
      await readFile(join(fixtureRoot, "design.json"), "utf8"),
    ) as DesignDocument;
    const b = JSON.parse(
      await readFile(join(fixtureRoot, "design-b.json"), "utf8"),
    ) as DesignDocument;
    const expectedB = structuredClone(a);
    expectedB.revision++;
    const cache = expectedB.architecture?.studio?.elements.find(
      (row) => row.element === "catalog-cache",
    );
    if (cache?.settings.kind !== "cache") throw new Error("Fixture cache is absent");
    expect(cache.settings.ttlSeconds).toBe(4);
    cache.settings.ttlSeconds = 16;
    expect(b).toEqual(expectedB);
    const marker = `retained-${randomUUID()}`;
    // This row is not in the re-runnable product SQL and cannot be recreated by startup.
    await app.sql(
      `INSERT INTO m_catalog_writer.records VALUES ('retained-published', '${marker}', 'published')`,
      "d_catalog",
    );
    await expiryBehavior(app, "a", "fresh-a");
    const dataBefore = await retainedData(app);
    expect(dataBefore.count).toBe(3);
    expect(dataBefore.records.map((row) => row.id)).toEqual([
      "draft-a",
      "published-a",
      "retained-published",
    ]);
    expect(dataBefore.records.find((row) => row.id === "retained-published")?.title).toBe(marker);
    const before = await preservation(app);
    await app.save("preservation-before.json", { ...before, data: dataBefore });
    await app.scaffoldCheck("before-update");
    await app.execute("update-stop", "pnpm", ["stop"], 180000);
    expect((await app.compose(["ps", "--status", "running", "-q"])).trim()).toBe("");
    const stopped = await diskHashes(app);
    const plan = await update(app, "update-plan", true);
    expect(plan.counts.replace).toBeGreaterThan(0);
    expect(await diskHashes(app)).toEqual(stopped);
    const applied = await update(app, "update-apply", false);
    expect({ ...applied, check: true }).toEqual(plan);
    expect(await preservation(app)).toEqual(before);
    await verifyTransition(app, freshB);
    await resumed(app);
    const dataAfter = await retainedData(app);
    const after = await preservation(app);
    await app.save("update-preservation.json", {
      before,
      after,
      dataBefore,
      dataAfter,
      planWasReadOnly: true,
    });
    expect(after).toEqual(before);
    expect(dataAfter).toEqual(dataBefore);
    expect(await app.request("/api/catalog-api/modules/catalog-read/retained-published")).toEqual({
      status: 200,
      body: { id: "retained-published", title: marker, state: "published" },
    });
    await expiryBehavior(app, "b", "updated-b");
    const finalBefore = await diskHashes(app);
    const checked = await update(app, "update-final-check", true);
    expect(checked.counts.replace).toBe(0);
    expect(await diskHashes(app)).toEqual(finalBefore);
    await app.scaffoldCheck("final-b");
    expect((await sourceSnapshot()).sha256).toBe(source.sha256);
    await app.save("inputs.json", {
      designA: hash(await readFile(join(fixtureRoot, "design.json"))),
      designB: hash(await readFile(join(fixtureRoot, "design-b.json"))),
      source: source.sha256,
    });
  });
});
