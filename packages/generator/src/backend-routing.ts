/** Explicit pure planning dispatch. Backend plans cannot reach the legacy emitter. */
import type { DesignDocument } from "@jeeves/spec";
import { planBackend } from "./backend-compile.ts";
import type { BackendPlan, BackendPlanMode } from "./backend-ir.ts";
import type { TemplateSet } from "./modules.ts";
import { type PlanOptions, type ProjectPlan, planProject } from "./plan.ts";

export function planGeneration(
  design: DesignDocument,
  templates: TemplateSet,
  options: PlanOptions & { backendMode?: BackendPlanMode },
): { path: "backend-plan"; plan: BackendPlan } | { path: "legacy"; plan: ProjectPlan } {
  if (design.architecture?.backend) {
    if (!options.backendMode)
      throw new Error(
        "Select an explicit analysis, foundation or complete mode for the backend plan preview.",
      );
    return {
      path: "backend-plan",
      plan: planBackend(design, templates.lookup, { mode: options.backendMode }),
    };
  }
  if (options.backendMode)
    throw new Error("Backend planning requires an opted-in versioned backend model.");
  return { path: "legacy", plan: planProject(design, templates, options) };
}
