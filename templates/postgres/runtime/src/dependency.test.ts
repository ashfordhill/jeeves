import { describe, expect, it } from "vitest";
import { postgresDependency } from "./dependency.ts";

describe("postgresDependency", () => {
  it("reports environment problems instead of throwing", () => {
    const dependency = postgresDependency({ name: "main-db" });
    expect(dependency.configure({ DATABASE_POOL_MAX: "0" })).toEqual([
      "DATABASE_URL is required",
      'DATABASE_POOL_MAX must be a whole number from 1 to 100 (got "0")',
    ]);
    expect(dependency.configure({ DATABASE_URL: "postgres://a:b@db:5432/a" })).toEqual([]);
  });

  it("isn't ready, and refuses queries, before the service starts it", async () => {
    const dependency = postgresDependency({ name: "main-db" });
    expect(await dependency.ready()).toEqual({ ok: false, error: "not started" });
    expect(() => dependency.db).toThrow('Database "main-db" used before the service started');
    await dependency.close();
  });
});
