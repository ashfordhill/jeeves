/** Pure command/lifecycle checks. No execution, SQL, policy evaluation or implementation selection. */
import {
  type ContractField,
  type ContractValue,
  contractCanonical,
  contractKey,
  contractOwnerElement,
  resolveContractValue,
} from "./architecture-contracts.ts";
import type {
  BackendGuard,
  BackendOperation,
  BackendValueSource,
} from "./backend-behavior-model.ts";
import { backendCapabilityExactReferences } from "./backend-capability-configs.ts";
import { backendTransactionAggregates } from "./backend-commerce-transactions.ts";
import { backendEntity, backendEntityFields } from "./backend-entity.ts";
import type { BackendReference } from "./backend-model.ts";
import { validateBackendPolicyUse } from "./backend-policy.ts";
import { validateBackendProtocol } from "./backend-protocol.ts";
import { backendQuerySources } from "./backend-queries.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";

const same = (a: BackendReference, b: BackendReference) => contractKey(a) === contractKey(b);
const fieldKey = (v: { entity: BackendReference; field: string }) =>
  `${contractKey(v.entity)}/${v.field}`;
type Value = ContractValue & { required?: boolean };
/** Conservative assignability: bounded sources must fit every target bound; no runtime coercion. */
export function backendValueFits(source: Value, target: Value): boolean {
  if (source.type === "text") {
    const bounds =
      source.textConstraint === "sha256"
        ? { minLength: 64, maxLength: 64 }
        : source.textConstraint === "correlation-id"
          ? { minLength: 1, maxLength: 128 }
          : source.textConstraint === "error-code"
            ? { minLength: 1, maxLength: 64 }
            : source.enumValues?.length
              ? {
                  minLength: Math.min(...source.enumValues.map((v) => v.length)),
                  maxLength: Math.max(...source.enumValues.map((v) => v.length)),
                }
              : {};
    source = { ...bounds, ...source };
  }
  if (
    source.type !== target.type ||
    (source.nullable && !target.nullable) ||
    (target.required && source.required === false)
  )
    return false;
  if (
    target.enumValues &&
    (!source.enumValues || source.enumValues.some((v) => !target.enumValues?.includes(v)))
  )
    return false;
  for (const [lower, upper] of [
    ["minimum", "maximum"],
    ["minLength", "maxLength"],
    ["minItems", "maxItems"],
    ["minEntries", "maxEntries"],
  ] as const) {
    const sourceLower = source[lower],
      targetLower = target[lower],
      sourceUpper = source[upper],
      targetUpper = target[upper];
    if (targetLower !== undefined && (sourceLower === undefined || sourceLower < targetLower))
      return false;
    if (targetUpper !== undefined && (sourceUpper === undefined || sourceUpper > targetUpper))
      return false;
  }
  if (target.type === "object")
    return (
      !!target.fields &&
      !!source.fields &&
      target.fields.every((t) => {
        const s = source.fields?.find((s) => s.id === t.id);
        return s ? backendValueFits(s, t) : !t.required;
      }) &&
      source.fields.every((s) => target.fields?.some((t) => t.id === s.id))
    );
  if (target.type === "array")
    return !!source.items && !!target.items && backendValueFits(source.items, target.items);
  if (target.type === "map")
    return (
      !!source.keys &&
      !!target.keys &&
      !!source.values &&
      !!target.values &&
      backendValueFits({ type: "text", ...source.keys }, { type: "text", ...target.keys }) &&
      backendValueFits(source.values, target.values)
    );
  if (target.type === "tagged-union")
    return (
      source.discriminator === target.discriminator &&
      !!source.variants?.length &&
      !!target.variants?.length &&
      source.variants.every((s) => target.variants?.some((t) => backendValueFits(s, t)))
    );
  if (["ref", "unresolved"].includes(target.type)) return false;
  return true;
}
function literalFits(value: string | number | boolean | null, target: Value): boolean {
  if (value === null) return !!target.nullable;
  if (typeof value === "boolean") return target.type === "boolean";
  if (typeof value === "number")
    return (
      ["integer", "number"].includes(target.type) &&
      (target.minimum === undefined || value >= target.minimum) &&
      (target.maximum === undefined || value <= target.maximum)
    );
  if (target.type === "uuid")
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  if (target.type === "timestamp")
    return (
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 19) === value.slice(0, 19)
    );
  return (
    target.type === "text" &&
    (!target.enumValues || target.enumValues.includes(value)) &&
    (target.minLength === undefined || value.length >= target.minLength) &&
    (target.maxLength === undefined || value.length <= target.maxLength)
  );
}
/** Shared typed mapping checks for command actions, hooks and durable intent. */
export function backendValueChecks(
  design: DesignDocument,
  add: (
    code: "CONFIG_INVALID" | "UNKNOWN_REFERENCE",
    path: (string | number)[],
    message: string,
  ) => void,
) {
  const model = design.architecture?.backend;
  const contract = (r: BackendReference) => design.architecture?.contracts?.find((c) => same(c, r));
  const aggregate = (r: BackendReference) => model?.aggregates.find((a) => same(a, r));
  const entityField = (r: { entity: BackendReference; field: string }) => {
    const e = backendEntity(design, r.entity);
    return e && backendEntityFields(design, e).find((f) => f.id === r.field);
  };
  const sourceType = (
    source: BackendValueSource,
    path: (string | number)[],
    op?: BackendOperation,
    before = 0,
  ): Value | undefined => {
    const fieldAt = (fields: ContractField[], parts: string[]): Value | undefined => {
      let value: Value | undefined;
      let required = true,
        nullable = false;
      for (const id of parts) {
        const f: ContractField | undefined = fields.find((f) => f.id === id);
        if (!f) return undefined;
        required = required && f.required;
        nullable = nullable || !!f.nullable;
        value = f;
        fields = f.type === "object" ? (f.fields ?? []) : [];
      }
      return value && { ...value, required, nullable };
    };
    const expanded = (fields: ContractField[], ref: BackendReference) =>
      fields.flatMap((f) => {
        const v = resolveContractValue(f, contract(ref)?.shape?.types ?? []).value;
        return v ? [{ ...f, ...v }] : [];
      });
    let value: Value | undefined;
    if (source.kind === "query-result") {
      const queryRef = op?.query;
      const q = queryRef && model?.queries?.find((q) => same(q, queryRef));
      if (q && op?.kind === "query") {
        const sources = backendQuerySources(design, q);
        const fields = q.projection.flatMap((p) => {
          const s = sources.get(p.field.source);
          const f = s && backendEntityFields(design, s.entity).find((f) => f.id === p.field.field);
          return f ? [{ ...f, id: p.id, nullable: !!f.nullable || !!s?.nullable }] : [];
        });
        value = {
          type: "array",
          minItems: 0,
          maxItems: q.limit.maximum,
          required: true,
          items: { type: "object", fields },
        };
      }
    } else if (source.kind === "input") {
      const c = op && contract(op.target.contract);
      value =
        op &&
        fieldAt(
          expanded(
            c?.shape?.operations.find((o) => o.id === op.target.operation)?.input ?? [],
            op.target.contract,
          ),
          source.path,
        );
    } else if (source.kind === "current") {
      const createdIndex =
        op?.actions.findIndex(
          (a) =>
            "entity" in a &&
            ["create", "create-child", "append-revision"].includes(a.kind) &&
            same(a.entity, source.entity),
        ) ?? -1;
      if (createdIndex >= 0 && before <= createdIndex)
        add(
          "CONFIG_INVALID",
          path,
          "A newly created row has no current snapshot before insertion; use an earlier action result.",
        );
      const a = op && aggregate(op.aggregate);
      if (
        op?.protocol?.records.some((r) => same(r.entity, source.entity)) ||
        !a ||
        (op &&
          model &&
          backendTransactionAggregates(model, op).some((g) =>
            [g.root, ...g.children].some((r) => same(r, source.entity)),
          ))
      )
        value = entityField(source);
    } else if (source.kind === "context")
      value =
        source.value === "correlation"
          ? { type: "text", maxLength: 128, required: true }
          : { type: "uuid", required: true };
    else if (source.kind === "server")
      value =
        source.factory === "delivery-identity"
          ? { type: "text", required: true, minLength: 1, maxLength: 128 }
          : source.factory === "uuid"
            ? { type: "uuid", required: true }
            : source.factory === "clock"
              ? { type: "timestamp", required: true }
              : {
                  type: "integer",
                  minimum: source.factory === "initial-version" ? 1 : 0,
                  maximum: source.factory === "initial-version" ? 1 : Number.MAX_SAFE_INTEGER,
                  required: true,
                };
    else if (source.kind === "literal")
      return source.value === null
        ? { type: "unresolved", nullable: true, required: true }
        : typeof source.value === "string"
          ? {
              type: "text",
              enumValues: [source.value],
              minLength: source.value.length,
              maxLength: source.value.length,
              required: true,
            }
          : typeof source.value === "number"
            ? { type: "integer", minimum: source.value, maximum: source.value, required: true }
            : { type: "boolean", required: true };
    else {
      const action = op?.actions.slice(0, before).find((a) => a.id === source.action);
      if (action?.kind === "hook") {
        const hook = model?.hooks?.find((h) => same(h, action.hook));
        if (hook)
          value = fieldAt(
            expanded(contract(hook.contracts.output)?.shape?.payload ?? [], hook.contracts.output),
            source.path,
          );
      } else if (action?.kind === "capability")
        value = fieldAt(
          expanded(contract(action.strategy.result)?.shape?.payload ?? [], action.strategy.result),
          source.path,
        );
      else if (
        action &&
        "entity" in action &&
        ["create", "create-child", "append-revision"].includes(action.kind)
      ) {
        const e = backendEntity(design, action.entity);
        value = e && fieldAt(backendEntityFields(design, e), source.path);
      }
    }
    if (!value)
      add(
        "UNKNOWN_REFERENCE",
        path,
        "Value source must resolve a stable field path in this exact input, aggregate or preceding action result.",
      );
    return value;
  };
  const checkValue = (
    source: BackendValueSource,
    target: Value,
    path: (string | number)[],
    op?: BackendOperation,
    before = 0,
  ) => {
    const v = sourceType(source, path, op, before);
    if (
      v &&
      !(source.kind === "literal" ? literalFits(source.value, target) : backendValueFits(v, target))
    )
      add(
        "CONFIG_INVALID",
        path,
        "Value source type, nullability, requiredness or bounds do not fit the target field.",
      );
  };
  return { sourceType, checkValue };
}
export function validateBackendBehavior(design: DesignDocument): Finding[] {
  const model = design.architecture?.backend;
  if (!model) return [];
  const result: Finding[] = [];
  const contract = (r: BackendReference) => design.architecture?.contracts?.find((c) => same(c, r));
  const aggregate = (r: BackendReference) => model.aggregates.find((a) => same(a, r));
  const lifecycle = (r: BackendReference) => model.lifecycles?.find((l) => same(l, r));
  const entityField = (r: { entity: BackendReference; field: string }) => {
    const e = backendEntity(design, r.entity);
    return e && backendEntityFields(design, e).find((f) => f.id === r.field);
  };
  const add = (
    code: "CONFIG_INVALID" | "CONFIG_REQUIRED" | "UNKNOWN_REFERENCE" | "NEEDS_TEMPLATE",
    path: (string | number)[],
    message: string,
  ) => result.push(finding(code, message, { path }));
  const unique = (values: string[], path: (string | number)[], what: string) => {
    if (new Set(values).size !== values.length)
      add("CONFIG_INVALID", path, `${what} must be distinct.`);
  };
  const { sourceType, checkValue } = backendValueChecks(design, add);
  const checkGuards = (
    guards: BackendGuard[],
    path: (string | number)[],
    op?: BackendOperation,
    participant?: BackendReference[],
  ) => {
    unique(
      guards.map((g) => g.id),
      path,
      "Guard identities",
    );
    for (const g of guards) {
      const values = g.kind === "compare" ? [g.left, g.right] : [g.value];
      for (const source of values) {
        if (
          source.kind === "server" ||
          source.kind === "query-result" ||
          source.kind === "result" ||
          (!op && source.kind === "input")
        )
          add(
            "CONFIG_INVALID",
            [...path, g.id],
            "Pre-write guards may read only typed input, trusted context, persisted current fields and literals.",
          );
        if (
          participant &&
          source.kind === "current" &&
          !participant.some((p) => same(p, source.entity))
        )
          add(
            "CONFIG_INVALID",
            [...path, g.id],
            "Lifecycle guard field must belong to its aggregate.",
          );
      }
      const left = sourceType(g.kind === "compare" ? g.left : g.value, [...path, g.id], op);
      if (g.kind === "compare") {
        const right = sourceType(g.right, [...path, g.id], op);
        const nonLiteral = g.left.kind === "literal" ? right : left;
        const literal =
          g.left.kind === "literal" ? g.left : g.right.kind === "literal" ? g.right : undefined;
        if (
          left &&
          right &&
          (literal
            ? !nonLiteral || !literalFits(literal.value, nonLiteral)
            : left.type !== right.type ||
              !["text", "integer", "boolean", "uuid", "timestamp"].includes(left.type))
        )
          add("CONFIG_INVALID", [...path, g.id], "Guard comparison needs compatible typed values.");
        if (
          !["eq", "ne"].includes(g.operator) &&
          [left, right].some(
            (v) =>
              !v ||
              (literal && v.type === "text" && nonLiteral?.type === "timestamp"
                ? false
                : !["integer", "timestamp"].includes(v.type)) ||
              v.nullable ||
              v.required === false,
          )
        )
          add(
            "CONFIG_INVALID",
            [...path, g.id],
            "Ordered guards require required nonnullable integer or timestamp values.",
          );
      }
    }
  };
  for (const l of model.lifecycles ?? []) {
    const path = ["architecture", "backend", "lifecycles", contractKey(l)];
    const a = aggregate(l.aggregate),
      f = entityField(l.state);
    if (!a)
      add(
        "UNKNOWN_REFERENCE",
        path,
        "Lifecycle aggregate does not exist at the selected exact version.",
      );
    if (a && ![a.root, ...a.children].some((r) => same(r, l.state.entity)))
      add("CONFIG_INVALID", path, "Lifecycle state must belong to its aggregate.");
    if (
      f?.type !== "text" ||
      !f.required ||
      f.nullable ||
      !f.enumValues ||
      contractCanonical([...f.enumValues].sort()) !== contractCanonical([...l.states].sort())
    )
      add(
        "CONFIG_INVALID",
        path,
        "Lifecycle states must agree exactly with a required nonnullable persisted enum field.",
      );
    if (
      backendEntity(design, l.state.entity)?.fields.find((f) => f.field === l.state.field)
        ?.serverOwned
    )
      add(
        "CONFIG_INVALID",
        path,
        "Lifecycle state cannot replace a server-owned identity/version field.",
      );
    unique(l.states, path, "Lifecycle states");
    unique(
      l.transitions.map((t) => t.id),
      path,
      "Transition identities",
    );
    unique(
      l.transitions.map((t) => contractCanonical([t.from, t.to])),
      path,
      "Transition pairs",
    );
    if (!l.states.includes(l.initial))
      add("CONFIG_INVALID", path, "Lifecycle initial state does not exist.");
    checkGuards(l.guards, [...path, "guards"], undefined, a && [a.root, ...a.children]);
    const reachable = new Set([l.initial]);
    for (let i = 0; i < l.states.length; i++)
      for (const t of l.transitions) if (reachable.has(t.from)) reachable.add(t.to);
    for (const t of l.transitions) {
      if (!l.states.includes(t.from) || !l.states.includes(t.to))
        add("CONFIG_INVALID", [...path, t.id], "Transition references a nonexistent state.");
      if (!reachable.has(t.from))
        add("CONFIG_INVALID", [...path, t.id], "Transition is unreachable from the initial state.");
      unique(t.guards, [...path, t.id], "Transition guard references");
      for (const id of t.guards)
        if (!l.guards.some((g) => g.id === id))
          add("UNKNOWN_REFERENCE", [...path, t.id], "Transition guard does not exist.");
    }
    if (l.states.some((s) => !reachable.has(s)))
      add("CONFIG_INVALID", path, "Lifecycle contains unreachable states.");
    if (
      model.lifecycles?.some(
        (other) => other.id !== l.id && fieldKey(other.state) === fieldKey(l.state),
      )
    )
      add(
        "CONFIG_INVALID",
        path,
        "One lifecycle identity owns each state field; use successor versions for changes.",
      );
  }
  const targets = new Set<string>();
  for (const op of model.operations ?? []) {
    if (op.protocol) {
      result.push(...validateBackendProtocol(design, op));
      continue;
    }
    const path = ["architecture", "backend", "operations", contractKey(op)];
    const invalid = (message: string, suffix: (string | number)[] = []) =>
      add("CONFIG_INVALID", [...path, ...suffix], message);
    const missing = (message: string) => add("UNKNOWN_REFERENCE", path, message);
    const a = aggregate(op.aggregate),
      c = contract(op.target.contract),
      wire = c?.shape?.operations.find((o) => o.id === op.target.operation);
    if (!a) missing("Command aggregate does not exist at the selected exact version.");
    if (!wire || c?.kind !== "api") missing("Command target must resolve an exact API operation.");
    const targetKey = `${contractKey(op.target.contract)}/${op.target.operation}/${op.target.owner.kind}/${op.target.owner.id}`;
    if (targets.has(targetKey))
      invalid("This exact operation/owner already has a behavior binding.");
    targets.add(targetKey);
    if (
      !design.architecture?.interfaces?.some(
        (i) =>
          i.direction === "provided" &&
          i.owner.kind === op.target.owner.kind &&
          i.owner.id === op.target.owner.id &&
          same(i.contract, op.target.contract),
      )
    )
      missing("Behavior owner must provide the exact target interface.");
    if (
      a &&
      (a.owner.id !== op.target.owner.id ||
        a.owner.kind !== op.target.owner.kind ||
        !contractOwnerElement(design, op.target.owner))
    )
      invalid("Behavior and aggregate must have the same explicit owner.");
    if (
      wire?.behavior?.kind &&
      wire.behavior.kind !== "Unspecified" &&
      wire.behavior.kind.toLowerCase() !== op.kind
    )
      invalid("Structured behavior kind contradicts the operation's explanatory behavior kind.");
    const transactionAggregates = backendTransactionAggregates(model, op);
    const participants = transactionAggregates.flatMap((g) => [g.root, ...g.children]);
    if (
      transactionAggregates.some(
        (g) =>
          g.store !== op.transaction.store ||
          contractOwnerElement(design, g.owner) !== contractOwnerElement(design, op.target.owner),
      )
    )
      invalid(
        "Composed commerce transactions require one authoritative store and application owner; cross-store atomicity is unsupported.",
      );
    if (
      a &&
      (op.transaction.store !== a.store ||
        contractCanonical(op.transaction.participants.map(contractKey).sort()) !==
          contractCanonical(participants.map(contractKey).sort()))
    )
      invalid(
        "A local transaction must declare exactly its aggregate participants and authoritative store; cross-store atomicity is unsupported.",
      );
    unique(
      op.transaction.participants.map(contractKey),
      [...path, "transaction"],
      "Transaction participants",
    );
    const root = a && backendEntity(design, a.root);
    if (a) {
      result.push(
        ...validateBackendPolicyUse(design, {
          resource: a.root,
          selection: op.access.policy,
          action: op.access.action,
          site: op.kind === "command" ? "write" : "read",
          projection: op.kind === "command" ? op.access.writeProjection : op.access.readProjection,
          fields: op.writes
            .filter(
              (w) =>
                same(w.entity, a.root) &&
                !root?.fields.find((f) => f.field === w.field)?.serverOwned,
            )
            .map((w) => w.field),
          path: [...path, "access"],
        }),
      );
      if (op.kind === "command")
        result.push(
          ...validateBackendPolicyUse(design, {
            resource: a.root,
            selection: op.access.policy,
            action: op.access.action,
            site: "idempotent-replay",
            projection: op.access.readProjection,
            path: [...path, "access", "replay"],
          }),
        );
    }
    for (const b of model.accessBindings ?? []) {
      if (
        b.target.kind !== "operation" ||
        !same(b.target.contract, op.target.contract) ||
        b.target.operation !== op.target.operation ||
        b.target.owner.id !== op.target.owner.id ||
        b.target.owner.kind !== op.target.owner.kind ||
        !["write", "read", "idempotent-replay"].includes(b.site)
      )
        continue;
      const projection = b.site === "write" ? op.access.writeProjection : op.access.readProjection;
      if (
        (a && !same(b.resource, a.root)) ||
        contractCanonical(b.policy) !== contractCanonical(op.access.policy) ||
        b.action !== op.access.action ||
        b.projection !== projection
      )
        invalid(
          "Behavior policy/action/projection contradicts the existing exact operation access binding.",
          ["access"],
        );
    }
    const participantAccess = op.access.participants ?? [];
    unique(
      participantAccess.map((p) => contractKey(p.entity)),
      [...path, "access", "participants"],
      "Participant policy selections",
    );
    for (const p of participantAccess)
      if (!participants.some((r) => same(r, p.entity) && (!a || !same(r, a.root))))
        invalid("Participant policy must select an exact aggregate child.");
    for (const entity of participants) {
      const isRoot = !!a && same(entity, a.root);
      const policy = isRoot ? op.access : participantAccess.find((p) => same(p.entity, entity));
      const e = backendEntity(design, entity);
      const hasWrites = op.writes.some((w) => same(w.entity, entity));
      const written = op.writes
        .filter(
          (w) => same(w.entity, entity) && !e?.fields.find((f) => f.field === w.field)?.serverOwned,
        )
        .map((w) => w.field);
      const observed: string[] = [];
      for (const o of op.outcomes)
        for (const v of o.values) {
          if (v.value.kind === "current" && same(v.value.entity, entity))
            observed.push(v.value.field);
          if (v.value.kind === "result") {
            const source = v.value;
            const act = op.actions.find((a) => a.id === source.action);
            if (act && "entity" in act && same(act.entity, entity)) {
              const field = source.path[0];
              if (field) observed.push(field);
            }
          }
        }
      if (!policy && (hasWrites || observed.length))
        add(
          "CONFIG_REQUIRED",
          [...path, "access", "participants"],
          `Select an exact child policy for ${contractKey(entity)} writes/results; root access does not authorize private child fields.`,
        );
      if (policy) {
        if (hasWrites && !isRoot)
          result.push(
            ...validateBackendPolicyUse(design, {
              resource: entity,
              selection: policy.policy,
              action: policy.action,
              site: "write",
              projection: policy.writeProjection,
              fields: written,
              path: [...path, "access", contractKey(entity)],
            }),
          );
        if (observed.length)
          for (const site of op.kind === "command"
            ? (["read", "idempotent-replay"] as const)
            : (["read"] as const))
            result.push(
              ...validateBackendPolicyUse(design, {
                resource: entity,
                selection: policy.policy,
                action: policy.action,
                site,
                projection: policy.readProjection,
                fields: observed,
                path: [...path, "access", contractKey(entity), site],
              }),
            );
      }
    }
    if (op.kind === "query") {
      if (
        op.actions.length ||
        op.writes.length ||
        op.transaction.kind !== "read-only" ||
        op.idempotency.kind !== "read-only" ||
        op.expectedVersion.kind !== "none" ||
        op.cancellation.startsWork
      )
        invalid(
          "Read-only operations cannot have mutation actions, writes, command receipts or work-start effects.",
        );
      const q = model.queries?.find((q) => op.query && same(q, op.query));
      if (!q) missing("Read-only operation needs an exact bounded query strategy.");
      if (q) {
        unique(
          (op.queryInputs ?? []).map((v) => v.filter),
          [...path, "queryInputs"],
          "Query input bindings",
        );
        const sources = backendQuerySources(design, q);
        for (const v of op.queryInputs ?? []) {
          const f = q.filters.find((f) => f.id === v.filter),
            source = f && sources.get(f.field.source),
            target =
              source &&
              backendEntityFields(design, source.entity).find((t) => t.id === f?.field.field);
          if (!f || !target) {
            missing("Query input binding must select an existing exact filter.");
            continue;
          }
          if (!f.comparisons.includes(v.operator))
            invalid("Query input comparison is not allowlisted by its filter.");
          if (v.operator === "is-null" ? v.value !== undefined : v.value === undefined)
            invalid("Only is-null omits a query filter value.");
          if (v.value) {
            if (!["input", "context", "literal"].includes(v.value.kind))
              invalid(
                "Query filter inputs come only from typed input, trusted context or literals.",
              );
            checkValue(
              v.value,
              v.operator === "in"
                ? {
                    type: "array",
                    minItems: 1,
                    maxItems: f.maxValues,
                    items: target,
                    required: true,
                  }
                : target,
              [...path, "queryInputs", v.filter],
              op,
            );
          }
        }
      }
      if (
        q &&
        a &&
        (!same(q.root, a.root) ||
          contractCanonical(q.accessPolicy) !== contractCanonical(op.access.policy) ||
          q.accessProjection !== op.access.readProjection)
      )
        invalid("Query root and policy/projection must agree with the operation.");
    } else {
      if (op.queryInputs?.length)
        invalid(
          "Command query input bindings are not supported; select a read-only query operation.",
        );
      if (
        op.transaction.kind !== "local" ||
        op.idempotency.kind !== "command-key" ||
        op.query ||
        !op.actions.length
      )
        invalid(
          "A command requires finite actions, one local transaction and an atomic command-key receipt.",
        );
      if (a?.concurrency.kind === "optimistic") {
        if (op.expectedVersion.kind !== "input")
          invalid("Optimistic commands require typed expectedVersion input.");
        else {
          const f = entityField(a.concurrency.version);
          if (f)
            checkValue(
              { kind: "input", path: op.expectedVersion.path },
              f,
              [...path, "expectedVersion"],
              op,
            );
        }
      } else if (op.expectedVersion.kind !== "none")
        invalid("Expected version must follow the selected aggregate concurrency policy.");
    }
    checkGuards(op.guards, [...path, "guards"], op);
    unique(
      op.actions.map((a) => a.id),
      [...path, "actions"],
      "Action identities",
    );
    unique(op.writes.map(fieldKey), [...path, "writes"], "Declared writes");
    const actual: string[] = [];
    const created = new Set<string>();
    const selector = (
      entity: BackendReference,
      keys: NonNullable<BackendOperation["identity"]>,
      at: (string | number)[],
      before = 0,
    ) => {
      const e = backendEntity(design, entity);
      if (!e) return;
      if (contractCanonical(keys.map((v) => v.field)) !== contractCanonical(e.primaryKey))
        add(
          "CONFIG_INVALID",
          at,
          "Record identity must select each primary-key field once in declared order.",
        );
      for (const v of keys) {
        const f = entityField({ entity, field: v.field });
        if (f) checkValue(v.value, f, at, op, before);
        if (
          e.scope.kind === "field" &&
          v.field === e.scope.field &&
          (v.value.kind !== "context" || v.value.value !== "scope")
        )
          add("CONFIG_INVALID", at, "Record scope must come from the authorized trusted context.");
        if (v.value.kind === "server" || v.value.kind === "query-result")
          add(
            "CONFIG_INVALID",
            at,
            "Existing record identities cannot use factories or query collections.",
          );
      }
    };
    const createsRoot =
      !!a && op.actions.some((action) => action.kind === "create" && same(action.entity, a.root));
    if (a && op.kind === "command") {
      if (createsRoot) {
        if (op.identity?.length)
          invalid(
            "Root creation gets identity from its declared insert factories; it cannot also select an existing root.",
          );
      } else if (!op.identity?.length)
        add(
          "CONFIG_REQUIRED",
          [...path, "identity"],
          "Bind the exact root primary key before compilation.",
        );
      else {
        selector(a.root, op.identity, [...path, "identity"]);
        if (op.identity.some((v) => !["input", "context", "literal"].includes(v.value.kind)))
          invalid("Root identity may use only typed input, trusted context or literal key values.");
      }
    }
    if (op.kind === "query" && op.identity?.length)
      invalid("A bounded query uses declared filters, not a separate root selector.");
    const record = (w: { entity: BackendReference; field: string }, at: (string | number)[]) => {
      const key = fieldKey(w);
      actual.push(key);
      if (!participants.some((p) => same(p, w.entity)) || !entityField(w))
        add("UNKNOWN_REFERENCE", at, "Writes must select existing exact aggregate fields.");
    };
    for (const [index, action] of op.actions.entries()) {
      const at = [...path, "actions", action.id];
      if (action.kind === "hook") {
        const hook = model.hooks?.find((h) => same(h, action.hook));
        if (!hook) add("UNKNOWN_REFERENCE", at, "Action must select an exact hook.");
        else {
          if (
            hook.kind !== "pure" ||
            hook.boundary !== "before-commit" ||
            !same(hook.operation, op)
          )
            add(
              "CONFIG_INVALID",
              at,
              "Only this operation’s pure before-commit hook can run as a local action; external I/O stays outside the transaction.",
            );
          const c = contract(hook.contracts.input);
          const fields = c?.shape?.payload ?? [];
          unique(
            action.input.map((v) => v.field),
            at,
            "Hook input bindings",
          );
          for (const v of action.input) {
            const f = fields.find((f) => f.id === v.field);
            if (!f) add("UNKNOWN_REFERENCE", at, "Hook input field does not exist.");
            else {
              const resolved = resolveContractValue(f, c?.shape?.types ?? []).value;
              if (resolved) checkValue(v.value, { ...f, ...resolved }, at, op, index);
            }
          }
          if (fields.some((f) => f.required && !action.input.some((v) => v.field === f.id)))
            add("CONFIG_INVALID", at, "Bind every required hook input exactly once.");
        }
        continue;
      }
      if (action.kind === "capability") {
        const rc = contract(action.strategy.result);
        if (rc?.kind !== "data" || !rc.shape)
          add(
            "UNKNOWN_REFERENCE",
            at,
            "Domain strategy needs an exact typed data result contract.",
          );
        for (const v of action.input) sourceType(v.value, at, op, index);
        unique(
          action.input.map((v) => v.field),
          at,
          "Capability input bindings",
        );
        if (action.strategy.kind === "unsupported")
          add(
            "NEEDS_TEMPLATE",
            at,
            `Unsupported domain strategy ${contractKey(action.strategy.reference)} remains unsupported; it is not an implicit hook.`,
          );
        else {
          unique(
            action.input.map((v) => v.field),
            at,
            "Capability input bindings",
          );
          if (action.input.length !== 1 || action.input[0]?.field !== "cart-id")
            add(
              "CONFIG_INVALID",
              at,
              "checkout-order@v1 accepts exactly stable field cart-id: UUID; options bound maximumLines.",
            );
          for (const v of action.input)
            checkValue(v.value, { type: "uuid", required: true }, at, op, index);
          const fields = rc?.shape?.payload ?? [];
          if (
            fields.length !== 1 ||
            fields[0]?.id !== "order-id" ||
            fields[0]?.type !== "uuid" ||
            !fields[0]?.required ||
            fields[0]?.nullable
          )
            add(
              "CONFIG_INVALID",
              at,
              "checkout-order@v1 result schema is exactly required stable field order-id: UUID.",
            );
        }
        continue;
      }
      if (action.kind === "transition") {
        const l = lifecycle(action.lifecycle),
          t = l?.transitions.find((t) => t.id === action.transition);
        if (!l || !t)
          add(
            "UNKNOWN_REFERENCE",
            at,
            "Action must select an exact lifecycle and existing transition.",
          );
        else {
          if (!transactionAggregates.some((g) => same(l.aggregate, g)))
            add("CONFIG_INVALID", at, "Transition must belong to the command aggregate.");
          if (a && !same(l.state.entity, a.root)) {
            if (!action.key?.length)
              add("CONFIG_REQUIRED", at, "Bind the exact child primary key for this transition.");
            else selector(l.state.entity, action.key, at, index);
          } else if (action.key?.length)
            add("CONFIG_INVALID", at, "Root transitions use the operation identity.");
          record(l.state, at);
        }
        continue;
      }
      const e = backendEntity(design, action.entity);
      if (!e) {
        add("UNKNOWN_REFERENCE", at, "Action entity does not exist.");
        continue;
      }
      const creating = ["create", "create-child", "append-revision"].includes(action.kind);
      if (!creating && a && !same(e, a.root)) {
        if (!action.key?.length)
          add("CONFIG_REQUIRED", at, "Bind the exact child primary key for this mutation.");
        else selector(e, action.key, at, index);
      } else if (action.key?.length)
        add(
          "CONFIG_INVALID",
          at,
          "Root mutations use the operation identity; insert actions use their declared values.",
        );
      if (creating) {
        if (created.has(contractKey(e)))
          add(
            "CONFIG_INVALID",
            at,
            "An operation can create each declared entity once; no implicit loops.",
          );
        created.add(contractKey(e));
        if (
          action.kind === "create" ? !a || !same(e, a.root) : !a?.children.some((r) => same(r, e))
        )
          add(
            "CONFIG_INVALID",
            at,
            "Create selects the root; child/revision creation selects an owned aggregate child.",
          );
      }
      unique(
        action.values.map((v) => v.field),
        at,
        "Action field writers",
      );
      const relation = action.relation && e.relations.find((r) => r.id === action.relation);
      const relational = action.kind === "add-relation" || action.kind === "remove-relation";
      if (relational ? !relation : action.relation !== undefined)
        add(
          "CONFIG_INVALID",
          at,
          "Relation actions require an existing local relation; other actions cannot select one.",
        );
      if (
        relational &&
        relation &&
        contractCanonical(action.values.map((v) => v.field).sort()) !==
          contractCanonical(
            relation.fields
              .filter((p) => e.scope.kind !== "field" || p.source !== e.scope.field)
              .map((p) => p.source)
              .sort(),
          )
      )
        add("CONFIG_INVALID", at, "Relation actions write exactly the non-scope relation keys.");
      for (const v of action.values) {
        record({ entity: e, field: v.field }, at);
        if (v.value.kind === "result") {
          const source = v.value;
          const producer = op.actions.slice(0, index).find((a) => a.id === source.action);
          const h = producer?.kind === "hook" && model.hooks?.find((h) => same(h, producer.hook));
          if (h && !h.allowedWrites.some((w) => same(w.entity, e) && w.field === v.field))
            add(
              "CONFIG_INVALID",
              at,
              "Hook output may propose only explicitly allowed write fields.",
            );
        }
        const f = entityField({ entity: e, field: v.field }),
          storage = e.fields.find((f) => f.field === v.field);
        if (!f) continue;
        const owned = storage?.serverOwned;
        if (owned) {
          const correct =
            owned === "id"
              ? creating && v.value.kind === "server" && v.value.factory === "uuid"
              : owned === "principal" || owned === "scope"
                ? creating && v.value.kind === "context" && v.value.value === owned
                : owned === "clock"
                  ? v.value.kind === "server" && v.value.factory === "clock"
                  : v.value.kind === "server" &&
                    v.value.factory === (creating ? "initial-version" : "next-version");
          if (!correct)
            add(
              "CONFIG_INVALID",
              at,
              "Server-owned fields require their matching trusted factory/context; client, literal and strategy overrides are forbidden.",
            );
        } else if (v.value.kind === "server" && !["clock", "uuid"].includes(v.value.factory))
          add(
            "CONFIG_INVALID",
            at,
            "Revision factories may write only server-owned version fields.",
          );
        const state = model.lifecycles?.find(
          (l) => fieldKey(l.state) === fieldKey({ entity: e, field: v.field }),
        );
        if (state && (!creating || v.value.kind !== "literal" || v.value.value !== state.initial))
          add(
            "CONFIG_INVALID",
            at,
            "State writes require the selected transition; creation uses only the lifecycle initial state.",
          );
        if (
          action.kind === "remove-relation" &&
          (v.value.kind !== "literal" || v.value.value !== null || !f.nullable)
        )
          add(
            "CONFIG_INVALID",
            at,
            "Relation removal requires nullable keys and explicit null; trusted scope is retained.",
          );
        if (
          v.value.kind === "server" &&
          v.value.factory === "next-version" &&
          f.type === "integer"
        ) {
          if (!f.required || f.nullable || (f.minimum ?? -1) < 0)
            add(
              "CONFIG_INVALID",
              at,
              "Revision increment needs a bounded nonnegative integer with overflow checked before write.",
            );
        } else checkValue(v.value, f, at, op, index);
      }
      if (
        action.kind === "add-relation" &&
        action.values.some((v) => v.value.kind === "literal" && v.value.value === null)
      )
        add("CONFIG_INVALID", at, "Adding a relation requires nonnull relation keys.");
      if (creating)
        for (const f of backendEntityFields(design, e))
          if (f.required && !action.values.some((v) => v.field === f.id))
            add("CONFIG_INVALID", at, `Creation must bind required field ${f.id}.`);
    }
    unique(actual, [...path, "actions"], "Writers for each entity field");
    if (contractCanonical([...actual].sort()) !== contractCanonical(op.writes.map(fieldKey).sort()))
      invalid(
        "Declared writes must exactly match all action writes; undeclared or unused writes are invalid.",
      );
    if (
      op.kind === "command" &&
      a?.concurrency.kind === "optimistic" &&
      !actual.includes(fieldKey(a.concurrency.version))
    )
      invalid(
        "An optimistic mutation must write the aggregate version exactly once with CAS/checked increment.",
      );
    for (const w of op.writes)
      if (!participants.some((p) => same(p, w.entity)) || !entityField(w))
        missing("Declared write must select an exact aggregate field.");
    if (op.idempotency.kind === "command-key") {
      const keyType = sourceType(
        { kind: "input", path: op.idempotency.key },
        [...path, "idempotency", "key"],
        op,
      );
      if (
        keyType &&
        (keyType.type !== "text" ||
          !keyType.required ||
          keyType.nullable ||
          !keyType.maxLength ||
          keyType.maxLength > 200 ||
          (keyType.minLength ?? 0) < 1)
      )
        invalid("Command key must be required nonempty bounded text (at most 200).", [
          "idempotency",
        ]);
      const commandKey = op.idempotency.key[0];
      const expected = (wire?.input ?? []).filter((f) => f.id !== commandKey).map((f) => [f.id]);
      if (
        op.idempotency.key.length !== 1 ||
        contractCanonical(op.idempotency.hashInputs.map((p) => p.join("/")).sort()) !==
          contractCanonical(expected.map((p) => p.join("/")).sort())
      )
        invalid(
          "Hash inputs must include every normalized top-level input except the distinct command key, once; nested partial hashes are forbidden.",
          ["idempotency"],
        );
      if (op.access.policy.kind === "policy") {
        const p = model.accessPolicies?.find(
          (p) => op.access.policy.reference && same(p, op.access.policy.reference),
        );
        if (p?.context.identity === "public")
          invalid(
            "Command idempotency requires an authenticated principal or verified service identity.",
          );
      }
    }
    unique(
      op.outcomes.map((o) => o.trigger),
      [...path, "outcomes"],
      "Outcome triggers",
    );
    unique(
      op.outcomes.map((o) => o.outcome),
      [...path, "outcomes"],
      "Outcome identities",
    );
    const required =
      op.kind === "command"
        ? ["success", "conflict", "rejected", "failed", "unavailable", "cancelled", "uncertain"]
        : ["success", "rejected", "failed", "unavailable", "cancelled"];
    for (const trigger of required)
      if (!op.outcomes.some((o) => o.trigger === trigger))
        add(
          "CONFIG_REQUIRED",
          [...path, "outcomes"],
          `Declare the exact ${trigger} outcome; prose is explanatory only.`,
        );
    for (const outcome of op.outcomes) {
      const o = wire?.outcomes?.find((o) => o.id === outcome.outcome),
        at = [...path, "outcomes", outcome.outcome];
      if (!o) {
        add("UNKNOWN_REFERENCE", at, "Select an exact declared wire outcome.");
        continue;
      }
      const success = outcome.trigger === "success",
        unchanged = outcome.trigger === "unchanged",
        uncertain = outcome.trigger === "uncertain";
      const expectedState =
        success && op.kind === "command" ? "Committed" : uncertain ? "Unknown" : "Unchanged";
      if (
        o.state !== expectedState ||
        (success || unchanged ? o.kind !== "Success" : o.kind === "Success") ||
        (uncertain && (o.kind !== "Failure" || o.retry !== "Reconcile first")) ||
        (["conflict", "rejected"].includes(outcome.trigger) && o.kind !== "Rejection")
      )
        add(
          "CONFIG_INVALID",
          at,
          "Outcome kind/state/retry contradicts its trigger; errors never represent successful transitions and unknown commit requires reconciliation.",
        );
      const fields = success ? (o.payload ?? wire?.output ?? []) : (o.payload ?? []);
      if (
        op.kind === "query" &&
        outcome.values.some((v) => v.value.kind === "current" || v.value.kind === "result")
      )
        add(
          "CONFIG_INVALID",
          at,
          "Read-only results must use the declared bounded query result, never an unscoped current entity read.",
        );
      unique(
        outcome.values.map((v) => v.field),
        at,
        "Outcome field mappings",
      );
      for (const v of outcome.values) {
        const f = fields.find((f) => f.id === v.field);
        if (!f)
          add("UNKNOWN_REFERENCE", at, "Outcome mapping selects a missing stable output field.");
        else {
          const resolved = resolveContractValue(f, c?.shape?.types ?? []).value;
          if (resolved)
            checkValue(v.value, { ...f, ...resolved }, at, op, success ? op.actions.length : 0);
        }
        if (!success && v.value.kind === "result")
          add(
            "CONFIG_INVALID",
            at,
            "Uncommitted/uncertain outcomes cannot return mutation action results.",
          );
      }
      if (fields.some((f) => f.required && !outcome.values.some((v) => v.field === f.id)))
        add("CONFIG_INVALID", at, "Every required outcome field needs a typed mapping.");
    }
  }
  return result;
}

/** Exact referenced lifecycle/operation versions cannot change through simultaneous consumer removal. */
export function validateBackendBehaviorTransition(
  before: DesignDocument,
  after: DesignDocument,
): Finding[] {
  const model = before.architecture?.backend;
  return (model?.lifecycles ?? []).flatMap((l) => {
    if (
      !(model?.capabilityConfigs ?? [])
        .flatMap(backendCapabilityExactReferences)
        .some((r) => r.collection === "lifecycles" && same(r.reference, l)) &&
      !model?.operations?.some(
        (o) =>
          o.protocol?.transitions.some((t) => same(t.lifecycle, l)) ||
          o.actions.some((a) => a.kind === "transition" && same(a.lifecycle, l)),
      )
    )
      return [];
    const next = after.architecture?.backend?.lifecycles?.find((n) => same(n, l));
    const semantics = (v: typeof l) => {
      const { name: _name, ...rest } = v;
      return rest;
    };
    return !next || contractCanonical(semantics(l)) !== contractCanonical(semantics(next))
      ? [
          finding(
            "CONFIG_INVALID",
            `Referenced lifecycle ${contractKey(l)} is immutable; preserve it and create a successor version.`,
            { path: ["architecture", "backend", "lifecycles", contractKey(l)] },
          ),
        ]
      : [];
  });
}
