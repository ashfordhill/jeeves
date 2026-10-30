import { spawn } from "node:child_process";

/**
 * pnpm as Jeeves was started with (`pnpm dev`, `pnpm test`), else `JEEVES_PNPM`, else from PATH.
 * pnpm 12's `npm_execpath` is a native binary; older versions point at a JavaScript file.
 */
export function pnpmCommand(env: NodeJS.ProcessEnv = process.env): [string, ...string[]] {
  if (env.JEEVES_PNPM) return [env.JEEVES_PNPM];
  const execPath = env.npm_execpath;
  if (!execPath?.includes("pnpm")) return ["pnpm"];
  return /\.[cm]?js$/.test(execPath) ? [process.execPath, execPath] : [execPath];
}

export interface RunOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  /** Independent fixtures can opt out of ambient credentials and database configuration. */
  inheritEnv?: boolean;
  /** Each line of stdout and stderr, as it arrives. */
  onLine?: (line: string) => void;
  signal?: AbortSignal;
  /** Kill the command after this long. */
  timeoutMs?: number;
}

export interface RunResult {
  exitCode: number;
  /** Combined stdout and stderr, capped to the last 64 KB. */
  output: string;
  /** True when Jeeves stopped the command because it reached `timeoutMs`. */
  timedOut?: boolean;
}

const OUTPUT_CAP = 64 * 1024;
const KILL_GRACE_MS = 5000;

/** Runs a command without a shell and resolves with its exit code; it never rejects on failure. */
export function runCommand(
  command: string,
  args: string[],
  options: RunOptions,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...(options.inheritEnv === false ? {} : process.env), ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
      // A new process group, so a timeout or cancel can kill pnpm/vitest/Playwright grandchildren.
      detached: true,
    });
    let output = "";
    let partial = "";
    let timedOut = false;
    let killTimer: NodeJS.Timeout | undefined;
    let timeoutTimer: NodeJS.Timeout | undefined;
    let settling = false;
    const take = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      output = (output + text).slice(-OUTPUT_CAP);
      if (!options.onLine) return;
      const lines = (partial + text).split(/\r?\n|\r/);
      partial = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) options.onLine(line);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    const killGroup = () => {
      if (!child.pid || killTimer || settling) return;
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
      killTimer = setTimeout(() => {
        if (!child.pid) return;
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          // Already gone.
        }
      }, KILL_GRACE_MS);
      killTimer.unref();
    };
    if (options.timeoutMs) {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        killGroup();
      }, options.timeoutMs);
      timeoutTimer.unref();
    }
    const onAbort = () => killGroup();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) killGroup();
    const cleanup = () => {
      settling = true;
      // Keep the SIGKILL backstop alive even after the direct child closes: a grandchild that
      // ignores SIGTERM must still lose its process group.
      if (timeoutTimer) clearTimeout(timeoutTimer);
      options.signal?.removeEventListener("abort", onAbort);
    };
    let settled = false;
    const settle = (result: RunResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (partial.trim()) options.onLine?.(partial);
      resolve({ ...result, ...(timedOut && { timedOut: true }) });
    };
    // A command that can't start (not installed) reports here, possibly without "close".
    child.on("error", (error) => settle({ exitCode: 127, output: `${output}\n${error.message}` }));
    child.on("close", (code, signal) => settle({ exitCode: code ?? (signal ? 128 : 1), output }));
  });
}
