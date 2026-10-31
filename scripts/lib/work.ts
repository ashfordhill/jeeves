import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, join, relative, resolve } from "node:path";

export type Command = { executable: string; args: string[]; cwd: string };
export type WorkPlan = { name: string; commands: Command[]; repositories: string[] };
export const profiles = {
  check: "Required lint, typecheck and offline unit gate",
  typecheck: "All workspace and maintenance-script type checks",
  unit: "Selected offline test files (or explicit all)",
  templates: "Selected conformance files; may start disposable Docker/browser fixtures (or all)",
  browser: "Selected Playwright specs; starts the existing Jeeves test database (or all)",
  "browser-docker": "All Playwright specs using the existing Docker runner",
  "qr-studio-recipe":
    "Fresh deterministic QR Studio generation, build and full acceptance; disposable database",
  "resource-workspace":
    "Compiled owner-resource workspace in a disposable Inventory app; no live consumer",
  "generated-events":
    "Generated non-QR event service, lifecycle and fixed acceptance; disposable Postgres",
  "durable-events":
    "Focused transactional delivery proof in disposable PostgreSQL; no live consumer",
  "qrwty-product": "Isolated composed consumer verification; requires an absolute checkout path",
  "qrwty-upgrade": "Disposable old-to-new migration proof; requires two absolute checkout paths",
} as const;

export function planWork(root: string, name: string, selections: string[]): WorkPlan {
  const commands: Command[] = [];
  const repositories = [root];
  const pnpm = (...args: string[]) => commands.push({ executable: "pnpm", args, cwd: root });
  const none = () => {
    if (selections.length) throw new Error(`${name} takes no selections.`);
  };
  const files = (suffix: string) => {
    if (selections.length === 1 && selections[0] === "all") return [];
    if (!selections.length) throw new Error(`${name} requires test files or explicit 'all'.`);
    return selections.map((selection) => {
      const path = resolve(root, selection);
      const local = relative(root, path);
      if (
        selection.startsWith("-") ||
        local.startsWith("..") ||
        isAbsolute(local) ||
        !(
          selection.endsWith(suffix) ||
          (suffix === ".test.ts" && selection.endsWith(".test.tsx"))
        ) ||
        !existsSync(path) ||
        !lstatSync(path).isFile()
      )
        throw new Error(`Expected an existing repository ${suffix} file: ${selection}`);
      return local;
    });
  };
  switch (name) {
    case "check":
    case "typecheck":
      none();
      pnpm(name);
      break;
    case "unit":
      pnpm("exec", "vitest", "run", "--passWithNoTests=false", ...files(".test.ts"));
      break;
    case "templates":
      pnpm(
        "exec",
        "vitest",
        "run",
        "--config",
        "vitest.templates.config.ts",
        "--passWithNoTests=false",
        ...files(".conformance.ts"),
      );
      break;
    case "durable-events":
      none();
      pnpm(
        "exec",
        "vitest",
        "run",
        "--config",
        "vitest.templates.config.ts",
        "--passWithNoTests=false",
        "packages/durable-events/conformance/durable-events.conformance.ts",
      );
      break;
    case "browser": {
      const selected = files(".spec.ts");
      pnpm("db:up");
      pnpm("exec", "playwright", "test", ...selected);
      break;
    }
    case "browser-docker":
      none();
      pnpm("test:e2e:docker");
      break;
    case "resource-workspace":
    case "generated-events":
    case "qr-studio-recipe": {
      none();
      const loader = createRequire(join(root, "apps/server/package.json")).resolve("tsx");
      commands.push({
        executable: process.execPath,
        args: ["--import", loader, join(root, `packages/generator/scripts/verify-${name}.ts`)],
        cwd: root,
      });
      break;
    }
    case "qrwty-product":
    case "qrwty-upgrade": {
      const count = name === "qrwty-upgrade" ? 2 : 1;
      if (
        selections.length !== count ||
        selections.some((path) => !isAbsolute(path) || !existsSync(join(path, "jeeves/lock.json")))
      )
        throw new Error(`${name} requires ${count} absolute generated qrwty checkout path(s).`);
      repositories.push(...selections);
      // Run Node directly so a signal reaches the verifier, which owns fixture cleanup.
      const loader = createRequire(join(root, "apps/server/package.json")).resolve("tsx");
      commands.push({
        executable: process.execPath,
        args: [
          "--import",
          loader,
          join(root, `packages/generator/scripts/verify-${name}.ts`),
          ...selections,
        ],
        cwd: root,
      });
      break;
    }
    default:
      throw new Error(`Unknown profile: ${name}. Run 'pnpm work list'.`);
  }
  return { name, commands, repositories };
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Fingerprints content, not credentials/environment, and never makes a cache-skip decision. */
export function fingerprint(root: string) {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  const untracked = git("ls-files", "--others", "--exclude-standard", "-z")
    .toString()
    .split("\0")
    .filter(Boolean)
    .sort()
    .map((path) => {
      const full = join(root, path);
      const info = lstatSync(full);
      return [
        path,
        info.mode,
        info.isSymbolicLink() ? sha256(readlinkSync(full)) : sha256(readFileSync(full)),
      ];
    });
  return {
    repository: root,
    head: git("rev-parse", "HEAD").toString().trim(),
    statusSha256: sha256(git("status", "--porcelain=v1", "-z", "--untracked-files=all")),
    diffSha256: sha256(git("diff", "HEAD", "--binary", "--no-ext-diff", "--no-textconv")),
    untrackedSha256: sha256(JSON.stringify(untracked)),
  };
}

type Result = {
  schemaVersion: 1;
  id: string;
  profile: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  status: "running" | "passed" | "failed" | "interrupted";
  processId: number;
  before: ReturnType<typeof fingerprint>[];
  after?: ReturnType<typeof fingerprint>[];
  sourceChanged?: boolean;
  commands: (Command & { exitCode?: number | null; signal?: string | null })[];
  log: string;
  error?: string;
};

/** Sequential child processes; signals reach the process group so fixture cleanup can run. */
export async function runWork(root: string, plan: WorkPlan): Promise<number> {
  const id = `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${plan.name}-${randomUUID().slice(0, 8)}`;
  const directory = join(root, ".jeeves-work", "runs");
  mkdirSync(directory, { recursive: true });
  const destination = join(directory, `${id}.json`);
  const result: Result = {
    schemaVersion: 1,
    id,
    profile: plan.name,
    startedAt: new Date().toISOString(),
    status: "running",
    processId: process.pid,
    before: plan.repositories.map(fingerprint),
    commands: plan.commands.map((command) => ({ ...command })),
    log: join(directory, `${id}.log`),
  };
  const persist = () => {
    writeFileSync(`${destination}.tmp`, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
    renameSync(`${destination}.tmp`, destination);
  };
  persist();
  console.log(`RUN ${plan.name}\nLog: ${result.log}\nResult: ${destination}`);
  const fd = openSync(result.log, "wx", 0o600);
  const started = performance.now();
  let interrupted = false;
  let childId: number | undefined;
  const signal = (value: NodeJS.Signals) => {
    interrupted = true;
    if (childId) {
      try {
        process.kill(process.platform === "win32" ? childId : -childId, value);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
  };
  const interrupt = () => signal("SIGINT");
  const terminate = () => signal("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  let exitCode = 1;
  try {
    for (const command of result.commands) {
      if (interrupted) break;
      console.log(`> ${command.executable} ${command.args.join(" ")}`);
      const outcome = await new Promise<{ code: number | null; signal: string | null }>(
        (resolve, reject) => {
          const child = spawn(command.executable, command.args, {
            cwd: command.cwd,
            stdio: ["ignore", fd, fd],
            detached: process.platform !== "win32",
            env: { ...process.env, FORCE_COLOR: "0" },
          });
          childId = child.pid;
          child.once("error", reject);
          child.once("close", (code, signal) => resolve({ code, signal }));
        },
      );
      childId = undefined;
      command.exitCode = outcome.code;
      command.signal = outcome.signal;
      persist();
      exitCode = outcome.code ?? 1;
      if (exitCode !== 0 || interrupted) break;
    }
    result.status = interrupted ? "interrupted" : exitCode === 0 ? "passed" : "failed";
  } catch (error) {
    result.status = interrupted ? "interrupted" : "failed";
    result.error = error instanceof Error ? error.message : String(error);
    exitCode = 1;
  } finally {
    closeSync(fd);
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
    result.finishedAt = new Date().toISOString();
    result.durationMs = Math.round(performance.now() - started);
    try {
      result.after = plan.repositories.map(fingerprint);
      result.sourceChanged = JSON.stringify(result.before) !== JSON.stringify(result.after);
    } catch (error) {
      result.error = `Final fingerprint unavailable: ${String(error)}`;
      if (result.status === "passed") result.status = "failed";
      exitCode = 1;
    }
    persist();
  }
  console.log(
    `${result.status.toUpperCase()} ${plan.name} (${(result.durationMs / 1000).toFixed(1)}s)${result.sourceChanged ? " — source changed during run; inspect fingerprints" : ""}`,
  );
  if (result.error) console.error(result.error);
  return interrupted ? 130 : exitCode;
}
