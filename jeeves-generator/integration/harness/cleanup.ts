import { lstat, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { sanitizeArtifacts } from "./evidence.ts";
import { command, json, writeJson } from "./process.ts";

export type StackRecord = {
  project: string;
  application: string;
  artifacts: string;
  fixture: string;
  ports: number[];
};
export type RunRecord = {
  version: 1;
  id: string;
  temporary: string;
  suite: string;
  stacks: StackRecord[];
};
const label = "com.docker.compose.project";

export async function inventory(project: string) {
  const filter = `label=${label}=${project}`;
  const result: Record<"containers" | "networks" | "volumes", string[]> = {
    containers: [],
    networks: [],
    volumes: [],
  };
  for (const [kind, args] of [
    ["containers", ["ps", "-aq", "--filter", filter]],
    ["networks", ["network", "ls", "-q", "--filter", filter]],
    ["volumes", ["volume", "ls", "-q", "--filter", filter]],
  ] as const)
    result[kind] = (await command("docker", [...args])).trim().split(/\s+/).filter(Boolean);
  return result;
}

/** Only exact project labels confer removal authority; no global prune or name-based guessing. */
export async function cleanupRun(recordPath: string) {
  const run = await json<RunRecord>(recordPath);
  if (
    run.version !== 1 ||
    !/^gs-[a-f0-9-]{36}$/.test(run.id) ||
    !Array.isArray(run.stacks) ||
    dirname(run.temporary) !== resolve(tmpdir()) ||
    !run.temporary.startsWith(join(resolve(tmpdir()), "jeeves-system-"))
  )
    throw new Error("Refusing invalid cleanup record");
  if ((await lstat(run.temporary).catch(() => undefined))?.isSymbolicLink())
    throw new Error("Symlink runtime refused");
  const temporary = await realpath(run.temporary).catch(() => undefined);
  if (temporary && temporary !== run.temporary) throw new Error("Runtime path changed");
  // Preflight every recorded scope before reading secrets or removing any resources.
  for (const stack of run.stacks) {
    if (
      !stack.project.startsWith(`${run.id}-`) ||
      !/^[a-z0-9-]{3,60}$/.test(stack.project) ||
      !stack.application.startsWith(`${run.temporary}${sep}`) ||
      resolve(stack.application) !== stack.application
    )
      throw new Error("Foreign stack in cleanup record");
    const application = await realpath(stack.application).catch(() => undefined);
    if (application && !application.startsWith(`${run.temporary}${sep}`))
      throw new Error("Foreign application path in cleanup record");
  }
  const artifacts = dirname(recordPath);
  const marker = join(artifacts, "sanitized.json");
  await rm(marker, { force: true });
  // Recovery must scrub reporter operands while original secret files still exist.
  // A failure leaves no completion marker and preserves the runtime for another recovery.
  await sanitizeArtifacts(
    artifacts,
    run.stacks.map((stack) => stack.application),
  );
  await writeJson(marker, { version: 1, id: run.id, complete: true });
  const outcomes = [];
  for (const stack of run.stacks) {
    outcomes.push(await cleanupStackResources(stack));
  }
  const actual = await realpath(run.temporary).catch(() => undefined);
  if (actual && actual !== run.temporary) throw new Error("Runtime path changed");
  await rm(run.temporary, { recursive: true, force: true });
  await writeJson(join(dirname(recordPath), "cleanup.json"), { outcomes, temporaryRemoved: true });
}

/** Release completed Docker stacks sequentially; private files stay until global scrub. */
export async function cleanupStackResources(stack: StackRecord) {
  if (!/^gs-[a-f0-9-]{36}-[1-9][0-9]*$/.test(stack.project))
    throw new Error("Invalid stack project");
  const before = await inventory(stack.project);
  for (const [kind, ids] of Object.entries(before)) {
    for (const id of ids) {
      const args =
        kind === "containers"
          ? ["inspect", id]
          : [kind === "networks" ? "network" : "volume", "inspect", id];
      const inspected = JSON.parse(await command("docker", args)) as {
        Labels?: Record<string, string>;
        Config?: { Labels?: Record<string, string> };
      }[];
      const labels = kind === "containers" ? inspected[0]?.Config?.Labels : inspected[0]?.Labels;
      if (labels?.[label] !== stack.project) throw new Error(`Foreign ${kind} refused`);
      await command(
        "docker",
        kind === "containers"
          ? ["rm", "-f", id]
          : [kind === "networks" ? "network" : "volume", "rm", id],
        { timeoutMs: 60_000 },
      );
    }
  }
  const after = await inventory(stack.project);
  if (Object.values(after).some((ids) => ids.length))
    throw new Error(`Cleanup incomplete for ${stack.project}`);
  return { project: stack.project, before, after };
}
