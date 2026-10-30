import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runCommand } from "./exec.ts";

const dir = mkdtempSync(join(tmpdir(), "jeeves-exec-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function psContains(pid: number): boolean {
  try {
    return execFileSync("ps", ["-p", String(pid)], { encoding: "utf8" }).includes(String(pid));
  } catch {
    return false;
  }
}

describe("runCommand process groups", () => {
  it("kills a timed-out command's whole group, not just the shell", async () => {
    const pids: number[] = [];
    const result = await runCommand("sh", ["-c", "sleep 60 & echo $!; wait"], {
      cwd: dir,
      timeoutMs: 200,
      onLine: (line) => {
        const pid = Number(line.trim());
        if (Number.isInteger(pid) && pid > 0) pids.push(pid);
      },
    });
    expect(result.timedOut).toBe(true);
    expect(pids).toHaveLength(1);
    const pid = pids[0]!;
    await expect.poll(() => alive(pid), { timeout: 2000 }).toBe(false);
    expect(psContains(pid)).toBe(false);
  });

  it("kills the group when the signal aborts", async () => {
    const pids: number[] = [];
    const abort = new AbortController();
    const running = runCommand("sh", ["-c", "sleep 60 & echo $!; wait"], {
      cwd: dir,
      signal: abort.signal,
      onLine: (line) => {
        const pid = Number(line.trim());
        if (Number.isInteger(pid) && pid > 0) pids.push(pid);
      },
    });
    await expect.poll(() => pids.length).toBe(1);
    abort.abort();
    await running;
    await expect.poll(() => alive(pids[0]!), { timeout: 2000 }).toBe(false);
  });

  it("SIGKILLs a process group that ignores SIGTERM", async () => {
    const started = Date.now();
    const result = await runCommand("sh", ["-c", "trap '' TERM; exec sleep 60"], {
      cwd: dir,
      timeoutMs: 100,
    });
    expect(result.timedOut).toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(4900);
  }, 10_000);
});
