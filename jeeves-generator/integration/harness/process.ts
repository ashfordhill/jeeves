import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const repository = resolve(import.meta.dirname, "../../..");
export const hash = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8"));
export async function writeJson(path: string, value: unknown) {
  await writeFile(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}

/** Commands have a process-group deadline: shell grandchildren must not outlive failed setup. */
export function command(
  program: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    input?: string;
  } = {},
): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    const child = spawn(program, args, {
      cwd: options.cwd ?? repository,
      env: { ...process.env, ...options.env },
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "",
      expired = false;
    let signal: string | undefined;
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    // Descendant commands may establish their own process groups (pnpm, Vitest, local scripts).
    const terminateTree = (pid: number) => {
      try {
        for (const childPid of readFileSync(`/proc/${pid}/task/${pid}/children`, "utf8")
          .trim()
          .split(/\s+/)
          .filter(Boolean))
          terminateTree(Number(childPid));
      } catch {
        /* Linux process disappeared, or platform has no /proc. */
      }
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        /* Not a group leader. */
      }
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* Already gone. */
      }
    };
    const interrupt = (name: string) => {
      signal = name;
      try {
        if (child.pid) terminateTree(child.pid);
      } catch {
        /* Already gone. */
      }
    };
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
    const unlisten = () => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
    };
    const timer = setTimeout(() => {
      expired = true;
      try {
        if (child.pid) terminateTree(child.pid);
      } catch {
        /* Already gone. */
      }
    }, options.timeoutMs ?? 30_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      unlisten();
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      unlisten();
      if (code === 0 && !expired) resolveOutput(output);
      else
        reject(
          new Error(
            `${program} ${args[0] ?? ""} ${signal ? `interrupted (${signal})` : expired ? "deadline exceeded" : `exit ${code}`}\n${output}`,
          ),
        );
    });
    child.stdin.end(options.input);
  });
}

/** Fingerprint effective inputs, including uncommitted/untracked source, not unrelated owner docs. */
export async function sourceSnapshot() {
  const paths = new Set<string>();
  async function walk(path: string): Promise<void> {
    for (const entry of await readdir(resolve(repository, path), { withFileTypes: true })) {
      if (["node_modules", "dist", ".runtime"].includes(entry.name)) continue;
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) paths.add(child);
    }
  }
  await Promise.all(
    [
      "jeeves-generator/src",
      "jeeves-generator/templates",
      "jeeves-generator/integration",
      "jeeves/packages/spec/src",
      "field-projects/generator-system/fixtures",
    ].map(walk),
  );
  for (const path of [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "jeeves-generator/package.json",
    "jeeves-generator/tsconfig.json",
  ])
    paths.add(path);
  const files: Record<string, string> = {};
  for (const path of [...paths].sort())
    files[path] = hash(await readFile(resolve(repository, path)));
  return { sha256: hash(JSON.stringify(files)), files };
}

export async function poll<T>(
  name: string,
  observe: () => Promise<T>,
  accepts: (value: T) => boolean,
  timeoutMs = 30_000,
  record?: (value: unknown) => void,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  do {
    try {
      const value = await observe();
      last = value;
      record?.({ name, at: new Date().toISOString(), value });
      if (accepts(value)) return value;
    } catch (error) {
      last = String(error);
      record?.({ name, at: new Date().toISOString(), error: last });
    }
    await new Promise((done) =>
      setTimeout(done, Math.min(250, Math.max(0, deadline - Date.now()))),
    );
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${name}; last observation: ${JSON.stringify(last)}`);
}
