/** Project-local design contracts. Declarations never supply executable runtime bindings. */
import { z } from "zod";
import {
  contractTypeDefinitionSchema,
  contractFieldsSchema as fields,
  operationBehaviorSchema,
  operationOutcomeSchema,
} from "./contract-shapes.ts";
import { contractTransportSchema, inspectContractTransport } from "./contract-transport.ts";
import {
  contractShapeSemantics,
  contractTypeKey,
  inspectContractShape,
} from "./contract-type-resolution.ts";
import { deliveryConfigSchema } from "./delivery.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { idSchema } from "./ids.ts";
import { resourceConfigSchema } from "./resources.ts";

export * from "./contract-shapes.ts";
export * from "./contract-transport.ts";
export * from "./contract-type-resolution.ts";

const text = z.string().trim().max(1200);
export const contractShapeSchema = z.strictObject({
  operations: z
    .array(
      z.strictObject({
        id: idSchema,
        name: z.string().trim().min(1).max(120),
        description: text.default(""),
        input: fields,
        output: fields,
        behavior: operationBehaviorSchema.optional(),
        transport: contractTransportSchema.optional(),
        outcomes: z
          .array(operationOutcomeSchema)
          .max(30)
          .superRefine((items, ctx) => {
            if (new Set(items.map((item) => item.id)).size !== items.length)
              ctx.addIssue({
                code: "custom",
                message: "Outcome identities must be unique within an operation.",
              });
          })
          .optional(),
      }),
    )
    .max(30)
    .superRefine((items, ctx) => {
      if (new Set(items.map((item) => item.id)).size !== items.length)
        ctx.addIssue({ code: "custom", message: "Operation identities must be unique." });
    }),
  payload: fields,
  types: z.array(contractTypeDefinitionSchema).max(100).optional(),
});
export const contractOwnerSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("element"), id: idSchema }),
  z.strictObject({ kind: z.literal("component"), id: idSchema }),
  z.strictObject({ kind: z.literal("external-system"), id: idSchema }),
]);
export const contractSourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("rest-operation"),
    element: idSchema,
    attachment: idSchema,
    member: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("extension"), ref: idSchema }),
      z.strictObject({
        kind: z.literal("resource"),
        ref: idSchema,
        operation: z.enum(["create", "read", "list", "update"]),
      }),
      z.strictObject({
        kind: z.literal("session"),
        operation: z.enum(["registerAccount", "login", "logout", "readSession"]),
      }),
    ]),
  }),
  z.strictObject({
    kind: z.literal("durable-event"),
    element: idSchema,
    attachment: idSchema,
    event: idSchema,
  }),
  z.strictObject({
    kind: z.literal("resource"),
    element: idSchema,
    attachment: idSchema,
    resource: idSchema,
  }),
]);
export const architectureContractSchema = z
  .strictObject({
    id: idSchema,
    version: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/, "Enter an explicit version, such as v1."),
    name: z.string().trim().min(1).max(120),
    kind: z.enum(["api", "in-process", "event", "data"]),
    description: text.default(""),
    /** Explicit coverage of this declaration, independent of template availability or verification. */
    coverage: z.enum(["Unspecified", "Partial", "Complete"]).optional(),
    shape: contractShapeSchema.optional(),
    source: contractSourceSchema.optional(),
    /** Exact canonical source shape, authored from sourceDesignRevision (the saved base), not a compatibility assertion. */
    sourceSnapshot: z.string().max(500_000).optional(),
    sourceDesignRevision: z.int().nonnegative().optional(),
  })
  .superRefine((contract, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (!!contract.source === !!contract.shape)
      issue("Choose a planned shape or a source reference.");
    if (contract.source) {
      if (!contract.sourceSnapshot || contract.sourceDesignRevision === undefined)
        issue("A source reference needs its saved shape and design revision.");
      const expected =
        contract.source.kind === "rest-operation"
          ? "api"
          : contract.source.kind === "durable-event"
            ? "event"
            : "data";
      if (contract.kind !== expected)
        issue("The contract kind must match its authoritative source.");
    } else if (contract.sourceSnapshot !== undefined || contract.sourceDesignRevision !== undefined)
      issue("Only source references have a saved source revision.");
    if (contract.shape) {
      if (contract.kind !== "api" && contract.shape.operations.some((o) => o.transport))
        issue("Only API contracts declare HTTP transport mappings.");
      if (
        (contract.kind === "event" || contract.kind === "data") &&
        contract.shape.operations.length
      )
        issue("Events and datasets have payload fields, not operations.");
      if (
        (contract.kind === "api" || contract.kind === "in-process") &&
        contract.shape.payload.length
      )
        issue("Put API/interface fields inside an operation's input or output.");
    }
  });
export const architectureInterfaceSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  owner: contractOwnerSchema,
  direction: z.enum(["provided", "required"]),
  necessity: z.enum(["required", "optional"]),
  contract: z.strictObject({ id: idSchema, version: architectureContractSchema.shape.version }),
});
export type ArchitectureContract = z.output<typeof architectureContractSchema>;
export type ArchitectureInterface = z.output<typeof architectureInterfaceSchema>;
export type ContractOwner = z.output<typeof contractOwnerSchema>;
export type ContractSource = z.output<typeof contractSourceSchema>;
export type ContractShape = z.output<typeof contractShapeSchema>;
export const contractKey = (ref: { id: string; version: string }) => `${ref.id}@${ref.version}`;
export const sameContractOwner = (a: ContractOwner, b: ContractOwner) =>
  a.kind === b.kind && a.id === b.id;

/** Canonical equality avoids false staleness from JSON object property order. No hashing assumptions. */
export function contractCanonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
}

export function resolveContractSource(
  design: DesignDocument,
  source: ContractSource,
): unknown | undefined {
  const element = design.elements.find((item) => item.id === source.element);
  const attachment = element?.attachments.find((item) => item.id === source.attachment);
  if (!attachment) return undefined;
  if (source.kind === "durable-event") {
    if (attachment.template.id !== "durable-events") return undefined;
    const parsed = deliveryConfigSchema.safeParse(attachment.config);
    const event = parsed.success
      ? parsed.data.events.find((item) => item.id === source.event)
      : undefined;
    return event
      ? {
          template: attachment.template,
          type: event.type,
          version: event.version,
          fields: event.fields,
        }
      : undefined;
  }
  if (attachment.template.id !== "rest-api-server") return undefined;
  const parsed = resourceConfigSchema.safeParse(attachment.config.model);
  if (!parsed.success) return undefined;
  const model = parsed.data;
  const base = {
    template: attachment.template,
    basePath: attachment.config.basePath ?? "/api",
    auth: attachment.config.auth,
  };
  if (source.kind === "rest-operation" && source.member.kind === "session")
    return attachment.config.auth === "session"
      ? { ...base, operation: source.member.operation }
      : undefined;
  if (source.kind === "rest-operation" && source.member.kind === "extension") {
    const ref = source.member.ref;
    const ext = model.extensions.find((item) => item.id === ref);
    return ext
      ? {
          ...base,
          operationId: ext.operationId,
          method: ext.method,
          path: ext.path,
          access: ext.access,
          contract: ext.contract,
        }
      : undefined;
  }
  const id =
    source.kind === "resource"
      ? source.resource
      : source.member.kind === "resource"
        ? source.member.ref
        : undefined;
  const resource = model.resources.find((item) => item.id === id);
  if (!resource) return undefined;
  if (
    source.kind === "rest-operation" &&
    source.member.kind === "resource" &&
    !resource.operations.includes(source.member.operation)
  )
    return undefined;
  // Include related resource shapes: their public names/fields influence generated contracts.
  const related = new Set([resource.id]);
  for (const ref of related)
    for (const relation of model.resources.find((item) => item.id === ref)?.belongsTo ?? [])
      related.add(relation.resource);
  return {
    ...base,
    ...(source.kind === "rest-operation"
      ? { operation: source.member.kind === "resource" ? source.member.operation : undefined }
      : {}),
    resources: model.resources.filter((item) => related.has(item.id)),
  };
}

/** Enumerates the same stable ownership/member identities used by the P38 API workspace. */
export function contractSources(
  design: DesignDocument,
): { label: string; source: ContractSource; kind: ArchitectureContract["kind"] }[] {
  const result: ReturnType<typeof contractSources> = [];
  for (const element of design.elements)
    for (const attachment of element.attachments) {
      const base = { element: element.id, attachment: attachment.id };
      if (attachment.template.id === "durable-events") {
        const parsed = deliveryConfigSchema.safeParse(attachment.config);
        if (parsed.success)
          for (const event of parsed.data.events)
            result.push({
              label: `${element.name} · ${event.type} v${event.version}`,
              kind: "event",
              source: { ...base, kind: "durable-event", event: event.id },
            });
      }
      if (attachment.template.id !== "rest-api-server") continue;
      const parsed = resourceConfigSchema.safeParse(attachment.config.model);
      if (!parsed.success) continue;
      for (const ext of parsed.data.extensions)
        result.push({
          label: `${element.name} · ${ext.method} ${ext.path}`,
          kind: "api",
          source: { ...base, kind: "rest-operation", member: { kind: "extension", ref: ext.id } },
        });
      for (const resource of parsed.data.resources) {
        result.push({
          label: `${element.name} · ${resource.name} dataset`,
          kind: "data",
          source: { ...base, kind: "resource", resource: resource.id },
        });
        for (const operation of resource.operations)
          result.push({
            label: `${element.name} · ${operation} ${resource.name}`,
            kind: "api",
            source: {
              ...base,
              kind: "rest-operation",
              member: { kind: "resource", ref: resource.id, operation },
            },
          });
      }
      if (attachment.config.auth === "session")
        for (const operation of ["registerAccount", "login", "logout", "readSession"] as const)
          result.push({
            label: `${element.name} · ${operation}`,
            kind: "api",
            source: { ...base, kind: "rest-operation", member: { kind: "session", operation } },
          });
    }
  return result;
}

export function contractOwnerElement(
  design: DesignDocument,
  owner: ContractOwner,
): string | undefined {
  return owner.kind === "element"
    ? design.elements.find((item) => item.id === owner.id)?.id
    : owner.kind === "component"
      ? design.elements.find(
          (element) =>
            element.id ===
            design.architecture?.components?.find((item) => item.id === owner.id)?.element,
        )?.id
      : design.architecture?.nodes.find(
          (item) => item.id === owner.id && item.kind === "external-system",
        )?.container;
}
function ownerExists(design: DesignDocument, owner: ContractOwner): boolean {
  return owner.kind === "external-system"
    ? !!design.architecture?.nodes.some(
        (item) => item.id === owner.id && item.kind === "external-system",
      )
    : !!contractOwnerElement(design, owner);
}

export function validateArchitectureContracts(design: DesignDocument): Finding[] {
  const model = design.architecture;
  if (!model) return [];
  const result: Finding[] = [];
  const keys = new Set<string>();
  const otherIds = new Set([
    "system",
    ...model.nodes.map((item) => item.id),
    ...(model.components ?? []).map((item) => item.id),
    ...(model.patternInstances ?? []).map((item) => item.id),
    ...model.relationships.map((item) => item.id),
    ...(model.componentRelationships ?? []).map((item) => item.id),
    ...(model.scenarios ?? []).map((item) => item.id),
    ...design.elements.flatMap((item) => [item.id, ...item.attachments.map((a) => a.id)]),
    ...design.connections.map((item) => item.id),
    ...design.annotations.map((item) => item.id),
  ]);
  const contractIds = new Set((model.contracts ?? []).map((item) => item.id));
  for (const contract of model.contracts ?? []) {
    const path = ["architecture", "contracts", contractKey(contract)];
    if (keys.has(contractKey(contract)) || otherIds.has(contract.id))
      result.push(
        finding("DUPLICATE_ID", `Contract identity ${contractKey(contract)} is already used.`, {
          path,
        }),
      );
    keys.add(contractKey(contract));
    if (contract.shape)
      for (const issue of [
        ...inspectContractShape(contract.shape).issues,
        ...inspectContractTransport(contract.shape).issues,
      ])
        if (issue.code !== "UNRESOLVED")
          result.push(
            finding(
              issue.code === "MISSING_TYPE" ? "UNKNOWN_REFERENCE" : "CONFIG_INVALID",
              issue.message,
              {
                path: [...path, "shape", ...issue.path],
              },
            ),
          );
  }
  for (const use of model.interfaces ?? []) {
    const path = ["architecture", "interfaces", use.id];
    if (otherIds.has(use.id) || contractIds.has(use.id))
      result.push(
        finding("DUPLICATE_ID", `Interface identity ${use.id} is already used.`, { path }),
      );
    otherIds.add(use.id);
    if (!ownerExists(design, use.owner))
      result.push(
        finding(
          "UNKNOWN_REFERENCE",
          `Interface ${use.name} needs an existing provider/consumer owner.`,
          { path },
        ),
      );
    const contract = model.contracts?.find(
      (item) => contractKey(item) === contractKey(use.contract),
    );
    if (!contract)
      result.push(
        finding(
          "UNKNOWN_REFERENCE",
          `Interface ${use.name} needs an exact existing contract version.`,
          { path },
        ),
      );
    if (use.direction === "provided" && contract?.source) {
      if (contractOwnerElement(design, use.owner) !== contract.source.element)
        result.push(
          finding(
            "CONFIG_INVALID",
            "A source interface must be provided by its authoritative application or component.",
            { path },
          ),
        );
      if (use.owner.kind === "component" && contract.source.kind !== "durable-event") {
        const source = contract.source;
        const component = model.components?.find((item) => item.id === use.owner.id);
        const matches = component?.members.some(
          (member) =>
            member.attachment === source.attachment &&
            (source.kind === "resource"
              ? member.kind === "resource" && member.ref === source.resource
              : source.member.kind === "session"
                ? member.kind === "accounts"
                : member.kind === source.member.kind && member.ref === source.member.ref),
        );
        if (!matches)
          result.push(
            finding(
              "CONFIG_INVALID",
              "The provider component must own the referenced REST member.",
              { path },
            ),
          );
      }
    }
  }
  return result;
}

export interface ContractReviewFinding {
  code:
    | "UNBOUND_REQUIRED"
    | "UNRESOLVED_CONTRACT"
    | "SOURCE_STALE"
    | "CONTRACT_COVERAGE"
    | "OPERATION_BEHAVIOR";
  message: string;
  contract?: string;
  interface?: string;
}
/** Review intent is separate from generation readiness. */
export function architectureContractReview(design: DesignDocument): ContractReviewFinding[] {
  const result: ContractReviewFinding[] = [];
  for (const contract of design.architecture?.contracts ?? []) {
    if (!contract.source && contract.coverage !== "Complete")
      result.push({
        code: "CONTRACT_COVERAGE",
        message: `${contract.name} ${contract.version}: ${contract.coverage === "Partial" ? "partial contract; omitted behavior still needs design" : "contract coverage has not been reviewed"}.`,
        contract: contractKey(contract),
      });
    for (const operation of contract.shape?.operations ?? []) {
      const b = operation.behavior;
      const missing = [
        !b?.kind || b.kind === "Unspecified" ? "command/query intent" : "",
        !b?.authorization?.trim() ? "authorization" : "",
        !b?.idempotency || b.idempotency === "Unspecified" ? "retry/idempotency semantics" : "",
        b?.idempotency === "Deduplication key" && !b.idempotencyKey?.trim()
          ? "deduplication scope and lifetime"
          : "",
        b?.kind === "Command" && (!b.stateChanges?.trim() || !b.transaction?.trim())
          ? "state change and transaction boundary"
          : "",
        !b?.implementation || b.implementation === "Unspecified" ? "implementation boundary" : "",
        ["Application hook", "Composition"].includes(b?.implementation ?? "") &&
        !b?.extensionPoint?.trim()
          ? "application hook contract"
          : "",
        !b?.acceptance?.trim() ? "acceptance criteria" : "",
        !operation.outcomes?.some((o) => o.kind === "Success") ? "success outcome" : "",
        !operation.outcomes?.some((o) => o.kind !== "Success") ? "failure/rejection outcome" : "",
        operation.outcomes?.some(
          (o) => !o.condition.trim() || o.state === "Unspecified" || o.retry === "Unspecified",
        )
          ? "outcome state and retry decisions"
          : "",
      ].filter(Boolean);
      if (missing.length)
        result.push({
          code: "OPERATION_BEHAVIOR",
          message: `${contract.name} / ${operation.name}: specify ${missing.join(", ")}.`,
          contract: contractKey(contract),
        });
    }
    if (contract.source) {
      const current = resolveContractSource(design, contract.source);
      if (current === undefined || contractCanonical(current) !== contract.sourceSnapshot)
        result.push({
          code: "SOURCE_STALE",
          message: `${contract.name} ${contract.version}: source changed or was removed; compatibility is unverified. Create a version from the current source.`,
          contract: contractKey(contract),
        });
    } else if (
      contract.shape &&
      ((["api", "in-process"].includes(contract.kind)
        ? !contract.shape.operations.length
        : !contract.shape.payload.length) ||
        !inspectContractShape(contract.shape).ok ||
        !inspectContractTransport(contract.shape).ok)
    )
      result.push({
        code: "UNRESOLVED_CONTRACT",
        message: `${contract.name} ${contract.version}: planned shape has unresolved fields.`,
        contract: contractKey(contract),
      });
  }
  for (const use of design.architecture?.interfaces ?? [])
    if (
      use.direction === "required" &&
      use.necessity === "required" &&
      !design.architecture?.bindings?.some((binding) => {
        const provided = design.architecture?.interfaces?.find(
          (item) => item.id === binding.provided,
        );
        return (
          binding.required === use.id &&
          provided?.direction === "provided" &&
          contractKey(provided.contract) === contractKey(binding.contract) &&
          contractKey(use.contract) === contractKey(binding.contract)
        );
      })
    )
      result.push({
        code: "UNBOUND_REQUIRED",
        message: `${use.name}: required interface is unbound. No compatible exact-version relationship binding is declared.`,
        interface: use.id,
      });
  return result;
}

/** Protect referenced versions even if a batch also migrates/removes their consumers. */
export function validateContractTransition(
  before: DesignDocument,
  after: DesignDocument,
): Finding[] {
  const result: Finding[] = [];
  for (const prior of before.architecture?.contracts ?? []) {
    const referenced = [
      ...(before.architecture?.interfaces ?? []),
      ...(before.architecture?.bindings ?? []),
      ...(before.architecture?.datasets ?? []),
      ...(before.architecture?.backend?.entities ?? []),
      ...(before.architecture?.backend?.accessBindings ?? []).flatMap((b) =>
        b.target.kind === "operation" ? [{ contract: b.target.contract }] : [],
      ),
    ].some((use) => contractKey(use.contract) === contractKey(prior));
    if (
      (before.architecture?.backend?.accessBindings?.some(
        (b) =>
          b.target.kind === "operation" && contractKey(b.target.contract) === contractKey(prior),
      ) ||
        (referenced &&
          (prior.shape?.operations.some((o) => o.transport) ||
            before.architecture?.backend?.entities.some(
              (e) => contractKey(e.contract) === contractKey(prior),
            ))) ||
        (prior.shape?.types?.length && inspectContractShape(prior.shape).references.length)) &&
      !after.architecture?.contracts?.some((next) => contractKey(next) === contractKey(prior))
    )
      result.push(
        finding(
          "CONFIG_INVALID",
          `Contract ${contractKey(prior)} is referenced. Preserve its immutable contract and local type versions.`,
          {
            path: ["architecture", "contracts", contractKey(prior)],
          },
        ),
      );
  }
  for (const next of after.architecture?.contracts ?? []) {
    const prior = before.architecture?.contracts?.find(
      (item) => contractKey(item) === contractKey(next),
    );
    const referenced =
      before.architecture?.interfaces?.some(
        (item) => contractKey(item.contract) === contractKey(next),
      ) ||
      before.architecture?.bindings?.some(
        (item) => contractKey(item.contract) === contractKey(next),
      ) ||
      before.architecture?.datasets?.some(
        (item) => contractKey(item.contract) === contractKey(next),
      ) ||
      before.architecture?.backend?.accessBindings?.some(
        (b) =>
          b.target.kind === "operation" && contractKey(b.target.contract) === contractKey(next),
      ) ||
      before.architecture?.backend?.entities.some(
        (item) => contractKey(item.contract) === contractKey(next),
      );
    const semantics = (item: ArchitectureContract) => ({
      kind: item.kind,
      coverage: item.coverage,
      shape: contractShapeSemantics(item.shape),
      source: item.source,
      sourceSnapshot: item.sourceSnapshot,
      sourceDesignRevision: item.sourceDesignRevision,
    });
    if (
      prior?.source &&
      (contractCanonical(prior.source) !== contractCanonical(next.source) ||
        prior.sourceSnapshot !== next.sourceSnapshot ||
        prior.sourceDesignRevision !== next.sourceDesignRevision ||
        next.shape !== undefined)
    )
      result.push(
        finding(
          "CONFIG_INVALID",
          `Source contract ${contractKey(prior)} is authoritative and immutable. Capture an explicit new version from its source.`,
          { path: ["architecture", "contracts", contractKey(prior)] },
        ),
      );
    if (
      prior &&
      referenced &&
      contractCanonical(semantics(prior)) !== contractCanonical(semantics(next))
    )
      result.push(
        finding(
          "CONFIG_INVALID",
          `Referenced contract ${contractKey(next)} is immutable. Create an explicit new version and review consumers.`,
          { path: ["architecture", "contracts", contractKey(next)] },
        ),
      );
    // A referenced local version stays immutable even inside an otherwise editable draft,
    // and even when this batch also removes or migrates every reference to it.
    if (prior?.shape) {
      const used = new Set(inspectContractShape(prior.shape).references.map(contractTypeKey));
      for (const type of prior.shape.types ?? []) {
        if (!used.has(contractTypeKey(type))) continue;
        const replacement = next.shape?.types?.find(
          (t) => contractTypeKey(t) === contractTypeKey(type),
        );
        if (!replacement || contractCanonical(type.value) !== contractCanonical(replacement.value))
          result.push(
            finding(
              "CONFIG_INVALID",
              `Referenced local type ${contractTypeKey(type)} is immutable. Preserve it and create an explicit new version.`,
              {
                path: [
                  "architecture",
                  "contracts",
                  contractKey(next),
                  "shape",
                  "types",
                  contractTypeKey(type),
                ],
              },
            ),
          );
      }
    }
    if (
      next.source &&
      (!prior || contractCanonical(semantics(prior)) !== contractCanonical(semantics(next)))
    ) {
      const source = resolveContractSource(after, next.source);
      if (
        source === undefined ||
        next.sourceSnapshot !== contractCanonical(source) ||
        (next.sourceDesignRevision ?? Infinity) > before.revision
      )
        result.push(
          finding(
            "CONFIG_INVALID",
            "Capture the current authoritative source shape and base design revision; source contracts cannot be edited here.",
            { path: ["architecture", "contracts", contractKey(next)] },
          ),
        );
    }
  }
  return result;
}
