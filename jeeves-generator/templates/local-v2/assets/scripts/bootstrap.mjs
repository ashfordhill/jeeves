import { existsSync, writeFileSync } from "node:fs";
import { compose, plan } from "./common.mjs";

const garage = (...args) => compose("exec", "-T", "local-objects", "/garage", ...args);
if (plan.generatedSecrets.some((name) => existsSync(`.runtime/secrets/${name}`)))
  throw new Error(
    "Storage credentials already exist; retain runtime. Bootstrap cannot be replayed.",
  );
const nodeId = garage("status").match(/^([a-f0-9]{16,})\s/m)?.[1];
if (!nodeId) throw new Error("Selected Garage node not ready.");
garage("layout", "assign", "-z", "local", "-c", "1G", nodeId);
garage("layout", "apply", "--version", "1");
for (const bucket of plan.objects) {
  garage("bucket", "create", bucket.id);
  if (bucket.public) garage("bucket", "website", "--allow", bucket.id);
}
for (const name of plan.generatedSecrets) {
  const result = garage("key", "create", name);
  const accessKeyId = result.match(/Key ID:\s*(\S+)/)?.[1],
    secretAccessKey = result.match(/Secret key:\s*(\S+)/)?.[1];
  if (!accessKeyId || !secretAccessKey)
    throw new Error("Storage key output changed; inspect private runtime without logging keys.");
  writeFileSync(`.runtime/secrets/${name}`, JSON.stringify({ accessKeyId, secretAccessKey }), {
    mode: 0o644,
    flag: "wx",
  });
}
for (const binding of plan.storage)
  garage(
    "bucket",
    "allow",
    ...(binding.read ? ["--read"] : []),
    ...(binding.write ? ["--write"] : []),
    ...(binding.corsPut ? ["--owner"] : []),
    "--key",
    binding.secret,
    binding.resource,
  );
try {
  if (plan.storage.some((binding) => binding.corsPut))
    compose("run", "--rm", "--no-deps", "setup-storage");
} finally {
  for (const binding of plan.storage.filter((binding) => binding.corsPut))
    garage("bucket", "deny", "--owner", "--key", binding.secret, binding.resource);
}
console.log("Selected storage buckets/keys configured; owner permission revoked after CORS.");
