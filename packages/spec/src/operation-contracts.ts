/** Finite operation declarations. No handlers, adapters or schema programming language. */
import { z } from "zod";
import type { DesignDocument } from "./design.ts";
import { emptyDesignScope } from "./design-scope.ts";
import { type Finding, finding, isStructural } from "./findings.ts";
import { idSchema } from "./ids.ts";
import catalog from "./operation-catalog.json" with { type: "json" };
import type { OperationInput } from "./operations.ts";
import { accessAllows, designOwnership, type Ownership } from "./ownership.ts";
import { studioLaneSchema, studioProtocolSchema } from "./studio-model.ts";

export const exactContractRefSchema = z.strictObject({
  id: idSchema,
  version: z
    .string()
    .max(40)
    .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/, "Use an exact lowercase SHA256 hash."),
});
export type ExactContractRef = z.infer<typeof exactContractRefSchema>;
const freeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const createLinkOperation = freeze(catalog);
export const sameContractRef = (a: ExactContractRef, b: ExactContractRef) =>
  a.id === b.id && a.version === b.version && a.sha256 === b.sha256;
export const operationSignatureSchema = z.strictObject({
  operation: exactContractRefSchema,
  request: exactContractRefSchema,
  success: exactContractRefSchema,
  errors: exactContractRefSchema,
  auth: z.enum(["verified-principal", "public"]),
  idempotency: z.enum(["principal-operation-key", "none"]),
  timeoutMs: z.int().min(1).max(300000),
});
export type OperationSignature = z.infer<typeof operationSignatureSchema>;
export function createLinkSignature(): OperationSignature {
  return {
    operation: { ...catalog.ref },
    ...Object.fromEntries(
      Object.entries(catalog.definition.schemas).map(([key, value]) => [key, { ...value.ref }]),
    ),
    auth: "verified-principal",
    idempotency: "principal-operation-key",
    timeoutMs: 10000,
  } as OperationSignature;
}
export const createLinkBindingSchema = z.strictObject({
  kind: z.literal("create-link"),
  storeConnection: idSchema,
  successRetentionHours: z.literal(24).nullable(),
  authVerifier: exactContractRefSchema.nullable(),
});
export const operationReceiverSchema = z.strictObject({
  id: idSchema,
  role: idSchema,
  implementation: operationSignatureSchema,
  binding: createLinkBindingSchema,
});
export const operationCallSchema = z.strictObject({
  id: idSchema,
  caller: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("entry"),
      entry: idSchema,
      lane: studioLaneSchema,
      element: idSchema,
    }),
    z.strictObject({ kind: z.literal("connection"), connection: idSchema, role: idSchema }),
  ]),
  receiverBinding: idSchema,
  receiverRole: idSchema,
  expects: operationSignatureSchema,
});
export const operationContractsSchema = z.strictObject({
  receivers: z.array(operationReceiverSchema).max(50),
  calls: z.array(operationCallSchema).max(100),
});
export type OperationContracts = z.infer<typeof operationContractsSchema>;
export type OperationReceiver = OperationContracts["receivers"][number];
export type OperationCall = OperationContracts["calls"][number];
export const emptyOperationContracts = (): OperationContracts => ({ receivers: [], calls: [] });
export const designOperations = (design: DesignDocument): OperationContracts =>
  design.schemaVersion === 3
    ? (design.operations ?? emptyOperationContracts())
    : emptyOperationContracts();
export const operationCallId = (call: OperationCall) => call.id;
export const operationCallerId = (call: OperationCall) =>
  call.caller.kind === "entry"
    ? `entry:${call.caller.entry}`
    : `connection:${call.caller.connection}`;
export const isCreateOperation = (signature: OperationSignature) =>
  sameContractRef(signature.operation, catalog.ref);
export const operationDisplayName = (signature: OperationSignature) =>
  isCreateOperation(signature)
    ? "Create link · v1"
    : `Unknown ${signature.operation.id}@${signature.operation.version}`;
export function nextOperationBindingId(prefix: string, ids: readonly string[]) {
  let index = 1;
  while (ids.includes(`${prefix}-${index}`)) index++;
  return `${prefix}-${index}`;
}
export function knownCreateSignature(signature: OperationSignature) {
  const expected = createLinkSignature();
  return (
    (["operation", "request", "success", "errors"] as const).every((key) =>
      sameContractRef(signature[key], expected[key]),
    ) &&
    signature.auth === expected.auth &&
    signature.idempotency === expected.idempotency &&
    signature.timeoutMs === expected.timeoutMs
  );
}

export function operationContractFindings(design: DesignDocument): Finding[] {
  if (design.schemaVersion !== 3) return [];
  const model = designOperations(design),
    ownership = designOwnership(design),
    findings: Finding[] = [];
  const report = (
    code: "CONFIG_INVALID" | "CONFIG_REQUIRED" | "UNKNOWN_REFERENCE",
    path: (string | number)[],
    message: string,
    target: { element?: string; connection?: string } = {},
  ) => findings.push(finding(code, message, { ...target, path: ["operations", ...path] }));
  const signature = (
    value: OperationSignature,
    path: (string | number)[],
    target: { element?: string; connection?: string },
  ) => {
    const knownOperation = sameContractRef(value.operation, catalog.ref),
      expected = createLinkSignature();
    const knownSchemas = Object.values(catalog.definition.schemas).map((x) => x.ref);
    for (const key of ["operation", "request", "success", "errors"] as const) {
      if (sameContractRef(value[key], expected[key])) continue;
      const schemaRecord = knownSchemas.some((x) => sameContractRef(value[key], x));
      const operationRecord = sameContractRef(value[key], catalog.ref);
      if (!knownOperation && key !== "operation" && schemaRecord) continue;
      const known =
        key === "operation" ? schemaRecord : operationRecord || (knownOperation && schemaRecord);
      report(
        known ? "CONFIG_INVALID" : "CONFIG_REQUIRED",
        [...path, key],
        known
          ? `Operation ${key} reference names a different known record; exact schema/operation equality is required.`
          : `Unknown exact ${key} reference ${value[key].id}@${value[key].version} (${value[key].sha256}); retained without substitution.`,
        target,
      );
    }
    if (knownOperation)
      for (const key of ["auth", "idempotency", "timeoutMs"] as const)
        if (value[key] !== expected[key])
          report(
            "CONFIG_INVALID",
            [...path, key],
            `Create link ${key} must be ${expected[key]}; this declared promise is incompatible.`,
            target,
          );
  };
  const unique = (items: string[], field: string) => {
    const seen = new Set<string>();
    items.forEach((key, index) => {
      if (seen.has(key))
        report(
          "CONFIG_INVALID",
          [field, index],
          `Declare operation ${field} identity ${key} once.`,
        );
      seen.add(key);
    });
  };
  unique(
    model.receivers.map((x) => x.id),
    "receivers",
  );
  unique(model.calls.map(operationCallId), "calls");
  unique(
    model.receivers
      .filter((x) => isCreateOperation(x.implementation))
      .map((x) => `${x.role}/POST/links`),
    "receiver-routes",
  );
  unique(
    model.calls.map((x) => `${operationCallerId(x)}/${x.receiverBinding}`),
    "caller-bindings",
  );
  model.receivers.forEach((receiver, index) => {
    const path = ["receivers", index],
      target = { element: receiver.role };
    const knownCreate = isCreateOperation(receiver.implementation);
    signature(receiver.implementation, [...path, "implementation"], target);
    const role = ownership.roles.find((x) => x.element === receiver.role);
    if (knownCreate && !model.calls.some((x) => x.receiverBinding === receiver.id))
      report(
        "CONFIG_REQUIRED",
        [...path, "role"],
        `Create link on ${receiver.role} has no exact caller expectation binding.`,
        target,
      );
    const receiverSettings = design.architecture?.studio?.elements.find(
      (x) => x.element === receiver.role,
    )?.settings;
    if (
      knownCreate &&
      receiverSettings &&
      "requestTimeoutMs" in receiverSettings &&
      receiverSettings.requestTimeoutMs !== undefined &&
      receiverSettings.requestTimeoutMs !== receiver.implementation.timeoutMs
    )
      report(
        "CONFIG_INVALID",
        [...path, "implementation", "timeoutMs"],
        "Receiver request timeout contradicts the operation's single total 10000ms deadline.",
        target,
      );
    if (!design.elements.some((x) => x.id === receiver.role))
      report(
        "UNKNOWN_REFERENCE",
        [...path, "role"],
        `Operation receiver ${receiver.role} is missing.`,
        target,
      );
    else if (!role)
      report(
        "CONFIG_REQUIRED",
        [...path, "role"],
        `Operation receiver ${receiver.role} needs an explicit role and logical owner.`,
        target,
      );
    else if (knownCreate && role.kind !== "api")
      report(
        "CONFIG_INVALID",
        [...path, "role"],
        "Create link receiver must be a declared API role.",
        target,
      );
    const link = design.connections.find((x) => x.id === receiver.binding.storeConnection);
    if (!link)
      report(
        "UNKNOWN_REFERENCE",
        [...path, "binding", "storeConnection"],
        `Operation dependency connection ${receiver.binding.storeConnection} is missing.`,
        target,
      );
    else {
      if (link.from.element !== receiver.role)
        report(
          "CONFIG_INVALID",
          [...path, "binding", "storeConnection"],
          "Operation dependency connection must start at its canonical receiver role.",
          target,
        );
      if (knownCreate) {
        const resource = ownership.resources.find((x) => x.element === link.to.element);
        const kind = design.architecture?.studio?.elements.find(
          (x) => x.element === link.to.element,
        )?.settings.kind;
        if (kind !== "database")
          report(
            "CONFIG_INVALID",
            [...path, "binding", "storeConnection"],
            "Create link requires an authoritative source database connection.",
            target,
          );
        if (!resource)
          report(
            "CONFIG_REQUIRED",
            [...path, "binding", "storeConnection"],
            "Create link database authority is unspecified.",
            target,
          );
        else if (resource.kind !== "source" || (role && resource.authority !== role.owner))
          report(
            "CONFIG_INVALID",
            [...path, "binding", "storeConnection"],
            "Create link writes require the receiver's own source authority; foreign writes and projections are refused.",
            target,
          );
        const dependency = ownership.dependencies.find((x) => x.connection === link.id),
          grant = ownership.grants.find(
            (x) => x.role === receiver.role && x.resource === link.to.element,
          );
        if (!dependency || !grant)
          report(
            "CONFIG_REQUIRED",
            [...path, "binding", "storeConnection"],
            "Create link needs both explicit write dependency intent and a write role grant.",
            target,
          );
        if (
          (dependency && !accessAllows(dependency.access, "write")) ||
          (grant && !accessAllows(grant.access, "write"))
        )
          report(
            "CONFIG_INVALID",
            [...path, "binding", "storeConnection"],
            "Create link writes exceed the declared dependency or role grant; a read remains a read.",
            target,
          );
      }
    }
    if (knownCreate && receiver.binding.successRetentionHours === null)
      report(
        "CONFIG_REQUIRED",
        [...path, "binding", "successRetentionHours"],
        "Declare the required 24-hour durable successful-key retention; no retention binding is specified.",
        target,
      );
    if (knownCreate)
      report(
        "CONFIG_REQUIRED",
        [...path, "binding", "authVerifier"],
        receiver.binding.authVerifier
          ? `Runtime auth verifier ${receiver.binding.authVerifier.id}@${receiver.binding.authVerifier.version} (${receiver.binding.authVerifier.sha256}) is unresolved/unavailable; it is not verification evidence.`
          : "Trusted runtime auth verifier is unspecified and unavailable. The known operation requires verified issuer+subject, authenticity, issuer, audience and time validity; raw identity headers do not satisfy it.",
        target,
      );
  });
  model.calls.forEach((call, index) => {
    const path = ["calls", index],
      target =
        call.caller.kind === "entry"
          ? { element: call.receiverRole }
          : { connection: call.caller.connection };
    signature(call.expects, [...path, "expects"], target);
    if (!design.elements.some((x) => x.id === call.receiverRole))
      report(
        "UNKNOWN_REFERENCE",
        [...path, "receiverBinding"],
        `Operation target ${call.receiverRole} is missing.`,
        target,
      );
    if (call.caller.kind === "entry") {
      const caller = call.caller,
        entry = design.architecture?.studio?.entries?.find((x) => x.id === caller.entry);
      if (!entry)
        report(
          "UNKNOWN_REFERENCE",
          [...path, "caller"],
          `Operation entry ${caller.entry} is missing.`,
          target,
        );
      else if (
        entry.lane !== caller.lane ||
        entry.element !== caller.element ||
        entry.element !== call.receiverRole
      )
        report(
          "CONFIG_INVALID",
          [...path, "caller"],
          "Operation entry ID, lane, canonical element and receiver must match the actual entry.",
          target,
        );
    } else {
      const caller = call.caller,
        link = design.connections.find((x) => x.id === caller.connection);
      if (!link)
        report(
          "UNKNOWN_REFERENCE",
          [...path, "caller"],
          `Operation caller connection ${caller.connection} is missing.`,
          target,
        );
      else {
        if (
          link.from.element !== caller.role ||
          link.to.element !== call.receiverRole ||
          (isCreateOperation(call.expects) && link.planned.interaction !== "Request / response")
        )
          report(
            "CONFIG_INVALID",
            [...path, "caller"],
            "Operation caller role/receiver must match the actual synchronous connection endpoints.",
            target,
          );
        if (isCreateOperation(call.expects)) {
          if (!["HTTP", "HTTPS"].includes(link.planned.protocol))
            report(
              studioProtocolSchema.options.some((x) => x === link.planned.protocol) &&
                link.planned.protocol !== "Unspecified"
                ? "CONFIG_INVALID"
                : "CONFIG_REQUIRED",
              [...path, "caller", "connection"],
              `Connection protocol intent ${link.planned.protocol} does not match the fixed HTTP operation. Unknown protocol labels supply no transport implementation.`,
              target,
            );
          const settings = design.architecture?.studio?.connections.find(
            (x) => x.connection === link.id,
          )?.settings;
          if (settings?.timeoutMs !== undefined && settings.timeoutMs !== call.expects.timeoutMs)
            report(
              "CONFIG_INVALID",
              [...path, "expects", "timeoutMs"],
              "Connection request timeout contradicts the operation's single total 10000ms deadline.",
              target,
            );
          if (settings?.retry?.mode === "fixed")
            report(
              "CONFIG_REQUIRED",
              [...path, "caller", "connection"],
              "Fixed connection retries have no declared same-key/principal propagation or shared total deadline; automatic replay compatibility is unresolved.",
              target,
            );
          if (settings?.channelUse)
            report(
              "CONFIG_INVALID",
              [...path, "caller", "connection"],
              "A synchronous create call cannot also declare publish/consume channel use.",
              target,
            );
          if (link.planned.security !== "User identity")
            report(
              "CONFIG_REQUIRED",
              [...path, "caller", "connection"],
              `Connection ${link.planned.security} intent does not specify propagation of a verified user principal. Public reachability is distinct from unauthenticated access; service identity alone does not verify the creator.`,
              target,
            );
        }
      }
      if (!ownership.roles.some((x) => x.element === caller.role))
        report(
          "CONFIG_REQUIRED",
          [...path, "caller", "role"],
          `Operation caller ${caller.role} has no declared role.`,
          target,
        );
    }
    const receiver = model.receivers.find((x) => x.id === call.receiverBinding);
    if (!receiver)
      report(
        "UNKNOWN_REFERENCE",
        [...path, "receiverBinding"],
        `Receiver operation binding ${call.receiverBinding} is missing.`,
        target,
      );
    else if (receiver.role !== call.receiverRole)
      report(
        "CONFIG_INVALID",
        [...path, "receiverRole"],
        "Receiver binding and canonical target role must agree.",
        target,
      );
    else if (
      JSON.stringify(call.expects) !== JSON.stringify(receiver.implementation) &&
      (!knownCreateSignature(call.expects) || !knownCreateSignature(receiver.implementation))
    )
      report(
        "CONFIG_REQUIRED",
        [...path, "expects"],
        "Caller/receiver exact contract equality is unresolved; unknown refs cannot establish compatibility.",
        target,
      );
  });
  return findings;
}

/** Attribute readiness by canonical binding paths, including callers on service edges. */
export function findingsForOperationBinding(
  design: DesignDocument,
  id: string,
  findings = operationContractFindings(design),
) {
  const model = designOperations(design),
    index = model.receivers.findIndex((x) => x.id === id);
  if (index < 0) return [];
  return findings.filter((item) => {
    const path = item.target.path;
    return (
      path?.[0] === "operations" &&
      ((path[1] === "receivers" && path[2] === index) ||
        (path[1] === "calls" &&
          typeof path[2] === "number" &&
          model.calls[path[2]]?.receiverBinding === id))
    );
  });
}

/** Explicit deletion cleans canonical references; it never retargets an operation. */
export function pruneOperationContracts(
  design: DesignDocument,
  elements: readonly string[],
  connections: readonly string[],
) {
  if (design.schemaVersion !== 3 || !design.operations) return;
  const removed = new Set(elements),
    links = new Set(connections),
    model = design.operations;
  const lost = new Set(
    model.receivers
      .filter((x) => removed.has(x.role) || links.has(x.binding.storeConnection))
      .map((x) => x.id),
  );
  const retained = new Set(
    model.receivers
      .filter((x) => !removed.has(x.role) && !links.has(x.binding.storeConnection))
      .map((x) => x.id),
  );
  model.receivers = model.receivers.filter((x) => retained.has(x.id));
  model.calls = model.calls.filter(
    (x) =>
      !removed.has(x.receiverRole) &&
      (x.caller.kind === "entry"
        ? !removed.has(x.caller.element)
        : !removed.has(x.caller.role) && !links.has(x.caller.connection)),
  );
  // Removing a receiver's authority edge clears its calls too, including previously unresolved ones.
  model.calls = model.calls.filter((x) => !lost.has(x.receiverBinding));
}
export function operationsAfterOwnership(
  design: DesignDocument,
  next: Ownership,
): OperationContracts {
  const before = designOwnership(design),
    model = structuredClone(designOperations(design));
  const changed = (role: string) => {
    const old = before.roles.find((x) => x.element === role),
      value = next.roles.find((x) => x.element === role);
    return !!old && (!value || old.owner !== value.owner || old.kind !== value.kind);
  };
  const cleared = new Set(
    model.receivers
      .filter((x) => {
        const link = design.connections.find((link) => link.id === x.binding.storeConnection);
        if (changed(x.role)) return true;
        if (!link) return false;
        const oldResource = before.resources.find((r) => r.element === link.to.element),
          resource = next.resources.find((r) => r.element === link.to.element);
        return (
          (oldResource && JSON.stringify(oldResource) !== JSON.stringify(resource)) ||
          (before.grants.some((g) => g.role === x.role && g.resource === link.to.element) &&
            !next.grants.some((g) => g.role === x.role && g.resource === link.to.element)) ||
          (before.dependencies.some((d) => d.connection === link.id) &&
            !next.dependencies.some((d) => d.connection === link.id))
        );
      })
      .map((x) => x.id),
  );
  model.receivers = model.receivers.filter((x) => !cleared.has(x.id));
  model.calls = model.calls.filter(
    (x) =>
      !cleared.has(x.receiverBinding) &&
      !(x.caller.kind === "connection" && changed(x.caller.role)),
  );
  return model;
}
export function pruneOperationEntries(
  design: DesignDocument,
  previous: { id: string; lane: string; element: string }[],
) {
  if (design.schemaVersion !== 3 || !design.operations) return;
  const entries = design.architecture?.studio?.entries ?? [];
  const changed = new Set(
    previous
      .filter(
        (old) =>
          !entries.some((x) => x.id === old.id && x.lane === old.lane && x.element === old.element),
      )
      .map((x) => x.id),
  );
  design.operations.calls = design.operations.calls.filter(
    (x) => x.caller.kind !== "entry" || !changed.has(x.caller.entry),
  );
}
export const operationsCommandSchema = z.strictObject({
  operations: operationContractsSchema,
  upgrade: z.boolean().default(false),
});
export function buildOperationsCommand(
  design: DesignDocument,
  input: z.input<typeof operationsCommandSchema>,
): { ops: OperationInput[] } {
  const command = operationsCommandSchema.parse(input);
  if (design.schemaVersion === 2 && !command.upgrade)
    throw new Error(
      "Preview and explicitly upgrade to schema v3 before saving operation bindings.",
    );
  if (JSON.stringify(designOperations(design)) === JSON.stringify(command.operations))
    return { ops: [] };
  return {
    ops: [
      ...(design.schemaVersion === 2
        ? [{ op: "upgradeDesign" as const, scope: emptyDesignScope() }]
        : []),
      { op: "setOperations", operations: command.operations },
    ],
  };
}
export function operationChanges(before: OperationContracts, after: OperationContracts) {
  return (["receivers", "calls"] as const).flatMap((field) => {
    const key = (row: OperationReceiver | OperationCall) => row.id;
    const old = new Map<string, OperationReceiver | OperationCall>(
        before[field].map((x) => [key(x), x]),
      ),
      next = new Map<string, OperationReceiver | OperationCall>(
        after[field].map((x) => [key(x), x]),
      );
    return [
      ...[...next]
        .filter(([id, row]) => JSON.stringify(old.get(id)) !== JSON.stringify(row))
        .map(([id, row]) => ({
          field,
          id,
          change: old.has(id) ? "updated" : "added",
          before: old.get(id) ?? null,
          after: row,
        })),
      ...[...old]
        .filter(([id]) => !next.has(id))
        .map(([id, row]) => ({ field, id, change: "removed", before: row, after: null })),
    ];
  });
}
export type OperationChange = ReturnType<typeof operationChanges>[number];
export function operationChangeSummary(design: DesignDocument, row: OperationChange) {
  const value = row.after ?? row.before,
    name = (id: string) => design.elements.find((x) => x.id === id)?.name ?? id;
  if (!value) return row.id;
  return "implementation" in value
    ? `${row.change === "removed" ? "Clear" : row.change === "added" ? "Declare" : "Change"} ${operationDisplayName(value.implementation)} implementation on ${name(value.role)}`
    : `${row.change === "removed" ? "Clear" : row.change === "added" ? "Bind" : "Change"} ${value.caller.kind === "entry" ? `${value.caller.lane} entry ${value.caller.entry}` : `${name(value.caller.role)} (${value.caller.connection})`} → ${name(value.receiverRole)} · ${operationDisplayName(value.expects)} expectation`;
}
export function previewOperations(design: DesignDocument, operations: OperationContracts) {
  const model = operationContractsSchema.parse(operations),
    candidate: DesignDocument = {
      ...design,
      schemaVersion: 3,
      scope: design.schemaVersion === 3 ? design.scope : emptyDesignScope(),
      operations: model,
    };
  const findings = operationContractFindings(candidate);
  return {
    fromSchema: design.schemaVersion,
    toSchema: 3,
    operations: model,
    changes: operationChanges(designOperations(design), model),
    findings,
    canApply: !findings.some(isStructural),
    note: "Exact declared contracts only. Auth verifier, compatible template and runtime verification are unavailable. Saving is one Undo step.",
  };
}
