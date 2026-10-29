/**
 * The coding agent's brief (PLAN §10, Execute step 2): the task, the element's notes and template
 * agent guide, owned paths, neighbouring contracts, the checks Jeeves will run, and `AGENTS.md`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SHARED_PATHS } from "./git.ts";
import type { GeneratedProject } from "./project.ts";
import type { PlannedTask } from "./seed.ts";

const CONTRACT_CAP = 20_000;
const BRIEF_CAP = 12_000;

/** The marker line every prompt starts with (the fake agent's scripts key on it). */
export const taskMarker = (task: PlannedTask, attempt: number) =>
  `Jeeves task: ${task.key}, attempt ${attempt}`;

export const REQUIRED_CHECKS = [
  "pnpm install",
  "pnpm -r --no-bail typecheck",
  "pnpm -r --no-bail test",
  "docker compose up --build --wait",
  "every template test pack for every element (they must stay green)",
];

/** The checks an agent can run inside the project; the test packs only run from Jeeves. */
export const AGENT_CHECKS = [
  "pnpm install",
  "pnpm -r --no-bail typecheck",
  "pnpm -r --no-bail test",
];

export type BriefInput = {
  project: GeneratedProject;
  task: PlannedTask;
  attempt: number;
  /** Set when earlier work on this task is already in the folder (a resume). */
  earlierWork?: { reason: string; diffStat: string; diff: string } | undefined;
};

/** The first prompt of a new session for a task. */
export function taskBrief({ project, task, attempt, earlierWork }: BriefInput): string {
  const { dir, lock, design } = project;
  const element = design.elements.find((e) => e.id === task.element);
  const target = task.attachment
    ? `the ${task.attachment} attachment of ${task.element}`
    : task.element;
  const parts: string[] = [
    taskMarker(task, attempt),
    "",
    `# Task: ${task.title}`,
    "",
    `You are implementing one task in a Jeeves template project, for ${target}${element ? ` ("${element.name}")` : ""}. The templates already build, start, and pass their tests; add the feature inside the extension points they give you.`,
    "",
    "## What to build",
    "",
    task.description,
    "",
    "## Acceptance tests",
    "",
    task.acceptance.length > 0
      ? `Add automated tests that prove each of these, next to the element's code, and make them pass:\n\n${task.acceptance.map((a) => `- ${a}`).join("\n")}`
      : "None were listed. Add tests for what you build.",
    "",
    "## Where you may change files",
    "",
    ...task.ownedPaths.map((p) => `- \`${p}\``),
    ...SHARED_PATHS.map((p) => `- \`${p}\` (updated by \`pnpm install\`)`),
    "",
    "Jeeves rejects and reverts changes anywhere else, and to generated-owned files (listed in `jeeves/lock.json`, e.g. `*.generated.ts`). If the task needs a change elsewhere, stop and say so in your final message.",
    "",
    "## Checks",
    "",
    "When you stop, Jeeves runs these itself; your own report doesn't count:",
    "",
    ...REQUIRED_CHECKS.map((c) => `- ${c}`),
    "",
    `Before you finish, run ${AGENT_CHECKS.map((c) => `\`${c}\``).join(", ")} yourself, and \`docker compose up --build --wait\` if Docker works where you are. The template test packs are part of Jeeves, not this project: don't look for them or try to run them (Jeeves's own source is not part of your task). If they fail, Jeeves sends you their output.`,
    "",
    "Don't commit, push, or switch branches: Jeeves commits your work after the checks pass.",
  ];

  const brief = project.briefs[task.element];
  if (brief) {
    parts.push(
      "",
      `## Element notes and template guide (jeeves/elements/${task.element}.md)`,
      "",
      cap(brief, BRIEF_CAP),
    );
  }

  const neighbours = neighbourIds(project, task.element);
  const contracts = lock.elements
    .filter((e) => neighbours.has(e.id))
    .flatMap((e) =>
      e.ownedPaths.filter((p) => p.startsWith("contracts/")).map((p) => ({ id: e.id, path: p })),
    );
  for (const { id, path } of contracts) {
    const file = join(dir, path);
    if (!existsSync(file)) continue;
    parts.push(
      "",
      `## Contract of ${id} (${path}, read-only for this task)`,
      "",
      "```yaml",
      cap(readFileSync(file, "utf8"), CONTRACT_CAP),
      "```",
    );
  }

  const agents = join(dir, "AGENTS.md");
  if (existsSync(agents)) parts.push("", "## AGENTS.md", "", readFileSync(agents, "utf8").trim());

  if (earlierWork) parts.push("", earlierWorkSection(earlierWork));
  return parts.join("\n");
}

/** The message that resumes a session after Jeeves's checks failed. */
export function followUpPrompt(task: PlannedTask, attempt: number, feedback: string): string {
  return [
    taskMarker(task, attempt),
    "",
    "Jeeves ran its checks on your work and they did not pass. Fix the problems below, keep within the paths you were given, and run the checks again before you finish.",
    "",
    feedback,
  ].join("\n");
}

function earlierWorkSection(work: NonNullable<BriefInput["earlierWork"]>): string {
  return [
    "## Earlier work on this task",
    "",
    `${work.reason} The changes below are already in the folder. Continue from them rather than starting over; check what's done before changing it.`,
    "",
    "```text",
    work.diffStat || "(no changes)",
    "```",
    "",
    "```diff",
    cap(work.diff, 30_000),
    "```",
  ].join("\n");
}

/** Elements connected to `id` in either direction. */
function neighbourIds(project: GeneratedProject, id: string): Set<string> {
  const ids = new Set<string>();
  for (const c of project.design.connections) {
    if (c.from.element === id && c.to.element !== id) ids.add(c.to.element);
    if (c.to.element === id && c.from.element !== id) ids.add(c.from.element);
  }
  return ids;
}

function cap(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n… (cut at ${max} characters)` : text;
}
