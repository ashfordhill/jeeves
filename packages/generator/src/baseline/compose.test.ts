import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  assertComposeEnvironment,
  missingComposeEnvironment,
  parseEnvFile,
  requiredComposeVariables,
} from "./compose.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(compose: string, env?: string): string {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-compose-env-"));
  dirs.push(dir);
  writeFileSync(join(dir, "docker-compose.yml"), compose);
  if (env !== undefined) writeFileSync(join(dir, ".env"), env);
  return dir;
}

const compose = `services:
  api:
    environment:
      PUBLIC_ORIGIN: \${QRWTY_PUBLIC_ORIGIN:?Set the public origin}
      DATABASE_PASSWORD: \${DB_QRWTY_PASSWORD:?Set the database password}
      OPTIONAL: \${OPTIONAL:-default}
      PLAIN: \${NOT_REQUIRED}
`;

describe("compose environment preflight", () => {
  it("finds only ${VAR:?} requirements, in file order", () => {
    expect(requiredComposeVariables(compose)).toEqual(["QRWTY_PUBLIC_ORIGIN", "DB_QRWTY_PASSWORD"]);
  });

  it("reads .env values with quotes and comments", () => {
    expect(
      parseEnvFile(
        [
          "# comment",
          "QRWTY_PUBLIC_ORIGIN=http://127.0.0.1:5173",
          'DB_QRWTY_PASSWORD="secret value"',
          "export OPTIONAL='quoted'",
          "TRAILING=value # a comment",
        ].join("\n"),
      ),
    ).toEqual({
      QRWTY_PUBLIC_ORIGIN: "http://127.0.0.1:5173",
      DB_QRWTY_PASSWORD: "secret value",
      OPTIONAL: "quoted",
      TRAILING: "value",
    });
  });

  it("reports variables missing from both .env and the environment", () => {
    const missingFile = project(compose);
    expect(missingComposeEnvironment(missingFile, {})).toEqual([
      "QRWTY_PUBLIC_ORIGIN",
      "DB_QRWTY_PASSWORD",
    ]);
    expect(() => assertComposeEnvironment(missingFile, {})).toThrow(
      `Missing required environment: QRWTY_PUBLIC_ORIGIN, DB_QRWTY_PASSWORD. Add them to ${join(missingFile, ".env")}.`,
    );
    const fromFile = project(compose, "QRWTY_PUBLIC_ORIGIN=http://127.0.0.1:5173\n");
    expect(missingComposeEnvironment(fromFile, { DB_QRWTY_PASSWORD: "secret" })).toEqual([]);
    expect(
      missingComposeEnvironment(fromFile, { QRWTY_PUBLIC_ORIGIN: "", DB_QRWTY_PASSWORD: "" }),
    ).toEqual(["QRWTY_PUBLIC_ORIGIN", "DB_QRWTY_PASSWORD"]);
  });

  it("does nothing when there is no compose file", () => {
    const dir = mkdtempSync(join(tmpdir(), "jeeves-compose-none-"));
    dirs.push(dir);
    expect(() => assertComposeEnvironment(dir, {})).not.toThrow();
  });
});
