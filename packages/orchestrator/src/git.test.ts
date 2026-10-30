import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { Git } from "./git.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function repo(): { dir: string; git: (...args: string[]) => string } {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-git-"));
  dirs.push(dir);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "--quiet", "--initial-branch=main");
  return { dir, git };
}

const commit = (git: (...args: string[]) => string, message: string) =>
  git(
    "-c",
    "user.name=Jeeves",
    "-c",
    "user.email=jeeves@localhost",
    "commit",
    "--quiet",
    "--no-verify",
    "-m",
    message,
  );

describe("restoreGenerated", () => {
  it("restores only changed tracked generated files from HEAD", async () => {
    const { dir, git } = repo();
    writeFileSync(join(dir, "generated.ts"), "original\n");
    writeFileSync(join(dir, "other.ts"), "other\n");
    git("add", "--all");
    commit(git, "one");
    writeFileSync(join(dir, "generated.ts"), "orphaned\n");
    const result = await new Git(dir).restoreGenerated(["generated.ts", "other.ts"]);
    expect(result).toEqual({ restored: ["generated.ts"], removed: [] });
    expect(readFileSync(join(dir, "generated.ts"), "utf8")).toBe("original\n");
  });

  it("ignores a lock path that is not tracked in HEAD", async () => {
    const { dir, git } = repo();
    writeFileSync(join(dir, "generated.ts"), "original\n");
    git("add", "--all");
    commit(git, "one");
    // The file exists in the worktree but not in HEAD, as after an interrupted first prepare.
    git("rm", "--quiet", "--cached", "generated.ts");
    commit(git, "untrack");
    const result = await new Git(dir).restoreGenerated(["generated.ts"]);
    expect(result).toEqual({ restored: [], removed: [] });
    expect(existsSync(join(dir, "generated.ts"))).toBe(true);
  });
});
