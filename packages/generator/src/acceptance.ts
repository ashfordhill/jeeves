import { idSchema, type ResourceConfig } from "@jeeves/spec";
import type { OutputFile } from "@jeeves/template-kit";
import { z } from "zod";

const slug = idSchema;
const exactVersion = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const relativeFile = z
  .string()
  .min(1)
  .regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/, "Use a relative path");
const dependency = z.strictObject({
  name: z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
  version: exactVersion,
});
/** Fixed project tests are supplied by the project owner, before coding, through generation. */
export const fixedAcceptanceSchema = z.strictObject({
  id: slug,
  service: slug,
  operationIds: z.array(z.string().min(1)).min(1),
  acceptanceIds: z.array(z.string().min(1)).min(1),
  /** `frontend` suites wait for the frontend task; extension suites run when their ops are due. */
  requires: z.enum(["extensions", "frontend"]).optional(),
  runner: z.enum(["node", "playwright"]).optional(),
  /** Exact test-only dependencies for the generated project root. */
  dependencies: z.array(dependency).optional(),
  /** Generated-owned helper files, relative to tests/acceptance/<service>/ and shared by suites. */
  files: z.array(z.strictObject({ path: relativeFile, contents: z.string() })).optional(),
  source: z.string().min(1),
});
export type FixedAcceptance = z.infer<typeof fixedAcceptanceSchema>;
/** The registration kept in the lock; file contents are read back from the generated project. */
export const acceptanceRegistrationSchema = fixedAcceptanceSchema.omit({ source: true }).extend({
  files: z.array(z.strictObject({ path: relativeFile })).default([]),
});
export type AcceptanceRegistration = z.infer<typeof acceptanceRegistrationSchema>;
export const acceptancePath = (suite: Pick<AcceptanceRegistration, "id" | "service">) =>
  `tests/acceptance/${suite.service}/${suite.id}.test.ts`;
export const acceptanceSupportPath = (
  suite: Pick<AcceptanceRegistration, "service">,
  file: { path: string },
) => `tests/acceptance/${suite.service}/${file.path}`;

export function acceptanceFiles(
  inputs: FixedAcceptance[],
  models: Record<string, ResourceConfig>,
): { registrations: AcceptanceRegistration[]; files: OutputFile[] } {
  const suites = inputs.map((input) => fixedAcceptanceSchema.parse(input));
  const paths = suites.map(acceptancePath);
  if (new Set(paths).size !== paths.length) throw new Error("Duplicate fixed acceptance suite");
  const shared = new Map<string, string>();
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
    const files = suite.files ?? [];
    for (const file of files) {
      const path = acceptanceSupportPath(suite, file);
      const existing = shared.get(path);
      if (existing !== undefined && existing !== file.contents)
        throw new Error(`Fixed acceptance support file written differently: ${path}`);
      shared.set(path, file.contents);
    }
    if (
      suite.runner === "playwright" &&
      !(suite.dependencies ?? []).some((d) => d.name === "@playwright/test")
    )
      throw new Error(
        `Fixed acceptance ${suite.id}: the Playwright runner needs an exact @playwright/test dependency`,
      );
  }
  return {
    registrations: suites.map(({ source: _, files, ...suite }) => ({
      ...suite,
      requires: suite.requires ?? "extensions",
      runner: suite.runner ?? "node",
      dependencies: suite.dependencies ?? [],
      files: (files ?? []).map(({ path }) => ({ path })),
    })),
    files: [
      ...suites.map((suite) => ({
        path: acceptancePath(suite),
        contents: suite.source,
        ownership: "generated" as const,
      })),
      ...[...shared].map(([path, contents]) => ({
        path,
        contents,
        ownership: "generated" as const,
      })),
    ],
  };
}

/** Every declared acceptance case needs a registered suite, before a run is planned. */
export function acceptanceCaseCoverageProblems(
  models: Record<string, ResourceConfig>,
  suites: AcceptanceRegistration[],
): string[] {
  const problems: string[] = [];
  for (const [service, model] of Object.entries(models))
    for (const ref of model.acceptanceCases)
      if (!suites.some((suite) => suite.service === service && suite.acceptanceIds.includes(ref)))
        problems.push(`${service}/${ref}: no fixed acceptance suite is registered`);
  return problems;
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

/** Exact test dependencies collected from every registered suite, deduplicated. */
export function acceptanceDependencies(
  suites: AcceptanceRegistration[],
): { name: string; version: string }[] {
  const byName = new Map<string, string>();
  for (const suite of suites)
    for (const dependency of suite.dependencies ?? []) {
      const existing = byName.get(dependency.name);
      if (existing !== undefined && existing !== dependency.version)
        throw new Error(
          `Fixed acceptance suites need one version of ${dependency.name}: ${existing} and ${dependency.version}`,
        );
      byName.set(dependency.name, dependency.version);
    }
  return [...byName].map(([name, version]) => ({ name, version }));
}
