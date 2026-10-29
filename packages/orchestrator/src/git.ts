/**
 * Git for task execution (PLAN §10, git strategy ruleset). Every run works on its own branch,
 * `jeeves/run-<id>`, made from whatever the project had checked out when the run's first task
 * started. `direct` commits each task there; `branch-per-task` works on `jeeves/run-<id>-<task>`
 * and merges it into the run branch (`--no-ff`) once Jeeves's checks pass.
 */
import { spawn } from "node:child_process";
import { realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { FileChange, GitStrategy, TaskWorkspace } from "./execute.ts";

export class GitError extends Error {}

/** Files that may change in any task: installing a dependency updates the root lockfile. */
export const SHARED_PATHS = ["pnpm-lock.yaml"];

export class Git {
  private identity: string[] | undefined;

  constructor(readonly dir: string) {}

  /** Runs git and returns stdout; throws `GitError` with git's output on a non-zero exit. */
  async run(args: string[], options: { allowFail?: boolean } = {}): Promise<string> {
    const { code, stdout, stderr } = await exec("git", args, this.dir);
    if (code !== 0 && !options.allowFail) {
      throw new GitError(`git ${args[0]} failed: ${(stderr || stdout).trim()}`);
    }
    return stdout;
  }

  async ok(args: string[]): Promise<boolean> {
    return (await exec("git", args, this.dir)).code === 0;
  }

  /** `git init` (plus a first commit) when the folder isn't a repository; refuses a sub-folder. */
  async ensureRepository(): Promise<void> {
    const top = (await exec("git", ["rev-parse", "--show-toplevel"], this.dir)).stdout.trim();
    if (!top) {
      await this.run(["init", "--quiet", "--initial-branch=main"]);
      await this.commitAll("Jeeves: initial commit");
      return;
    }
    if (realpathSync(top) !== realpathSync(this.dir)) {
      throw new GitError(
        `${this.dir} is inside the git repository at ${top}. Jeeves needs the project folder to be its own repository.`,
      );
    }
  }

  async currentBranch(): Promise<string> {
    return (await this.run(["branch", "--show-current"])).trim();
  }

  async head(): Promise<string> {
    return (await this.run(["rev-parse", "HEAD"])).trim();
  }

  async branchExists(name: string): Promise<boolean> {
    return this.ok(["rev-parse", "--verify", "--quiet", `refs/heads/${name}`]);
  }

  async dirty(): Promise<boolean> {
    return (await this.run(["status", "--porcelain", "--untracked-files=all"])).trim() !== "";
  }

  /** Stages everything (respecting `.gitignore`) and commits; returns the new HEAD. */
  async commitAll(message: string): Promise<string> {
    await this.run(["add", "--all"]);
    if (!(await this.ok(["diff", "--cached", "--quiet"])) || !(await this.hasCommits())) {
      await this.run([
        ...(await this.who()),
        "commit",
        "--quiet",
        "--no-verify",
        "--allow-empty",
        "-m",
        message,
      ]);
    }
    return this.head();
  }

  /** Files changed since `base` (committed or not, untracked included). Stages everything. */
  async changes(base: string): Promise<FileChange[]> {
    await this.run(["add", "--all"]);
    const out = await this.run(["diff", "--cached", "--name-status", "--no-renames", "-z", base]);
    const parts = out.split("\0").filter(Boolean);
    const changes: FileChange[] = [];
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const code = parts[i] ?? "";
      const status = code.startsWith("A") ? "added" : code.startsWith("D") ? "deleted" : "modified";
      changes.push({ path: parts[i + 1] ?? "", status });
    }
    return changes;
  }

  /** The staged diff against `base`, cut to `cap` characters. Call `changes` first. */
  async diff(base: string, cap = 200_000): Promise<string> {
    const out = await this.run(["diff", "--cached", "--no-color", "--no-ext-diff", base]);
    return out.length > cap ? `${out.slice(0, cap)}\n… (diff cut at ${cap} characters)\n` : out;
  }

  async diffStat(base: string): Promise<string> {
    await this.run(["add", "--all"]);
    return (await this.run(["diff", "--cached", "--stat", base])).trim();
  }

  /** Puts `paths` back as they were at `base` (removing files `base` didn't have). */
  async restore(base: string, paths: string[]): Promise<void> {
    for (const path of paths) {
      if (await this.ok(["cat-file", "-e", `${base}:${path}`])) {
        await this.run(["restore", `--source=${base}`, "--staged", "--worktree", "--", path]);
      } else {
        await this.run(["rm", "--quiet", "--cached", "--force", "--ignore-unmatch", "--", path]);
        rmSync(join(this.dir, path), { force: true });
      }
    }
  }

  /**
   * Checks out the task's branch, creating the run branch (and for `branch-per-task` the task
   * branch) the first time. Uncommitted changes found when the run branch is made are committed
   * there first, so the task's diff only shows the agent's work.
   */
  async prepare(options: {
    runId: number;
    taskKey: string;
    strategy: GitStrategy;
    workspace: TaskWorkspace | null;
  }): Promise<{ workspace: TaskWorkspace; notes: string[] }> {
    const notes: string[] = [];
    await this.ensureRepository();
    const current = await this.currentBranch();
    const { workspace } = options;
    if (workspace) {
      if (current !== workspace.branch) {
        if (await this.dirty()) {
          throw new GitError(
            `The project has uncommitted changes on ${current || "a detached HEAD"}, but this task works on ${workspace.branch}. Commit or discard them, then resume.`,
          );
        }
        await this.run(["checkout", "--quiet", workspace.branch]);
        notes.push(`Checked out ${workspace.branch}`);
      }
      return { workspace, notes };
    }

    const runBranch = `jeeves/run-${options.runId}`;
    if (!(await this.branchExists(runBranch))) {
      await this.run(["checkout", "--quiet", "-b", runBranch]);
      notes.push(`Created ${runBranch} from ${current || "HEAD"}`);
      if (await this.dirty()) {
        await this.commitAll(`Jeeves: uncommitted project changes before run ${options.runId}`);
        notes.push("Committed the project's uncommitted changes (e.g. pnpm-lock.yaml) first");
      }
    } else if (current !== runBranch) {
      if (await this.dirty()) {
        throw new GitError(
          `The project has uncommitted changes on ${current || "a detached HEAD"}. Commit or discard them, then resume.`,
        );
      }
      await this.run(["checkout", "--quiet", runBranch]);
      notes.push(`Checked out ${runBranch}`);
    } else if (await this.dirty()) {
      await this.commitAll(`Jeeves: uncommitted changes before task ${options.taskKey}`);
      notes.push("Committed uncommitted changes left on the run branch first");
    }

    let branch = runBranch;
    if (options.strategy === "branch-per-task") {
      branch = `${runBranch}-${options.taskKey}`;
      // A leftover branch from an earlier, abandoned try starts over from the run branch.
      await this.run(["checkout", "--quiet", "-B", branch]);
      notes.push(`Created ${branch}`);
    }
    return { workspace: { runBranch, branch, baseCommit: await this.head() }, notes };
  }

  /**
   * Commits the task's work. For `branch-per-task` the task branch is then merged into the run
   * branch. Returns the commit that holds the task on the run branch.
   */
  async finish(workspace: TaskWorkspace, message: string): Promise<string> {
    const commit = await this.commitAll(message);
    if (workspace.branch === workspace.runBranch) return commit;
    await this.run(["checkout", "--quiet", workspace.runBranch]);
    await this.run([
      ...(await this.who()),
      "merge",
      "--quiet",
      "--no-ff",
      "--no-verify",
      "-m",
      `Merge ${workspace.branch}\n\n${message}`,
      workspace.branch,
    ]);
    return this.head();
  }

  private async hasCommits(): Promise<boolean> {
    return this.ok(["rev-parse", "--verify", "--quiet", "HEAD"]);
  }

  /** The person's git identity when they have one; otherwise commit as Jeeves. */
  private async who(): Promise<string[]> {
    if (this.identity) return this.identity;
    const named = (await exec("git", ["config", "user.email"], this.dir)).stdout.trim();
    this.identity = named ? [] : ["-c", "user.name=Jeeves", "-c", "user.email=jeeves@localhost"];
    return this.identity;
  }
}

/** Whether `path` is inside one of the owned paths (`dir/` prefixes or exact files). */
export function isOwned(path: string, ownedPaths: readonly string[]): boolean {
  return ownedPaths.some((owned) =>
    owned.endsWith("/") ? path.startsWith(owned) : path === owned,
  );
}

function exec(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => resolve({ code: 127, stdout, stderr: error.message }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
