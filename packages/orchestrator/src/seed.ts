/**
 * The deterministic seed plan (PLAN §10, Plan step 1): one task per element and per attachment
 * whose implementation notes aren't empty, in dependency order.
 */
import type { Lock } from "@jeeves/generator";
import type { DesignDocument, ElementKind, TemplateLookup } from "@jeeves/spec";

export type PlannedTask = {
  /** Unique within a plan: `<element>`, `<element>.<attachment>`, plus `-2`, `-3`… for splits. */
  key: string;
  element: string;
  /** Set when the task implements an attachment's notes. */
  attachment: string | null;
  title: string;
  description: string;
  /** Acceptance tests the task must add and pass. The seed has none; the planner adds them. */
  acceptance: string[];
  /** Paths the task may change: its element's owned paths from `jeeves/lock.json`. */
  ownedPaths: string[];
  /** Elements whose tasks should come first (this element uses, calls, or depends on them). */
  dependsOn: string[];
  source: "seed" | "planner";
};

export type TaskTarget = { element: string; attachment: string | null };

export const targetKey = (t: TaskTarget) =>
  t.attachment ? `${t.element}.${t.attachment}` : t.element;

/**
 * Tie-break between elements that don't depend on each other, so data comes before services and
 * services before frontends (PLAN §10).
 */
const kindRank: Record<ElementKind, number> = {
  database: 0,
  library: 1,
  external: 1,
  service: 2,
  worker: 3,
  frontend: 4,
};

/** Elements in implementation order: dependencies first, then by kind, then document order. */
export function elementOrder(design: DesignDocument, templates: TemplateLookup): string[] {
  const deps = dependencies(design);
  const rank = new Map(
    design.elements.map((element, index) => {
      const manifest = element.template ? templates.get(element.template) : undefined;
      const kind = manifest?.kind === "element" ? kindRank[manifest.elementKind] : 5;
      return [element.id, kind * 10_000 + index] as const;
    }),
  );
  const byRank = (a: string, b: string) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
  const remaining = new Set(design.elements.map((e) => e.id));
  const order: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) =>
      [...(deps.get(id) ?? [])].every((dep) => !remaining.has(dep)),
    );
    // Cycles are allowed (services may call each other): break one at the lowest-ranked element.
    const next = (ready.length > 0 ? ready : [...remaining]).sort(byRank)[0] as string;
    order.push(next);
    remaining.delete(next);
  }
  return order;
}

/** For each element, the elements it uses, calls, or depends on (self-references dropped). */
export function dependencies(design: DesignDocument): Map<string, Set<string>> {
  const deps = new Map(design.elements.map((e) => [e.id, new Set<string>()]));
  for (const connection of design.connections) {
    if (connection.from.element === connection.to.element) continue;
    deps.get(connection.from.element)?.add(connection.to.element);
  }
  return deps;
}

export type SeedInput = {
  design: DesignDocument;
  lock: Pick<Lock, "elements">;
  templates: TemplateLookup;
};

/**
 * One task per element and per attachment with notes. An element's attachment tasks come before
 * its own task, since the element's features build on its capabilities (its API, its clients).
 */
export function seedPlan({ design, lock, templates }: SeedInput): PlannedTask[] {
  const deps = dependencies(design);
  const owned = new Map(lock.elements.map((e) => [e.id, e.ownedPaths]));
  const elements = new Map(design.elements.map((e) => [e.id, e]));
  const tasks: PlannedTask[] = [];
  for (const id of elementOrder(design, templates)) {
    const element = elements.get(id);
    if (!element) continue;
    const base = {
      element: element.id,
      acceptance: [],
      ownedPaths: owned.get(element.id) ?? [],
      dependsOn: [...(deps.get(element.id) ?? [])].sort(),
      source: "seed" as const,
    };
    for (const attachment of element.attachments) {
      if (!attachment.notes.trim()) continue;
      const capability = templates.get(attachment.template)?.displayName ?? attachment.template.id;
      tasks.push({
        ...base,
        key: targetKey({ element: element.id, attachment: attachment.id }),
        attachment: attachment.id,
        title: `Implement ${capability} (${attachment.id}) on ${element.name}`,
        description: attachment.notes.trim(),
      });
    }
    if (element.notes.trim()) {
      tasks.push({
        ...base,
        key: element.id,
        attachment: null,
        title: `Implement ${element.name}`,
        description: element.notes.trim(),
      });
    }
  }
  return tasks;
}

export type OrderProblem = { key: string; message: string };

/**
 * Tasks placed before a task of an element they depend on, e.g. after the person reorders the
 * plan. Reported as warnings; the person may know better.
 */
export function orderProblems(
  tasks: readonly Pick<PlannedTask, "key" | "element" | "title" | "dependsOn">[],
): OrderProblem[] {
  const problems: OrderProblem[] = [];
  tasks.forEach((task, index) => {
    for (const dep of task.dependsOn) {
      const later = tasks.slice(index + 1).find((t) => t.element === dep);
      if (later) {
        problems.push({
          key: task.key,
          message: `"${task.title}" comes before "${later.title}", but ${task.element} depends on ${dep}.`,
        });
      }
    }
  });
  return problems;
}
