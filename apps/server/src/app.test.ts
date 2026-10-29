import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";

describe("GET /health", () => {
  it("reports ok when the database answers", async () => {
    const app = buildApp({ pingDb: async () => {}, version: "0.0.0-test" });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", database: "ok", version: "0.0.0-test" });
  });

  it("returns 503 when the database is unreachable", async () => {
    const app = buildApp({
      pingDb: async () => {
        throw new Error("connection refused");
      },
      version: "0.0.0-test",
    });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: "degraded", database: "unreachable" });
  });
});
