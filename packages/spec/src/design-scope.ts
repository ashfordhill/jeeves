/** Persistent scope is design intent, independent of chat's turn-only review assumptions. */
import { z } from "zod";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { idSchema } from "./ids.ts";
import {
  designOperations,
  knownCreateSignature,
  operationContractFindings,
} from "./operation-contracts.ts";
import type { OperationInput } from "./operations.ts";
import { designOwnership, ownershipFindings } from "./ownership.ts";

export const designProfileRefSchema = z.strictObject({
  id: idSchema,
  version: z
    .string()
    .max(40)
    .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
});
export const scopeFeatureSchema = z.enum([
  "immutable-http-targets",
  "authenticated-create",
  "public-resolve",
  "optional-expiry",
  "custom-slugs",
  "mutable-destinations",
  "disable-management",
  "reputation-enforcement",
  "quotas",
  "exact-analytics",
]);
export type ScopeFeature = z.infer<typeof scopeFeatureSchema>;
export const scopeFeatureLabels: Record<ScopeFeature, string> = {
  "immutable-http-targets": "Immutable HTTP(S) destinations",
  "authenticated-create": "Authenticated create",
  "public-resolve": "Public resolve",
  "optional-expiry": "Optional expiry (enforced on resolve)",
  "custom-slugs": "Custom slugs",
  "mutable-destinations": "Destination changes",
  "disable-management": "Disable / management API",
  "reputation-enforcement": "Reputation enforcement",
  quotas: "Quotas",
  "exact-analytics": "Exact analytics",
};
export const requirementCriticalitySchema = z.enum(["required", "advisory"]);
export const scopeRequirementSchema = z.strictObject({
  feature: scopeFeatureSchema,
  disposition: z.enum(["included", "excluded"]),
  criticality: requirementCriticalitySchema,
});
export const customRequirementSchema = z.strictObject({
  id: idSchema,
  requirement: z.string().trim().min(1).max(1000),
  criticality: requirementCriticalitySchema,
  element: idSchema.optional(),
  connection: idSchema.optional(),
});
export const designScopeSchema = z
  .strictObject({
    /** Null means unspecified; unknown exact references remain unresolved, never substituted. */
    profile: designProfileRefSchema.nullable(),
    requirements: z.array(scopeRequirementSchema).max(10),
    customRequirements: z.array(customRequirementSchema).max(8),
  })
  .superRefine((scope, ctx) => {
    for (const [key, ids] of [
      ["requirements", scope.requirements.map((item) => item.feature)],
      ["customRequirements", scope.customRequirements.map((item) => item.id)],
    ] as const) {
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Declare each requirement identity once.",
        });
    }
  });
export type DesignScope = z.infer<typeof designScopeSchema>;
export const emptyDesignScope = (): DesignScope => ({
  profile: null,
  requirements: [],
  customRequirements: [],
});
export const tinyurlProfile = {
  id: "tinyurl-create-resolve",
  version: "1.0.0",
  name: "TinyURL create / resolve",
} as const;
const included = new Set<ScopeFeature>([
  "immutable-http-targets",
  "authenticated-create",
  "public-resolve",
  "optional-expiry",
]);
export function tinyurlDesignScope(): DesignScope {
  return {
    profile: { id: tinyurlProfile.id, version: tinyurlProfile.version },
    requirements: scopeFeatureSchema.options.map((feature) => ({
      feature,
      disposition: included.has(feature) ? "included" : "excluded",
      criticality: "required",
    })),
    customRequirements: [],
  };
}
export function designScope(design: DesignDocument): DesignScope {
  return design.schemaVersion === 3 ? design.scope : emptyDesignScope();
}
export function profileStatus(scope: DesignScope): "known" | "unresolved" | "unspecified" {
  return !scope.profile
    ? "unspecified"
    : scope.profile.id === tinyurlProfile.id && scope.profile.version === tinyurlProfile.version
      ? "known"
      : "unresolved";
}
export type ScopeUnresolved = {
  source: "profile" | "requirement" | "contract" | "custom";
  id: string;
  requirement: string;
  criticality: "required" | "advisory";
  element?: string;
  connection?: string;
};
/** Declared requirements do not implement contracts. Missing targets never erase an obligation. */
export function unresolvedDesignScope(design: DesignDocument): ScopeUnresolved[] {
  const scope = designScope(design);
  const unresolved: ScopeUnresolved[] = [];
  const add = (
    id: string,
    requirement: string,
    criticality: "required" | "advisory" = "required",
    source: ScopeUnresolved["source"] = "profile",
  ) => unresolved.push({ source, id, requirement, criticality });
  const status = profileStatus(scope);
  if (status === "unspecified")
    add(
      "profile-unspecified",
      "No exact behavior profile is selected; application behavior remains unspecified.",
    );
  if (status === "unresolved")
    add(
      "profile-unresolved",
      `Unknown profile ${scope.profile?.id}@${scope.profile?.version}; its behavior and compatibility are unresolved.`,
    );
  if (!scope.requirements.length)
    add("requirements-unspecified", "Included and excluded behavior requirements are unspecified.");
  if (status === "known") {
    for (const feature of scopeFeatureSchema.options) {
      const item = scope.requirements.find((item) => item.feature === feature);
      const expected = included.has(feature) ? "included" : "excluded";
      if (!item)
        add(
          `missing-${feature}`,
          `Declare whether ${scopeFeatureLabels[feature]} is included or excluded.`,
          "required",
          "requirement",
        );
      else if (item.disposition !== expected)
        add(
          `unsupported-${feature}`,
          `${scopeFeatureLabels[feature]} is ${item.disposition}; ${tinyurlProfile.id}@${tinyurlProfile.version} requires it to be ${expected}.${item.criticality === "required" ? " This required behavior blocks the narrow profile." : " This advisory variation is unsupported by the narrow profile."}`,
          item.criticality,
          "requirement",
        );
    }
    const ownership = designOwnership(design);
    if (
      !ownership.owners.length ||
      !ownership.roles.length ||
      !ownership.resources.length ||
      ownershipFindings(design).length
    )
      add(
        "links-owner-access",
        "Logical owner, role, authority and access declarations are incomplete or unresolved; inspect the targeted ownership findings. Operation contracts remain separate.",
        "required",
        "contract",
      );
    const operations = designOperations(design);
    const declaredCreate = operations.receivers.some(
      (receiver) =>
        knownCreateSignature(receiver.implementation) &&
        operations.calls.some(
          (call) => call.receiverBinding === receiver.id && knownCreateSignature(call.expects),
        ),
    );
    if (!declaredCreate)
      add(
        "create-contract",
        "Authenticated create and an exact matching caller/receiver binding are not fully declared. Names, labels and modules establish no behavior.",
        "required",
        "contract",
      );
    add(
      "namespace-authority",
      "One-public-namespace composition is unresolved: all create/resolve bindings must agree on one authoritative source and compatible logical owner. Per-operation declarations alone do not validate that agreement; NC04/NC05 must check it.",
      "required",
      "contract",
    );
    for (const [index, item] of operationContractFindings(design).entries())
      unresolved.push({
        source: "contract",
        id: `create-binding-${index}`,
        requirement: item.message,
        criticality: "required",
        ...(item.target.element ? { element: item.target.element } : {}),
        ...(item.target.connection ? { connection: item.target.connection } : {}),
      });
    for (const [id, requirement] of [
      [
        "resolve-contract",
        "Public resolve, unknown/expired results and dependency-failure contracts are not specified.",
      ],
      [
        "expiry-cache-contract",
        "Expiry enforcement, authoritative lookup and bounded cache/fallback policies are not specified.",
      ],
    ])
      add(id as string, requirement as string, "required", "contract");
  } else
    add(
      "contracts-unspecified",
      "API and failure contracts are unspecified; explicit ownership declarations are reported separately. Names, labels and modules establish no behavior.",
      "required",
      "contract",
    );
  for (const item of [...scope.customRequirements].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )) {
    const missing = [
      ...(item.element && !design.elements.some((element) => element.id === item.element)
        ? [`element ${item.element}`]
        : []),
      ...(item.connection &&
      !design.connections.some((connection) => connection.id === item.connection)
        ? [`connection ${item.connection}`]
        : []),
    ];
    unresolved.push({
      ...item,
      source: "custom",
      requirement: `${item.requirement} — unresolved custom requirement.${missing.length ? ` Target missing: ${missing.join(", ")}.` : ""}`,
    });
  }
  return unresolved;
}
/** v2 finding/export behavior is unchanged. v3 documents report their persistent unresolved scope. */
export function designScopeFindings(design: DesignDocument): Finding[] {
  if (design.schemaVersion === 2) return [];
  return unresolvedDesignScope(design).map((item) =>
    finding("CONFIG_REQUIRED", item.requirement, {
      path: [
        "scope",
        item.source === "custom"
          ? "customRequirements"
          : item.source === "requirement"
            ? "requirements"
            : item.source,
        item.id,
      ],
      ...(item.element && { element: item.element }),
      ...(item.connection && { connection: item.connection }),
    }),
  );
}
export const designScopeCommandSchema = z.strictObject({
  scope: designScopeSchema,
  /** Explicitly authorize the v2 → v3 boundary; omission never upgrades. */
  upgrade: z.boolean().default(false),
});
export type DesignScopeCommandInput = z.input<typeof designScopeCommandSchema>;
export function buildDesignScopeCommand(
  design: DesignDocument,
  input: DesignScopeCommandInput,
): { ops: OperationInput[] } {
  const command = designScopeCommandSchema.parse(input);
  if (design.schemaVersion === 2 && !command.upgrade)
    throw new Error(
      "Preview and explicitly upgrade this design to schema v3 before saving persistent requirements.",
    );
  if (design.schemaVersion === 3 && JSON.stringify(design.scope) === JSON.stringify(command.scope))
    return { ops: [] };
  return {
    ops: [
      { op: design.schemaVersion === 2 ? "upgradeDesign" : "setDesignScope", scope: command.scope },
    ],
  };
}
export function previewDesignScope(design: DesignDocument, scope: DesignScope) {
  const parsed = designScopeSchema.parse(scope);
  const upgraded: DesignDocument = { ...design, schemaVersion: 3, scope: parsed };
  return {
    fromSchema: design.schemaVersion,
    toSchema: 3,
    scope: parsed,
    profileStatus: profileStatus(parsed),
    unresolved: unresolvedDesignScope(upgraded),
    note: "Preview only. Tiles, identities, settings and legacy inferred access remain unchanged. No capability is inferred. Saving is one Undo step; no template or runtime verification is supplied.",
  };
}
