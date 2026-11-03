import {
  type BackendAcceptanceCatalog,
  backendBehaviorRequirements,
  type DeliveryModel,
  eventBehaviorId,
  idSchema,
  type ResourceConfig,
} from "@jeeves/spec";
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
  /** REST operation IDs, event:<attachment>:<event>, or explicitly registered backend behaviors. */
  operationIds: z
    .array(z.string().min(1))
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate behavior identity"),
  acceptanceIds: z
    .array(z.string().min(1))
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate acceptance identity"),
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
  deliveries: Record<string, DeliveryModel> = {},
  backend: Record<string, BackendAcceptanceCatalog> = {},
): { registrations: AcceptanceRegistration[]; files: OutputFile[] } {
  const requirements = behaviorRequirements(models, deliveries, backend);
  const suites = inputs.map((input) => fixedAcceptanceSchema.parse(input));
  const paths = suites.map(acceptancePath);
  if (new Set(paths).size !== paths.length) throw new Error("Duplicate fixed acceptance suite");
  const shared = new Map<string, string>();
  for (const suite of suites) {
    const behaviors = requirements[suite.service];
    if (!behaviors)
      throw new Error(`Fixed acceptance ${suite.id}: no behavior service ${suite.service}`);
    for (const id of suite.operationIds)
      if (!behaviors.some((e) => e.id === id))
        throw new Error(`Fixed acceptance ${suite.id}: unknown extension operation or event ${id}`);
    for (const id of suite.acceptanceIds)
      if (
        ![
          ...(suite.operationIds.some((id) => !id.startsWith("backend:"))
            ? (models[suite.service]?.acceptanceCases ?? [])
            : []),
          ...behaviors
            .filter((e) =>
              e.id.startsWith("backend:")
                ? suite.operationIds.includes(e.id)
                : suite.operationIds.some((id) => !id.startsWith("backend:")),
            )
            .flatMap((e) => e.acceptance),
        ].includes(id)
      )
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
  deliveries: Record<string, DeliveryModel> = {},
  backend: Record<string, BackendAcceptanceCatalog> = {},
): string[] {
  const problems: string[] = [];
  for (const [service, model] of Object.entries(models))
    for (const ref of model.acceptanceCases)
      if (!suites.some((suite) => suite.service === service && suite.acceptanceIds.includes(ref)))
        problems.push(`${service}/${ref}: no fixed acceptance suite is registered`);
  for (const [service, model] of Object.entries(deliveries))
    for (const event of model.config.events)
      for (const ref of event.acceptance)
        if (
          !suites.some(
            (suite) =>
              suite.service === service &&
              suite.operationIds.includes(eventBehaviorId(model.attachment, event.id)) &&
              suite.acceptanceIds.includes(ref),
          )
        )
          problems.push(
            `${service}/${event.id}/${ref}: no fixed event acceptance suite is registered`,
          );
  for (const [service, catalog] of Object.entries(backend))
    for (const behavior of backendBehaviorRequirements(catalog))
      for (const ref of behavior.acceptance)
        if (
          !suites.some(
            (suite) =>
              suite.service === service &&
              suite.operationIds.includes(behavior.id) &&
              suite.acceptanceIds.includes(ref),
          )
        )
          problems.push(
            `${service}/${behavior.id}/${ref}: no fixed backend acceptance suite is registered`,
          );
  return problems;
}

/** Coverage is explicit; a handler or a green process is not application acceptance. */
export function acceptanceCoverageProblems(
  models: Record<string, ResourceConfig>,
  suites: AcceptanceRegistration[],
  required: Record<string, string[]>,
  deliveries: Record<string, DeliveryModel> = {},
  backend: Record<string, BackendAcceptanceCatalog> = {},
): string[] {
  const requirements = behaviorRequirements(models, deliveries, backend);
  const problems: string[] = [];
  for (const [service, ids] of Object.entries(required)) {
    for (const id of ids) {
      const extension = requirements[service]?.find((e) => e.id === id);
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

/** One acceptance namespace, with explicit non-HTTP event identities. */
export function behaviorRequirements(
  models: Record<string, ResourceConfig>,
  deliveries: Record<string, DeliveryModel> = {},
  backend: Record<string, BackendAcceptanceCatalog> = {},
): Record<string, { id: string; acceptance: string[] }[]> {
  const requirements = Object.fromEntries(
    [...new Set([...Object.keys(models), ...Object.keys(deliveries), ...Object.keys(backend)])].map(
      (service) => [
        service,
        [
          ...(models[service]?.extensions ?? []).map((e) => ({
            id: e.operationId,
            acceptance: e.acceptance,
          })),
          ...(deliveries[service]?.config.events ?? []).map((e) => ({
            id: eventBehaviorId(deliveries[service]!.attachment, e.id),
            acceptance: e.acceptance,
          })),
          ...(backend[service] ? backendBehaviorRequirements(backend[service]) : []),
        ],
      ],
    ),
  );
  for (const behaviors of Object.values(requirements))
    if (new Set(behaviors.map((b) => b.id)).size !== behaviors.length)
      throw new Error("Duplicate acceptance behavior identity");
  return requirements;
}
