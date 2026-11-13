import { describe, expect, it } from "vitest";
import {
  type CodexLoginState,
  createCodexLogin,
  LOGIN_LIMIT_MS,
  LOGOUT_LIMIT_MS,
  URL_WAIT_MS,
} from "./codex-login.ts";
import { fakeClock, fakeCodexSpawn } from "./test-support.ts";

// No test here runs `codex`: every process is a fake, and every timer is on a fake clock.
const URL = "https://auth.example.invalid/oauth/authorize?client_id=jeeves-test&state=abc";
const ENV = { CODEX_HOME: "/nowhere/codex-test" };

/** `null` leaves out `codexPath`. */
function setup(codexPath: string | null = "/opt/fake/codex") {
  const fake = fakeCodexSpawn();
  const time = fakeClock();
  const login = createCodexLogin({
    ...(codexPath ? { codexPath } : {}),
    spawn: fake.spawn,
    env: ENV,
    clock: time.clock,
  });
  const child = (n = 0) => {
    const found = fake.children[n];
    if (!found) throw new Error(`no process ${n}`);
    return found;
  };
  return { ...fake, ...time, login, child };
}

/** A promise's value, or "pending" if it hasn't settled once queued work has run. */
async function peek<T>(promise: Promise<T>): Promise<T | "pending"> {
  return Promise.race([promise, new Promise<"pending">((r) => setImmediate(() => r("pending")))]);
}

describe("createCodexLogin", () => {
  it("runs `<codexPath> login` and answers with the URL it prints on stdout", async () => {
    const { login, calls, child } = setup();
    const started = login.start();
    expect(calls).toEqual([{ command: "/opt/fake/codex", args: ["login"], env: ENV }]);
    expect(login.state()).toEqual({ state: "waiting" });

    child().print("stdout", "Starting local login server on http://localhost:1455.\n");
    expect(await peek(started)).toBe("pending");
    // Wrapped in terminal colour codes, as a CLI may print it.
    child().print("stdout", `Open this URL to sign in:\n\u001b[94m${URL}\u001b[0m\n`);
    expect(await started).toEqual({ state: "waiting", url: URL });
    expect(login.state()).toEqual({ state: "waiting", url: URL });
    expect(child().killed).toBe(false);
  });

  it("finds the URL on stderr too, across chunks", async () => {
    const { login, child } = setup();
    const started = login.start();
    child().print("stderr", URL.slice(0, 20));
    expect(await peek(started)).toBe("pending");
    child().print("stderr", `${URL.slice(20)}\r\n`);
    expect(await started).toEqual({ state: "waiting", url: URL });
  });

  it("answers waiting without a URL after 10 seconds, and keeps reading", async () => {
    const { login, child, advance } = setup();
    const started = login.start();
    child().print("stdout", "Starting local login server…\n");
    advance(URL_WAIT_MS - 1);
    expect(await peek(started)).toBe("pending");
    advance(1);
    expect(await started).toEqual({ state: "waiting" });
    child().print("stdout", `${URL}\n`);
    expect(login.state()).toEqual({ state: "waiting", url: URL });
  });

  it("gives a second start the running login's state instead of starting another", async () => {
    const { login, calls, child } = setup();
    const first = login.start();
    const second = login.start();
    child().print("stdout", `${URL}\n`);
    const expected: CodexLoginState = { state: "waiting", url: URL };
    expect(await first).toEqual(expected);
    expect(await second).toEqual(expected);
    expect(await login.start()).toEqual(expected);
    expect(calls).toHaveLength(1);
  });

  it("fails with the last output line when codex exits non-zero, and can start again", async () => {
    const { login, calls, child } = setup();
    const started = login.start();
    child().print("stdout", `${URL}\n`);
    await started;
    child().print("stderr", "Error logging in: the browser sign-in was cancelled\n\n");
    child().exit(1);
    expect(login.state()).toEqual({
      state: "failed",
      message: "Error logging in: the browser sign-in was cancelled",
    });

    // An exit before any URL answers start() with the failure.
    const again = login.start();
    expect(calls).toHaveLength(2);
    child(1).print("stderr", "Error: port 1455 is already in use");
    child(1).exit(2);
    expect(await again).toEqual({ state: "failed", message: "Error: port 1455 is already in use" });
  });

  it("goes back to idle when the login finishes (exit 0)", async () => {
    const { login, child, pending } = setup();
    const started = login.start();
    child().print("stdout", `${URL}\n`);
    await started;
    child().print("stdout", "Successfully logged in\n");
    child().exit(0);
    expect(login.state()).toEqual({ state: "idle" });
    expect(pending()).toBe(0);
  });

  it("kills the process after 10 minutes", async () => {
    const { login, child, advance } = setup();
    const started = login.start();
    child().print("stdout", `${URL}\n`);
    await started;
    advance(LOGIN_LIMIT_MS - 1);
    expect(child().killed).toBe(false);
    advance(1);
    expect(child().killed).toBe(true);
    child().exit(null);
    expect(login.state()).toEqual({
      state: "failed",
      message: "The sign-in timed out after 10 minutes.",
    });
  });

  it("fails with why when codex can't be run", async () => {
    const { login, child } = setup(null);
    const started = login.start();
    child().emit("error", new Error("spawn codex ENOENT"));
    child().exit(-2);
    expect(await started).toEqual({
      state: "failed",
      message: "Couldn't run codex: spawn codex ENOENT",
    });

    const throwing = createCodexLogin({
      spawn: () => {
        throw new Error("EACCES");
      },
      env: ENV,
      clock: fakeClock().clock,
    });
    expect(await throwing.start()).toEqual({
      state: "failed",
      message: "Couldn't run codex: EACCES",
    });
  });

  it("runs `codex` from the PATH when no codexPath is given", () => {
    const { login, calls } = setup(null);
    void login.start();
    expect(calls[0]?.command).toBe("codex");
  });

  it("stops a running login when asked (the server closing)", async () => {
    const { login, child } = setup();
    const started = login.start();
    login.stop();
    expect(child().killed).toBe(true);
    child().exit(null);
    expect(await started).toEqual({ state: "idle" });
  });

  it("signs out with `<codexPath> logout`", async () => {
    const { login, calls, child } = setup();
    const out = login.signOut();
    expect(calls).toEqual([{ command: "/opt/fake/codex", args: ["logout"], env: ENV }]);
    child().print("stdout", "Successfully logged out\n");
    child().exit(0);
    await expect(out).resolves.toBeUndefined();
    expect(login.state()).toEqual({ state: "idle" });
  });

  it("rejects a sign-out that fails or hangs", async () => {
    const { login, child, advance } = setup();
    const failed = login.signOut();
    child().print("stderr", "Error: could not remove the login\n");
    child().exit(1);
    await expect(failed).rejects.toThrow("Error: could not remove the login");

    const hung = login.signOut();
    advance(LOGOUT_LIMIT_MS);
    expect(child(1).killed).toBe(true);
    child(1).exit(null);
    await expect(hung).rejects.toThrow("codex logout stopped (exit code none).");
  });
});
