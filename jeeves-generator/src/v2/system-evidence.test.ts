import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  privateRedactionsPath,
  rememberSecrets,
  sanitizeArtifacts,
  sanitizeJson,
  sanitizer,
} from "../../integration/harness/evidence.ts";

test("transient identity credentials redact assertion operands and survive later secret registration", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "jeeves-redaction-test-"));
  try {
    const application = join(temporary, "app");
    const password = randomBytes(32).toString("base64url");
    const code = randomBytes(32).toString("base64url");
    await rememberSecrets(application, password);
    await rememberSecrets(application, code);
    const clean = await sanitizer(application);
    expect(clean(JSON.stringify({ expected: password, received: code, safe: "observation" }))).toBe(
      '{"expected":"[REDACTED]","received":"[REDACTED]","safe":"observation"}',
    );
    expect((await readFile(privateRedactionsPath(application), "utf8")).includes(password)).toBe(
      true,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("malformed or symlink private redaction inputs fail closed", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "jeeves-redaction-test-"));
  try {
    const application = join(temporary, "app");
    await mkdir(application);
    const path = privateRedactionsPath(application);
    await writeFile(path, JSON.stringify({ invalid: "shape" }));
    await expect(sanitizer(application)).rejects.toThrow("Invalid private redaction values");
    await rm(path);
    await writeFile(join(temporary, "foreign.json"), "[]");
    await symlink(join(temporary, "foreign.json"), path);
    await expect(sanitizer(application)).rejects.toThrow("Invalid private redaction input");
    await expect(rememberSecrets(application, "never-write")).rejects.toThrow(
      "Invalid private redaction input",
    );
    expect(await readFile(join(temporary, "foreign.json"), "utf8")).toBe("[]");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("JSON evidence preserves booleans and public realm metadata while redacting actual string credentials", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "jeeves-redaction-test-"));
  try {
    const application = join(temporary, "app");
    const directory = join(application, ".runtime/secrets");
    const artifacts = join(temporary, "artifacts");
    await mkdir(directory, { recursive: true });
    await mkdir(artifacts);
    await writeFile(
      join(directory, "sign-in.realm.json"),
      JSON.stringify({ realm: "sign-in", config: { "access.token.claim": "true" } }),
    );
    await writeFile(join(directory, "password"), "true");
    await writeFile(
      join(directory, "s3.json"),
      JSON.stringify({ accessKeyId: "opaque-key", secretAccessKey: "opaque-secret" }),
    );
    const original = {
      signedIn: true,
      absent: false,
      count: 1,
      empty: null,
      realm: "sign-in",
      credential: "true",
      nested: ["opaque-key", "opaque-secret"],
    };
    const expected = {
      ...original,
      credential: "[REDACTED]",
      nested: ["[REDACTED]", "[REDACTED]"],
    };
    expect(sanitizeJson(original, await sanitizer(application))).toEqual(expected);
    await writeFile(join(artifacts, "vitest.json"), JSON.stringify(original));
    await writeFile(join(artifacts, "interrupted.json"), '{"operand":"opaque-secret",');
    await sanitizeArtifacts(artifacts, [application]);
    expect(JSON.parse(await readFile(join(artifacts, "vitest.json"), "utf8"))).toEqual(expected);
    expect(await readFile(join(artifacts, "interrupted.json"), "utf8")).toBe(
      '{"operand":"[REDACTED]",',
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
