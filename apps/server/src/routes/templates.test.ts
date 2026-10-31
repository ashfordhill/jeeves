import { describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import type { Db } from "../db/client.ts";

// Template routes only read the registry.
const app = buildApp({ db: {} as Db, pingDb: async () => {}, version: "0.0.0-test" });

describe("templates", () => {
  it("lists every template with the palette grouping", async () => {
    const res = await app.inject({ method: "GET", url: "/templates" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(
      body.templates.map((t: { id: string; version: string }) => `${t.id}@${t.version}`).sort(),
    ).toEqual([
      "durable-events@0.1.0",
      "http-service@0.1.0",
      "http-service@0.2.0",
      "postgres@0.1.0",
      "resource-workspace@0.1.0",
      "rest-api-client@0.1.0",
      "rest-api-server@0.1.0",
      "web-app@0.1.0",
      "web-app@0.2.0",
    ]);
    expect(body.palette).toEqual([
      { group: "Services", templates: [{ id: "http-service", version: "0.2.0" }] },
      { group: "Frontends", templates: [{ id: "web-app", version: "0.2.0" }] },
      { group: "Data", templates: [{ id: "postgres", version: "0.1.0" }] },
    ]);
  });

  it("describes the latest or a specific version", async () => {
    const latest = (await app.inject({ method: "GET", url: "/templates/http-service" })).json();
    expect(latest.template).toMatchObject({ id: "http-service", kind: "element" });
    expect(latest.template.configJsonSchema).toMatchObject({ type: "object" });

    const exact = await app.inject({ method: "GET", url: "/templates/postgres/0.1.0" });
    expect(exact.json().template).toMatchObject({ id: "postgres", version: "0.1.0" });

    expect((await app.inject({ method: "GET", url: "/templates/nope" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/templates/postgres/9.9.9" })).statusCode).toBe(
      404,
    );
  });
});
