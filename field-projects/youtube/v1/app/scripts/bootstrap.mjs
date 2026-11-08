import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const compose = (...args) =>
  execFileSync("docker", ["compose", ...args], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
const garage = (...args) => compose("exec", "-T", "objects", "/garage", ...args);
if (existsSync(".runtime/secrets/upload_s3"))
  throw new Error(
    "Storage already bootstrapped; retain keys and volumes. No reset/rotation is implemented.",
  );
const status = garage("status");
const nodeId = status.match(/^([a-f0-9]{16,})\s/gm)?.[0]?.trim();
if (!nodeId) throw new Error("Garage node not ready; inspect docker compose logs objects");
garage("layout", "assign", "-z", "local", "-c", "1G", nodeId);
garage("layout", "apply", "--version", "1");
for (const bucket of ["youtube-v1-originals", "youtube-v1-transcoded"])
  garage("bucket", "create", bucket);
garage("bucket", "website", "--allow", "youtube-v1-transcoded");
function key(name) {
  const result = garage("key", "create", name);
  const accessKeyId = result.match(/Key ID:\s*(\S+)/)?.[1];
  const secretAccessKey = result.match(/Secret key:\s*(\S+)/)?.[1];
  if (!accessKeyId || !secretAccessKey)
    throw new Error(
      "Garage key output changed; keys were not logged. Inspect local runtime manually.",
    );
  const credentials = { accessKeyId, secretAccessKey };
  writeFileSync(`.runtime/secrets/${name}_s3`, JSON.stringify(credentials), {
    mode: 0o600,
    flag: "wx",
  });
}
key("upload");
key("transcoder");
garage(
  "bucket",
  "allow",
  "--read",
  "--write",
  "--owner",
  "--key",
  "upload",
  "youtube-v1-originals",
);
garage("bucket", "allow", "--read", "--key", "transcoder", "youtube-v1-originals");
garage("bucket", "allow", "--read", "--write", "--key", "transcoder", "youtube-v1-transcoded");
// CORS via the pinned S3 client inside the built app image; no host SDK install required.
try {
  compose("run", "--rm", "--no-deps", "storage-config");
} finally {
  garage("bucket", "deny", "--owner", "--key", "upload", "youtube-v1-originals");
}
console.log(
  "Storage buckets/keys/website/CORS configured. Original bucket stays private; keys retained only in .runtime.",
);
