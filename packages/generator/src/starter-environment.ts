/** Local setup for a fresh editable starter. Existing secrets and origins are never rewritten. */
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { type DesignDocument, workspaceBindings, workspaceModel } from "@jeeves/spec";
import { databasePasswordEnv } from "@jeeves/template-kit";
import { StarterError, starterCatalog } from "./starters.ts";

export function starterEnvironment(
  dir: string,
  design: DesignDocument,
  options: { create?: boolean; fresh: boolean },
): boolean {
  if (!design.startedFrom) return false;
  const origin = design.startedFrom;
  const known = starterCatalog().find(
    (item) =>
      item.id === origin.id &&
      item.version === origin.version &&
      item.manifestSha256 === origin.manifestSha256,
  );
  if (!known)
    throw new StarterError(
      "The starter origin does not match a registered version. Restore its provenance before generation.",
    );
  const values = new Map<string, string>(),
    secrets = new Set<string>();
  for (const [frontend, binding] of Object.entries(workspaceBindings(design))) {
    const web = design.elements.find((element) => element.id === frontend)!;
    const port = Number(web.config.hostPort);
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw new StarterError("A local starter workspace needs a stable loopback web port.");
    const workspace = workspaceModel(design, frontend, binding.attachment);
    const store = design.connections.find(
      (connection) =>
        connection.id === workspace.model.storeConnection &&
        connection.kind === "uses-database" &&
        connection.from.element === binding.service,
    );
    if (
      !store ||
      design.elements.find((element) => element.id === store.to.element)?.template?.id !==
        "postgres"
    )
      throw new StarterError("Starter local setup requires the API's actual Postgres binding.");
    const key = `${binding.service.toUpperCase().replaceAll("-", "_")}_PUBLIC_ORIGIN`,
      expected = `http://127.0.0.1:${port}`;
    if (values.has(key) && values.get(key) !== expected)
      throw new StarterError(
        `Ambiguous public origin for ${binding.service}; choose one local workspace origin.`,
      );
    values.set(key, expected);
    secrets.add(databasePasswordEnv(binding.service));
  }
  if (!values.size) return false;
  for (const secret of secrets)
    if (process.env[secret] !== undefined)
      throw new StarterError(
        `Remove ambient ${secret}; private local starter credentials belong to the project environment.`,
      );
  for (const [key, expected] of values)
    if (process.env[key] !== undefined && process.env[key] !== expected)
      throw new StarterError(`Ambient ${key} conflicts with the selected local workspace port.`);
  if (
    options.fresh &&
    !options.create &&
    existsSync(dir) &&
    readdirSync(dir).some((entry) => entry !== ".git" && entry !== ".env")
  )
    throw new StarterError(
      "Generate a starter into a new empty output folder. Existing applications need a reviewed adoption.",
    );
  const path = join(dir, ".env");
  if (existsSync(path)) {
    const existing = parseEnv(readFileSync(path, "utf8"));
    for (const [key, expected] of values)
      if (existing[key] !== expected)
        throw new StarterError(
          `Existing ${key} differs from the local workspace origin. Review the environment and port together; no values were changed.`,
        );
    for (const secret of secrets)
      if (!existing[secret])
        throw new StarterError(`Existing .env needs ${secret}. No credentials were replaced.`);
    return false;
  }
  if (!options.fresh)
    throw new StarterError(
      "The existing starter output has no .env. Restore its local environment before regeneration.",
    );
  if (!options.create) return false;
  const lines = [
    "# Private local starter environment. Ignored by Git; preserve existing credentials.",
    ...[...values].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`),
    ...[...secrets].sort().map((key) => `${key}=${randomBytes(24).toString("hex")}`),
    "",
  ];
  writeFileSync(path, lines.join("\n"), { mode: 0o600, flag: "wx" });
  return true;
}
