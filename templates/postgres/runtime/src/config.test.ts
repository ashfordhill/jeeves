import { describe, expect, it } from "vitest";
import { DatabaseConfigError, databaseConfigFromEnv } from "./config.ts";

describe("databaseConfigFromEnv", () => {
  it("applies defaults", () => {
    expect(databaseConfigFromEnv({ DATABASE_URL: "postgres://a:b@db:5432/a" })).toEqual({
      url: "postgres://a:b@db:5432/a",
      poolMax: 5,
      connectTimeoutMs: 5000,
      migrationsFolder: "migrations",
    });
  });

  it("reads overrides", () => {
    const config = databaseConfigFromEnv({
      DATABASE_URL: "postgresql://a@db/a",
      DATABASE_POOL_MAX: "12",
      DATABASE_CONNECT_TIMEOUT_MS: "250",
      DATABASE_MIGRATIONS: "db/migrations",
    });
    expect(config).toMatchObject({
      poolMax: 12,
      connectTimeoutMs: 250,
      migrationsFolder: "db/migrations",
    });
  });

  it("reports every problem at once, readably", () => {
    try {
      databaseConfigFromEnv({ DATABASE_URL: "mysql://x", DATABASE_POOL_MAX: "0" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseConfigError);
      expect((error as DatabaseConfigError).problems).toEqual([
        "DATABASE_URL must start with postgres:// or postgresql://",
        'DATABASE_POOL_MAX must be a whole number from 1 to 100 (got "0")',
      ]);
      expect((error as Error).message).toContain("Invalid database environment:\n  - DATABASE_URL");
    }
  });

  it("requires DATABASE_URL", () => {
    expect(() => databaseConfigFromEnv({})).toThrow("DATABASE_URL is required");
  });
});
