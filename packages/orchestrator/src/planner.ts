/**
 * Planner-model refinement of the seed plan (PLAN §10, Plan step 2). The model may split a task
 * and must give every task acceptance tests. It can only plan work for the seed's elements and
 * attachments, and owned paths and dependencies always come from the seed, so a task never
 * leaves its element's owned paths whatever the model says.
 */
import {
  type ModelItem,
  type ModelProvider,
  ProviderError,
  type ToolDefinition,
} from "@jeeves/providers";
import { z } from "zod";
import { type PlannedTask, type TaskTarget, targetKey } from "./seed.ts";

export const MAX_PLAN_TASKS = 40;
/** Model calls per refinement, including corrections after an invalid plan. */
export const MAX_PLANNER_ROUNDS = 3;
/** Characters of each element brief sent to the planner. */
const BRIEF_LIMIT = 12_000;

export const plannedTaskEditSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20_000),
  acceptance: z.array(z.string().trim().min(1).max(500)).max(20),
});

const refinedTaskSchema = z.strictObject({
  element: z.string().describe("Element ID, from the seed plan"),
  attachment: z
    .string()
    .nullable()
    .optional()
    .describe("Attachment ID when the task implements an attachment's notes; omit otherwise"),
  title: z.string().trim().min(1).max(200).describe("Short imperative title"),
  description: z
    .string()
    .trim()
    .min(1)
    .max(20_000)
    .describe("What to build, specific enough for a coding agent; Markdown"),
  acceptance: z
    .array(z.string().trim().min(1).max(500))
    .min(1)
    .max(10)
    .describe("Acceptance tests the task must add and pass, each one checkable by a test"),
});

export const submitPlanSchema = z.strictObject({
  tasks: z.array(refinedTaskSchema).min(1).max(MAX_PLAN_TASKS),
  summary: z.string().max(2_000).optional().describe("One or two sentences on what you changed"),
});
export type SubmittedPlan = z.infer<typeof submitPlanSchema>;

export const SUBMIT_PLAN = "submitPlan";

export function plannerTools(): ToolDefinition[] {
  return [
    {
      name: SUBMIT_PLAN,
      description:
        "Submit the refined plan: every task, in order. Call it exactly once; if it returns errors, fix them and call it again.",
      parameters: z.toJSONSchema(submitPlanSchema, { io: "input" }) as Record<string, unknown>,
    },
  ];
}

export const PLANNER_INSTRUCTIONS = `You are the planner in Jeeves. Jeeves has generated a template project from a design: every element is a working, tested template with no features yet. Coding agents will implement the elements' implementation notes one task at a time, and Jeeves runs the tests after each task.

Refine the seed plan you are given, then call submitPlan once with the whole plan.

Rules:
- Plan only the elements and attachments in the seed. Never add work the notes don't ask for.
- Cover every seed task. Keep a seed task whole when it is small; split one into a few tasks only when it is large, so each task is one coherent change a coding agent can finish and test.
- Give every task one to five acceptance tests: concrete behaviour a test can check, such as "POST /api/links with a valid URL returns 201 and a 6-character code".
- Keep the seed's order. Within one element, order the tasks so each builds on the ones before it.
- A task changes only its element's owned paths. Don't plan changes to other elements, to generated files, or to the runtime libraries.
- Write titles as short imperatives. Descriptions say what to build, not how the template works.`;

export type PlannerInput = {
  projectName: string;
  seed: PlannedTask[];
  /** `jeeves/elements/<id>.md` per element, by element ID. */
  briefs: Record<string, string>;
};

/** The person-style message that starts the planner conversation. */
export function plannerMessage({ projectName, seed, briefs }: PlannerInput): string {
  const seedJson = seed.map((t) => ({
    element: t.element,
    ...(t.attachment && { attachment: t.attachment }),
    title: t.title,
    notes: t.description,
    dependsOn: t.dependsOn,
  }));
  const elements = [...new Set(seed.map((t) => t.element))];
  const sections = elements.map((id) => {
    const brief = briefs[id] ?? "(no brief)";
    const text =
      brief.length > BRIEF_LIMIT ? `${brief.slice(0, BRIEF_LIMIT)}\n\n[brief truncated]` : brief;
    return `### Element brief: ${id}\n\n${text}`;
  });
  return [
    `Refine the seed plan for the template project "${projectName}".`,
    "## Seed plan (in dependency order)",
    `\`\`\`json\n${JSON.stringify(seedJson, null, 2)}\n\`\`\``,
    "## Element briefs",
    ...sections,
  ].join("\n\n");
}

export type CheckedPlan = { ok: true; tasks: PlannedTask[] } | { ok: false; errors: string[] };

/**
 * Checks a submitted plan against the seed and turns it into tasks: targets must be seed
 * targets, every seed target must be covered, and the result is put back in seed order (keeping
 * the model's order within each target). Owned paths and dependencies come from the seed.
 */
export function checkSubmittedPlan(seed: PlannedTask[], plan: SubmittedPlan): CheckedPlan {
  if (seed.some((task) => task.key.includes(".extension.") || task.key.includes(".event.")))
    return {
      ok: false,
      errors: [
        "Structured extension tasks and fixed acceptance references cannot be redefined by a planner.",
      ],
    };
  const seedByTarget = new Map(seed.map((t) => [targetKey(t), t]));
  const allowed = [...seedByTarget.keys()].map((k) => `"${k}"`).join(", ");
  const errors: string[] = [];
  const grouped = new Map<string, SubmittedPlan["tasks"]>();
  plan.tasks.forEach((task, index) => {
    const target: TaskTarget = { element: task.element, attachment: task.attachment ?? null };
    const key = targetKey(target);
    if (!seedByTarget.has(key)) {
      errors.push(
        `tasks[${index}] is for ${target.attachment ? `attachment "${target.attachment}" on ` : ""}element "${target.element}", which has no seed task. Allowed targets (element or element.attachment): ${allowed}.`,
      );
      return;
    }
    grouped.set(key, [...(grouped.get(key) ?? []), task]);
  });
  for (const key of seedByTarget.keys()) {
    if (!grouped.has(key)) errors.push(`The seed task for "${key}" isn't covered by any task.`);
  }
  if (errors.length > 0) return { ok: false, errors };

  const tasks: PlannedTask[] = [];
  for (const [key, seedTask] of seedByTarget) {
    const group = grouped.get(key) ?? [];
    group.forEach((task, index) => {
      tasks.push({
        ...seedTask,
        key: index === 0 ? key : `${key}-${index + 1}`,
        title: task.title,
        description: task.description,
        acceptance: task.acceptance,
        source: "planner",
      });
    });
  }
  return { ok: true, tasks };
}

export type RefineUsage = { inputTokens: number; outputTokens: number; known: boolean };

export type RefineResult =
  | { ok: true; tasks: PlannedTask[]; summary: string | null; usage: RefineUsage; rounds: number }
  | { ok: false; reason: string; usage: RefineUsage; rounds: number };

/**
 * Asks the planner model to refine the seed. Invalid plans are sent back with the errors, up to
 * `MAX_PLANNER_ROUNDS` calls. A `ProviderError` (no credit, bad key, network) is thrown, so the
 * caller can tell provider trouble from a model that never produced a valid plan.
 */
export async function refinePlan(
  provider: ModelProvider,
  model: string,
  input: PlannerInput,
  signal?: AbortSignal,
): Promise<RefineResult> {
  if (input.seed.some((task) => task.key.includes(".extension.") || task.key.includes(".event.")))
    return {
      ok: true,
      tasks: input.seed,
      summary:
        "Tasks derive from fixed extension IDs, contracts and acceptance references. No planner call was needed.",
      usage: { inputTokens: 0, outputTokens: 0, known: true },
      rounds: 0,
    };
  const items: ModelItem[] = [
    { type: "message", role: "user", content: [{ type: "text", text: plannerMessage(input) }] },
  ];
  const tools = plannerTools();
  const usage: RefineUsage = { inputTokens: 0, outputTokens: 0, known: true };
  let lastProblem = "The planner didn't submit a plan.";
  for (let round = 1; round <= MAX_PLANNER_ROUNDS; round++) {
    if (signal?.aborted) throw new ProviderError(provider.id, "other", "Planning was cancelled.");
    const response = await provider.respond(
      { model, instructions: PLANNER_INSTRUCTIONS, items, tools },
      signal ? { signal } : {},
    );
    if (response.usage) {
      usage.inputTokens += response.usage.inputTokens;
      usage.outputTokens += response.usage.outputTokens;
    } else {
      usage.known = false;
    }
    items.push(...response.items);

    const submissions = response.toolCalls.filter((c) => c.name === SUBMIT_PLAN);
    if (submissions.length === 0) {
      lastProblem = "The planner answered without calling submitPlan.";
      items.push({
        type: "message",
        role: "user",
        content: [{ type: "text", text: "Call submitPlan with the whole plan." }],
      });
      continue;
    }
    let accepted: Extract<CheckedPlan, { ok: true }> | undefined;
    let summary: string | null = null;
    for (const call of response.toolCalls) {
      let output: string;
      if (call.name !== SUBMIT_PLAN) {
        output = `Unknown tool "${call.name}". The only tool is submitPlan.`;
      } else if (accepted) {
        output = "Ignored: a plan was already accepted.";
      } else {
        const checked = parseSubmission(input.seed, call.arguments);
        if (checked.ok) {
          accepted = checked;
          summary = checked.summary;
          output = `Accepted ${checked.tasks.length} task(s).`;
        } else {
          lastProblem = `The planner's plan was invalid: ${checked.errors.join(" ")}`;
          output = `The plan was rejected. Fix these and call submitPlan again:\n- ${checked.errors.join("\n- ")}`;
        }
      }
      items.push({ type: "tool-result", callId: call.callId, output });
    }
    if (accepted) return { ok: true, tasks: accepted.tasks, summary, usage, rounds: round };
  }
  return { ok: false, reason: lastProblem, usage, rounds: MAX_PLANNER_ROUNDS };
}

function parseSubmission(
  seed: PlannedTask[],
  args: string,
): (CheckedPlan & { ok: true; summary: string | null }) | { ok: false; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(args);
  } catch {
    return { ok: false, errors: ["The arguments aren't valid JSON."] };
  }
  const parsed = submitPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const checked = checkSubmittedPlan(seed, parsed.data);
  return checked.ok ? { ...checked, summary: parsed.data.summary?.trim() || null } : checked;
}
