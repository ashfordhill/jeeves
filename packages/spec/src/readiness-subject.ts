/** Exact finite support subject. Only revision/origin provenance and external UI/layout are omitted. */
import { canonicalJson, freezeRecord } from "./content-hash.ts";
import type { DesignDocument } from "./design.ts";
import { designScope, profileStatus } from "./design-scope.ts";
import { designOperations } from "./operation-contracts.ts";
import { designOwnership } from "./ownership.ts";
import profileRecord from "./tinyurl-readiness-profile.json" with { type: "json" };

export const tinyurlRuntimeCases = Object.freeze([
  "create-auth-and-input",
  "create-atomic-idempotency",
  "create-retention-replay",
  "create-collision-and-unknown-outcome",
  "create-total-deadline",
  "resolve-wire-outcomes",
  "resolve-primary-visibility",
  "resolve-expiry-and-no-reuse",
  "cache-validation-and-isolation",
  "cache-expiry-clamp-and-clocks",
  "cache-fallback-and-deadline",
  "primary-admission-and-cancellation",
] as const);
/** Byte-identified local v1 record, independent of future catalog additions. */
export const tinyurlReadinessProfile = freezeRecord(profileRecord);
export const tinyurlReadinessProfileRef = tinyurlReadinessProfile.ref;

/** These collections are sets. Sort whole rows, including ties, without locale dependence. */
export const canonicalRows = <T>(rows: readonly T[]): T[] =>
  [...rows].sort((a, b) => {
    const left = canonicalJson(a),
      right = canonicalJson(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });

export function readinessSubject(design: DesignDocument) {
  const architecture = design.architecture,
    studio = architecture?.studio;
  const scope = designScope(design),
    ownership = designOwnership(design);
  const subject = {
    domain: "jeeves.tinyurl.composition.v1" as const,
    sourceSchemaVersion: design.schemaVersion,
    resolvedProfile: profileStatus(scope) === "known" ? tinyurlReadinessProfileRef : null,
    scope: {
      profile: scope.profile,
      requirements: canonicalRows(scope.requirements),
      customRequirements: canonicalRows(scope.customRequirements),
    },
    contracts: canonicalRows(tinyurlReadinessProfile.definition.contracts),
    system: architecture?.system ?? null,
    context: {
      nodes: canonicalRows(architecture?.nodes ?? []),
      relationships: canonicalRows(architecture?.relationships ?? []),
    },
    elements: canonicalRows(design.elements),
    connections: canonicalRows(design.connections),
    studio: {
      version: studio?.version ?? null,
      elements: canonicalRows(studio?.elements ?? []),
      connections: canonicalRows(studio?.connections ?? []),
      packages: canonicalRows(
        (studio?.packages ?? []).map((row) => ({ ...row, members: [...row.members].sort() })),
      ),
      actions: canonicalRows(studio?.actions ?? []),
      entries: canonicalRows(studio?.entries ?? []),
      components: canonicalRows(studio?.components ?? []),
      componentConnections: canonicalRows(studio?.componentConnections ?? []),
    },
    ownership: {
      owners: canonicalRows(ownership.owners),
      roles: canonicalRows(ownership.roles),
      resources: canonicalRows(ownership.resources),
      grants: canonicalRows(ownership.grants),
      dependencies: canonicalRows(ownership.dependencies),
    },
    operations: {
      receivers: canonicalRows(designOperations(design).receivers),
      calls: canonicalRows(designOperations(design).calls),
    },
  };
  return structuredClone(subject);
}
