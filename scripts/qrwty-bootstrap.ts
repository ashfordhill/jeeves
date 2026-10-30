/**
 * Bootstraps the reviewed qrwty project through the running Jeeves API.
 *
 * It applies the committed design fixture through the same validated operations endpoint the UI
 * uses, reads the resulting design, writes the generated project's environment, and registers the
 * six fixed acceptance suites with generateProject. A second generation without fixedAcceptance
 * proves the suites are preserved from the lock. The UI's later Generate uses the same folder.
 *
 * Run it with the server's existing tsx:
 *   pnpm qrwty:bootstrap
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { qrwtyAcceptance } from "../fixtures/acceptance/qrwty/manifest.ts";
import { acceptancePath } from "../packages/generator/src/acceptance.ts";
import { generateProject } from "../packages/generator/src/generate.ts";
import { readLock } from "../packages/generator/src/lock.ts";
import { templateSet } from "../packages/generator/src/modules.ts";
import { designSchema, layoutSchema, validateDesign } from "../packages/spec/src/index.ts";

const api = process.env.JEEVES_API_URL ?? "http://127.0.0.1:4310";
const publicOrigin = process.env.QRWTY_PUBLIC_ORIGIN ?? "http://127.0.0.1:5173";
const projectName = "qrwty";

type Project = { id: string; name: string; outputDir: string | null };
type DesignState = {
  design: ReturnType<typeof designSchema.parse>;
  findings: { severity: string; message: string }[];
  revision?: number;
};
type Overview = { outputDir: string | null; defaultOutputDir: string };

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

const fixture = designSchema.parse(
  JSON.parse(
    readFileSync(new URL("../fixtures/designs/qrwty.json", import.meta.url), "utf8"),
  ) as unknown,
);
const layoutFile = new URL("../fixtures/designs/qrwty.layout.json", import.meta.url);

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
  const same =
    isDeepStrictEqual(current.design.elements, fixture.elements) &&
    isDeepStrictEqual(current.design.connections, fixture.connections);
  if (!same)
    throw new Error(
      "The qrwty project already has a different design. Use another project name or delete the existing project; this script will not overwrite it.",
    );
  return current;
}

function writeEnv(dir: string): void {
  const path = join(dir, ".env");
  const existing = existsSync(path)
    ? Object.fromEntries(
        readFileSync(path, "utf8")
          .split("\n")
          .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()))
          .filter((match): match is RegExpExecArray => match !== null)
          .map((match) => [match[1], match[2]]),
      )
    : {};
  const lines = [
    `DB_QRWTY_PASSWORD=${existing.DB_QRWTY_PASSWORD ?? randomBytes(24).toString("hex")}`,
    `QRWTY_PUBLIC_ORIGIN=${publicOrigin}`,
  ];
  writeFileSync(path, `${lines.join("\n")}\n`);
  console.log(`Wrote ${path}`);
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

async function main(): Promise<void> {
  const p = await project();
  const state = await applyFixture(p.id);
  const findings = validateDesign(state.design, templateSet().lookup);
  if (findings.some((finding) => finding.severity === "error"))
    throw new Error(`The qrwty design has errors:\n${findings.map((f) => f.message).join("\n")}`);
  console.log(
    `Design revision ${state.design.revision}; ${findings.length} finding(s), no errors.`,
  );

  const overview = await request<Overview>("GET", `/projects/${p.id}/generation`);
  const dir = p.outputDir ?? overview.outputDir ?? overview.defaultOutputDir;
  const generated = await generateProject({
    dir,
    design: state.design,
    projectName,
    fixedAcceptance: qrwtyAcceptance,
    log: (line) => console.log(`  ${line}`),
  });
  if (!generated.ok)
    throw new Error(`Generation stopped:\n${generated.problems.map((p) => p.message).join("\n")}`);
  writeEnv(dir);
  assertLock(dir);

  // A later UI Generate omits fixedAcceptance. Prove it retains every suite from the lock.
  const regenerated = await generateProject({
    dir,
    design: state.design,
    projectName,
    log: (line) => console.log(`  again: ${line}`),
  });
  if (!regenerated.ok)
    throw new Error(
      `The fixed acceptance did not survive regeneration:\n${regenerated.problems.map((p) => p.message).join("\n")}`,
    );
  assertLock(dir);
  console.log(`\nqrwty is ready at ${dir}.`);
  console.log(`Open it at exactly ${publicOrigin} (not localhost).`);
  console.log("Next: Generate in the UI for the baseline, then Runs -> Plan.");
}

await main();
