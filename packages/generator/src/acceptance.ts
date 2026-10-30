import { idSchema, type ResourceConfig } from "@jeeves/spec";
import type { OutputFile } from "@jeeves/template-kit";
import { z } from "zod";

const slug = idSchema;
/** Fixed project tests are supplied by the project owner, before coding, through generation. */
export const fixedAcceptanceSchema = z.strictObject({
  id: slug,
  service: slug,
  operationIds: z.array(z.string().min(1)).min(1),
  acceptanceIds: z.array(z.string().min(1)).min(1),
  source: z.string().min(1),
});
export type FixedAcceptance = z.infer<typeof fixedAcceptanceSchema>;
export type AcceptanceRegistration = Omit<FixedAcceptance, "source">;
export const acceptancePath = (suite: AcceptanceRegistration) =>
  `tests/acceptance/${suite.service}/${suite.id}.test.ts`;

export function acceptanceFiles(
  inputs: FixedAcceptance[],
  models: Record<string, ResourceConfig>,
): { registrations: AcceptanceRegistration[]; files: OutputFile[] } {
  const suites = inputs.map((input) => fixedAcceptanceSchema.parse(input));
  const paths = suites.map(acceptancePath);
  if (new Set(paths).size !== paths.length) throw new Error("Duplicate fixed acceptance suite");
  for (const suite of suites) {
    const model = models[suite.service];
    if (!model)
      throw new Error(`Fixed acceptance ${suite.id}: no resource service ${suite.service}`);
    for (const id of suite.operationIds)
      if (!model.extensions.some((e) => e.operationId === id))
        throw new Error(`Fixed acceptance ${suite.id}: unknown extension operation ${id}`);
    for (const id of suite.acceptanceIds)
      if (!model.acceptanceCases.includes(id))
        throw new Error(`Fixed acceptance ${suite.id}: unknown acceptance reference ${id}`);
  }
  return {
    registrations: suites.map(({ source: _, ...suite }) => suite),
    files: suites.map((suite) => ({
      path: acceptancePath(suite),
      contents: suite.source,
      ownership: "generated",
    })),
  };
}

/** Coverage is explicit; a handler or a green process is not application acceptance. */
export function acceptanceCoverageProblems(
  models: Record<string, ResourceConfig>,
  suites: AcceptanceRegistration[],
  required: Record<string, string[]>,
): string[] {
  const problems: string[] = [];
  for (const [service, ids] of Object.entries(required)) {
    for (const id of ids) {
      const extension = models[service]?.extensions.find((e) => e.operationId === id);
      if (!extension) {
        problems.push(`${service}/${id}: unknown required extension operation`);
        continue;
      }
      for (const ref of extension.acceptance)
        if (
          !suites.some(
            (suite) =>
              suite.service === service &&
              suite.operationIds.includes(id) &&
              suite.operationIds.every((operation) => ids.includes(operation)) &&
              suite.acceptanceIds.includes(ref),
          )
        )
          problems.push(`${service}/${id}: uncovered required acceptance ${ref}`);
    }
  }
  return problems;
}
