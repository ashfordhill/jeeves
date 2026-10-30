/**
 * Bootstraps the reviewed qrwty project through the running Jeeves API.
 *
 * It creates/reuses the project, applies the committed design fixture through the same validated
 * operations endpoint the UI uses, points the project at `~/github/qrwty`, merges its `.env`, and
 * runs Generate through the server with `acceptancePack: "qrwty"` and no baseline. The second
 * in-process generation was removed: the server owns generation, and the lock is read back to
 * prove six suites are registered.
 *
 *   pnpm qrwty:bootstrap [--output-dir DIR] [--api URL] [--public-origin URL]
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { acceptancePath } from "../packages/generator/src/acceptance.ts";
import { readLock } from "../packages/generator/src/lock.ts";
import { templateSet } from "../packages/generator/src/modules.ts";
import { designSchema, layoutSchema, validateDesign } from "../packages/spec/src/index.ts";

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  const value =
    index >= 0
      ? process.argv[index + 1]
      : process.env[`JEEVES_${name.slice(2).toUpperCase().replaceAll("-", "_")}`];
  return value?.trim() || fallback;
}

const api = flag("--api", process.env.JEEVES_API_URL ?? "http://127.0.0.1:4310").replace(/\/$/, "");
const outputDir = flag("--output-dir", join(homedir(), "github", "qrwty")).replace(/^~/, homedir());
if (!isAbsolute(outputDir)) throw new Error("--output-dir must be an absolute path.");
const publicOrigin = flag(
  "--public-origin",
  process.env.QRWTY_PUBLIC_ORIGIN ?? "http://127.0.0.1:5173",
);
const projectName = "qrwty";

type Project = { id: string; name: string; outputDir: string | null };
type DesignState = {
  design: ReturnType<typeof designSchema.parse>;
  findings: { severity: string; message: string }[];
  revision?: number;
};
type Generation = {
  id: number;
  status: string;
  error: string | null;
  steps: { id: string; title: string; status: string; message?: string }[];
};

const fixture = designSchema.parse(
  JSON.parse(
    readFileSync(new URL("../fixtures/designs/qrwty.json", import.meta.url), "utf8"),
  ) as unknown,
);
const layoutFile = new URL("../fixtures/designs/qrwty.layout.json", import.meta.url);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let value: unknown = text;
  try {
    value = text ? JSON.parse(text) : null;
  } catch {
    // Keep the text for the error below.
  }
  if (!response.ok)
    throw new Error(
      `${method} ${path} failed (${response.status}): ${typeof value === "string" ? value : JSON.stringify(value)}`,
    );
  return value as T;
}

function assertPublicOrigin(): void {
  const web = fixture.elements.find((element) => element.template?.id === "web-app");
  const hostPort = (web?.config as { hostPort?: unknown } | undefined)?.hostPort;
  if (typeof hostPort !== "number")
    throw new Error("The qrwty fixture has no web-app hostPort to match the public origin.");
  const origin = new URL(publicOrigin);
  if (
    origin.protocol !== "http:" ||
    origin.hostname !== "127.0.0.1" ||
    origin.port !== String(hostPort)
  )
    throw new Error(
      `--public-origin ${publicOrigin} must be http://127.0.0.1:${hostPort} to match the fixture's hostPort.`,
    );
}

async function project(): Promise<Project> {
  const { projects } = await request<{ projects: Project[] }>("GET", "/projects");
  const existing = projects.find((p) => p.name.toLowerCase() === projectName);
  if (existing) return existing;
  const created = await request<{ project: Project }>("POST", "/projects", { name: projectName });
  return created.project;
}

function operationsFor(design: typeof fixture) {
  return [
    ...design.elements.map((element) => ({ op: "addElement", element })),
    ...design.connections.map((connection) => ({ op: "connect", connection })),
    ...design.annotations.map((annotation) => ({ op: "addAnnotation", annotation })),
  ];
}

/** Compare after the schema round-trip so server normalization doesn't look like a diff. */
function sameDesign(a: unknown, b: typeof fixture): boolean {
  const normalize = (value: unknown) => {
    const parsed = designSchema.parse(value);
    return {
      elements: parsed.elements,
      connections: parsed.connections,
      annotations: parsed.annotations,
    };
  };
  return isDeepStrictEqual(normalize(a), normalize(b));
}

async function applyFixture(id: string): Promise<DesignState> {
  const current = await request<DesignState>("GET", `/projects/${id}/design`);
  if (current.design.elements.length === 0) {
    await request("POST", `/projects/${id}/operations`, {
      baseRevision: current.design.revision,
      ops: operationsFor(fixture),
      source: "api",
    });
    if (existsSync(layoutFile)) {
      const layout = layoutSchema.parse(JSON.parse(readFileSync(layoutFile, "utf8")) as unknown);
      await request("PUT", `/projects/${id}/layout`, layout);
    }
    return request<DesignState>("GET", `/projects/${id}/design`);
  }
  if (!sameDesign(current.design, fixture))
    throw new Error(
      "The qrwty project already has a different design. Use another project name or delete the existing project; this script will not overwrite it.",
    );
  if (existsSync(layoutFile)) {
    const layout = layoutSchema.parse(JSON.parse(readFileSync(layoutFile, "utf8")) as unknown);
    await request("PUT", `/projects/${id}/layout`, layout);
  }
  return request<DesignState>("GET", `/projects/${id}/design`);
}

/** Merge `.env` instead of replacing it: user variables survive every bootstrap. */
function writeEnv(dir: string): void {
  const path = join(dir, ".env");
  const existing = existsSync(path)
    ? readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => line.trim() !== "")
    : [];
  const current = new Map(
    existing.flatMap((line) => {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      return match?.[1] ? [[match[1], match[2]] as const] : [];
    }),
  );
  const managed = new Map([
    ["DB_QRWTY_PASSWORD", current.get("DB_QRWTY_PASSWORD") ?? randomBytes(24).toString("hex")],
    ["QRWTY_PUBLIC_ORIGIN", publicOrigin],
  ]);
  const lines = existing.map((line) => {
    const match = /^([A-Z0-9_]+)=/.exec(line.trim());
    const key = match?.[1];
    return key && managed.has(key) ? `${key}=${managed.get(key)}` : line;
  });
  for (const [key, value] of managed)
    if (!lines.some((line) => line.trim().startsWith(`${key}=`))) lines.push(`${key}=${value}`);
  writeFileSync(path, `${lines.join("\n")}\n`);
  console.log(`Wrote ${path} (merged)`);
}

function assertLock(dir: string): void {
  const lock = readLock(dir);
  if (!lock) throw new Error(`No lock at ${dir}`);
  const ids = (lock.fixedAcceptance ?? []).map((suite) => suite.id).sort();
  const expected = ["activity", "browser", "core", "qr-image", "redirect", "restart"];
  if (JSON.stringify(ids) !== JSON.stringify(expected))
    throw new Error(`The lock has fixed suites ${ids.join(", ")}, expected ${expected.join(", ")}`);
  for (const suite of lock.fixedAcceptance ?? [])
    if (!existsSync(join(dir, acceptancePath(suite))))
      throw new Error(`Missing fixed suite ${acceptancePath(suite)}`);
  const cases = Object.values(lock.resourceModels ?? {}).flatMap((model) => model.acceptanceCases);
  const covered = new Set((lock.fixedAcceptance ?? []).flatMap((suite) => suite.acceptanceIds));
  const missing = cases.filter((id) => !covered.has(id));
  if (missing.length) throw new Error(`Uncovered acceptance cases: ${missing.join(", ")}`);
  console.log(
    `Lock has ${ids.length} fixed suites (${ids.join(", ")}) covering ${cases.length} acceptance cases.`,
  );
}

function isGitRepo(dir: string): boolean {
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return realpathSync(top) === realpathSync(dir);
  } catch {
    return false;
  }
}

function commitGenerated(dir: string, revision: number): void {
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" });
  if (!status.trim()) return;
  execFileSync("git", ["add", "--all"], { cwd: dir, stdio: "ignore" });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Jeeves",
      "-c",
      "user.email=jeeves@localhost",
      "commit",
      "--quiet",
      "--no-verify",
      "-m",
      `Generate qrwty template project (design revision ${revision})`,
    ],
    { cwd: dir, stdio: "ignore" },
  );
  console.log("Committed the generated qrwty project.");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generate(projectId: string, dir: string): Promise<void> {
  const started = await request<{ generation: Generation }>(
    "POST",
    `/projects/${projectId}/generations`,
    { outputDir: dir, baseline: false, acceptancePack: projectName },
  );
  let generation = started.generation;
  for (;;) {
    if (generation.status !== "running") break;
    await sleep(1000);
    generation = (
      await request<{ generation: Generation }>(
        "GET",
        `/projects/${projectId}/generations/${generation.id}`,
      )
    ).generation;
  }
  if (generation.status !== "succeeded")
    throw new Error(
      `Generation ${generation.status}: ${generation.error ?? generation.steps.find((step) => step.status === "failed")?.message ?? "unknown error"}`,
    );
  console.log(`Generation succeeded into ${dir}.`);
}

async function main(): Promise<void> {
  assertPublicOrigin();
  const p = await project();
  const state = await applyFixture(p.id);
  const findings = validateDesign(state.design, templateSet().lookup);
  if (findings.some((finding) => finding.severity === "error"))
    throw new Error(`The qrwty design has errors:\n${findings.map((f) => f.message).join("\n")}`);
  console.log(
    `Design revision ${state.design.revision}; ${findings.length} finding(s), no errors.`,
  );

  await request("PATCH", `/projects/${p.id}`, { outputDir });
  const wasRepo = isGitRepo(outputDir);
  mkdirSync(outputDir, { recursive: true });
  writeEnv(outputDir);
  await generate(p.id, outputDir);
  assertLock(outputDir);
  if (wasRepo) commitGenerated(outputDir, state.design.revision);

  console.log(`\nqrwty is ready at ${outputDir}.`);
  console.log(`Open it at exactly ${publicOrigin} (not localhost).`);
  console.log("Next: Generate in the UI with the baseline check, then Runs -> Plan.");
}

await main();
