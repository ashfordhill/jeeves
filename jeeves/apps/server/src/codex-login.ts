/**
 * Settings' Sign in with ChatGPT: runs `codex login` for the person and reports the sign-in page
 * it prints, and `codex logout` to sign out. Codex keeps its own credentials: Jeeves never reads
 * them (`Settings.codexLoggedIn()` only checks that Codex's file exists).
 */
import { StringDecoder } from "node:string_decoder";

/** How long `start()` reads the login's output for a URL before answering without one. */
export const URL_WAIT_MS = 10_000;
/** How long a login may wait for the browser before its process is killed. */
export const LOGIN_LIMIT_MS = 10 * 60_000;
/** How long `codex logout` may take before its process is killed. */
export const LOGOUT_LIMIT_MS = 10_000;

export type CodexLoginState =
  | { state: "idle" }
  /** `codex login` is running; `url` is the sign-in page it printed, once it has. */
  | { state: "waiting"; url?: string }
  /** The login ended without signing in; `message` is its last output line. */
  | { state: "failed"; message: string };

/** The part of a child process's output stream the login reads. */
type Output = { on(event: "data", listener: (chunk: Buffer | string) => void): unknown };

/** The part of a child process the login uses. */
export type CodexProcess = {
  stdout: Output | null;
  stderr: Output | null;
  once(event: "error", listener: (err: Error) => void): unknown;
  once(event: "close", listener: (code: number | null) => void): unknown;
  kill(): boolean;
};

/** `child_process.spawn`, or a fake in tests. */
export type CodexSpawn = (
  command: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; stdio: ["ignore", "pipe", "pipe"] },
) => CodexProcess;

export type Clock = {
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(timer: unknown): void;
};

const systemClock: Clock = {
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
};

export type CodexLoginOptions = {
  /** The Codex executable (`JEEVES_CODEX_PATH`, as chat's Codex provider uses); else `codex`. */
  codexPath?: string;
  spawn: CodexSpawn;
  /** The environment Codex runs with (where it keeps its login: `CODEX_HOME` or `~/.codex`). */
  env: NodeJS.ProcessEnv;
  clock?: Clock;
};

export type CodexLogin = {
  /**
   * Starts `codex login` and answers with the first `https://` URL it prints within
   * `URL_WAIT_MS`, if any. While a login runs, answers with that login's state instead.
   */
  start(): Promise<CodexLoginState>;
  state(): CodexLoginState;
  /** Runs `codex logout`; rejects with its last output line if it fails. */
  signOut(): Promise<void>;
  /** Kills a running login (when the server closes). */
  stop(): void;
};

const URL_PATTERN = /https:\/\/[^\s"'<>]+/;
// Terminal colour and cursor codes (ESC [ … letter) a CLI may wrap around a line.
const TERMINAL_CODE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, "g");

/** Calls `onLine` for each line of `stream`; `flush()` hands over a last line with no newline. */
function readLines(stream: Output | null, onLine: (line: string) => void) {
  const decoder = new StringDecoder("utf8");
  let rest = "";
  const take = (text: string) => {
    const parts = (rest + text).split(/\r\n|\r|\n/);
    rest = parts.pop() ?? "";
    for (const part of parts) onLine(part);
  };
  stream?.on("data", (chunk) => take(typeof chunk === "string" ? chunk : decoder.write(chunk)));
  return {
    flush() {
      take(decoder.end());
      if (rest) onLine(rest);
      rest = "";
    },
  };
}

/** Runs one Codex command; keeps its last non-empty output line. */
function run(
  { codexPath, spawn, env }: Required<Pick<CodexLoginOptions, "codexPath" | "spawn" | "env">>,
  command: "login" | "logout",
  onLine: (line: string) => void = () => {},
) {
  let lastLine: string | undefined;
  const child = spawn(codexPath, [command], { env, stdio: ["ignore", "pipe", "pipe"] });
  const keep = (raw: string) => {
    const line = raw.replace(TERMINAL_CODE, "").trim();
    if (!line) return;
    lastLine = line;
    onLine(line);
  };
  const outputs = [readLines(child.stdout, keep), readLines(child.stderr, keep)];
  return {
    child,
    lastLine: () => lastLine,
    flush: () => {
      for (const output of outputs) output.flush();
    },
  };
}

const couldNotRun = (codexPath: string, err: unknown) =>
  `Couldn't run ${codexPath}: ${err instanceof Error ? err.message : String(err)}`;

export function createCodexLogin({
  codexPath = "codex",
  spawn,
  env,
  clock = systemClock,
}: CodexLoginOptions): CodexLogin {
  const cli = { codexPath, spawn, env };
  let current: CodexLoginState = { state: "idle" };
  /** The running login, and the promise that settles when `start()` should answer. */
  let running: { kill: () => void; answered: Promise<void> } | undefined;

  function start(): Promise<CodexLoginState> {
    if (running) return running.answered.then(() => current);

    let answer = () => {};
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    let ended = false;
    let timedOut = false;
    let stopped = false;

    let login: ReturnType<typeof run>;
    try {
      login = run(cli, "login", (line) => {
        if (ended || current.state !== "waiting" || current.url) return;
        const url = line.match(URL_PATTERN)?.[0];
        if (!url) return;
        current = { state: "waiting", url };
        answer();
      });
    } catch (err) {
      current = { state: "failed", message: couldNotRun(codexPath, err) };
      return Promise.resolve(current);
    }

    const { child } = login;
    const kill = () => {
      child.kill();
    };
    const urlTimer = clock.setTimeout(answer, URL_WAIT_MS);
    const limitTimer = clock.setTimeout(() => {
      timedOut = true;
      kill();
    }, LOGIN_LIMIT_MS);
    const end = (next: CodexLoginState) => {
      if (ended) return;
      ended = true;
      clock.clearTimeout(urlTimer);
      clock.clearTimeout(limitTimer);
      running = undefined;
      current = next;
      answer();
    };
    child.once("error", (err) => end({ state: "failed", message: couldNotRun(codexPath, err) }));
    child.once("close", (code) => {
      login.flush();
      if (stopped) end({ state: "idle" });
      else if (timedOut)
        end({ state: "failed", message: "The sign-in timed out after 10 minutes." });
      else if (code === 0) end({ state: "idle" });
      else {
        end({
          state: "failed",
          message: login.lastLine() ?? `codex login stopped (exit code ${code ?? "none"}).`,
        });
      }
    });

    current = { state: "waiting" };
    running = {
      kill: () => {
        stopped = true;
        kill();
      },
      answered,
    };
    return answered.then(() => current);
  }

  function signOut(): Promise<void> {
    return new Promise((resolve, reject) => {
      let logout: ReturnType<typeof run>;
      try {
        logout = run(cli, "logout");
      } catch (err) {
        reject(new Error(couldNotRun(codexPath, err)));
        return;
      }
      const { child } = logout;
      let done = false;
      const timer = clock.setTimeout(() => child.kill(), LOGOUT_LIMIT_MS);
      const finish = (failure?: string) => {
        if (done) return;
        done = true;
        clock.clearTimeout(timer);
        if (failure) {
          reject(new Error(failure));
          return;
        }
        // An earlier failed login no longer applies once signed out.
        if (!running) current = { state: "idle" };
        resolve();
      };
      child.once("error", (err) => finish(couldNotRun(codexPath, err)));
      child.once("close", (code) => {
        logout.flush();
        if (code === 0) finish();
        else finish(logout.lastLine() ?? `codex logout stopped (exit code ${code ?? "none"}).`);
      });
    });
  }

  return {
    start,
    state: () => current,
    signOut,
    stop: () => running?.kill(),
  };
}
