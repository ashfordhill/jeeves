import { discourseCoreExample } from "@jeeves/spec";
import { expect, it } from "vitest";
import { buildTestApp, openTestDb } from "../test-support.ts";
import { DESIGN_OPERATION_BODY_LIMIT } from "./projects.ts";

it("accepts the complete design snapshot, preserves history and rejects oversized edits before mutation", async () => {
  const { db, close } = await openTestDb(),
    app = buildTestApp(db);
  try {
    const project = (
      await app.inject({ method: "POST", url: "/projects", payload: { name: "P71b body bound" } })
    ).json().project;
    const source = discourseCoreExample().design;
    const ops = [
      ...source.elements.map((element) => ({ op: "addElement", element })),
      ...source.connections.map((connection) => ({ op: "connect", connection })),
      { op: "setArchitecture", architecture: source.architecture },
    ];
    const payload = { baseRevision: 0, source: "api", ops };
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeGreaterThan(1024 * 1024);
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThan(DESIGN_OPERATION_BODY_LIMIT);
    const edited = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/operations`,
      payload,
    });
    expect(edited.statusCode, edited.body.slice(0, 500)).toBe(200);
    expect(edited.json().design.architecture.backend.hooks).toHaveLength(8);
    const revision = edited.json().design.revision;
    const oversized = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/operations`,
      payload: { ...payload, pad: "x".repeat(DESIGN_OPERATION_BODY_LIMIT) },
    });
    expect(oversized.statusCode).toBe(413);
    const current = (
      await app.inject({ method: "GET", url: `/projects/${project.id}/design` })
    ).json();
    expect(current.design.revision).toBe(revision);
    expect(current.design.architecture).toEqual(edited.json().design.architecture);
    const otherRoute = await app.inject({
      method: "POST",
      url: "/projects",
      payload: { name: "Bound unchanged", pad: "x".repeat(1024 * 1024) },
    });
    expect(otherRoute.statusCode).toBe(413);
  } finally {
    await app.close();
    await close();
  }
});
