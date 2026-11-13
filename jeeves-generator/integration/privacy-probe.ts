/** Disposable recovery probe: synthetic high-entropy secrets, never printed or retained. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { access, chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { cleanupRun, type RunRecord } from "./harness/cleanup.ts";
import { privateRedactionsPath, rememberSecrets, sanitizeArtifacts } from "./harness/evidence.ts";
import { hash, json, writeJson } from "./harness/process.ts";

const artifacts = resolve(process.argv[2] ?? "test-results/generated-privacy-probe");
await mkdir(artifacts);
const temporary = await mkdtemp(join(tmpdir(), "jeeves-system-"));
const application = join(temporary, "1-identity");
await mkdir(application);
const id = `gs-${randomUUID()}`;
const run: RunRecord = {
  version: 1,
  id,
  temporary,
  suite: "privacy-probe",
  stacks: [{ project: `${id}-1`, application, artifacts, fixture: "identity", ports: [] }],
};
const record = join(artifacts, "run.json");
await writeJson(record, run);
const categories = [
  "password",
  "verifier",
  "authorization-code",
  "access-token",
  "refresh-token",
  "cookie",
];
const values = categories.map(() => randomBytes(32).toString("base64url"));
await rememberSecrets(application, ...values);
const privatePath = privateRedactionsPath(application);
const privateMode = (await stat(privatePath)).mode & 0o777;
assert.equal(privateMode, 0o600);
assert.equal((await stat(temporary)).mode & 0o777, 0o700);
const raw = JSON.stringify({ safe: "keep-observation", assertionOperands: values });
for (const name of ["failure.log", "observations.json", "vitest.json", "junit.xml"])
  await writeFile(join(artifacts, name), name.endsWith("xml") ? `<failure>${raw}</failure>` : raw);
await sanitizeArtifacts(artifacts, [application]);
for (const name of ["failure.log", "observations.json", "vitest.json", "junit.xml"]) {
  const text = await readFile(join(artifacts, name), "utf8");
  assert(
    values.every((value) => !text.includes(value)),
    "Every transient secret is scrubbed",
  );
  assert.equal(text.split("[REDACTED]").length - 1, categories.length);
  assert(text.includes("keep-observation"));
}
// Emulate a forcibly interrupted reporter after capture. Recovery must read private inputs first.
await writeFile(join(artifacts, "interrupted.log"), raw);
await writeJson(join(artifacts, "sanitized.json"), { version: 1, id, complete: true });
await chmod(privatePath, 0o000);
let failedClosed = false;
try {
  await cleanupRun(record);
} catch (error) {
  assert.equal((error as NodeJS.ErrnoException).code, "EACCES");
  failedClosed = true;
}
assert(failedClosed, "Unreadable private redactions must fail cleanup");
assert(await access(temporary).then(() => true));
assert.equal(
  await access(join(artifacts, "sanitized.json")).then(
    () => true,
    () => false,
  ),
  false,
);
await chmod(privatePath, 0o600);
await cleanupRun(record);
const recovered = await readFile(join(artifacts, "interrupted.log"), "utf8");
assert(
  values.every((value) => !recovered.includes(value)),
  "Recovery scrubs before private inputs disappear",
);
assert.equal(
  await access(temporary).then(
    () => true,
    () => false,
  ),
  false,
);
assert.deepEqual(await json(join(artifacts, "sanitized.json")), { version: 1, id, complete: true });
await writeJson(join(artifacts, "probe-result.json"), {
  outcome: "passed",
  categories,
  formats: ["failure.log", "observations.json", "vitest.json", "junit.xml", "interrupted.log"],
  inputSha256: hash(raw),
  outputSha256: hash(recovered),
  privateMode: privateMode.toString(8),
  privateDirectoryMode: "700",
  secretsRemoved: true,
  safeObservationPreserved: true,
  unreadablePrivateInputFailsClosed: true,
  staleMarkerRemoved: true,
  recoveryBeforeDeletion: true,
});
console.log(`Privacy recovery probe passed: ${artifacts}`);
