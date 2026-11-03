/** Pure persistence/read checks; no SQL, migrations or editable legacy schema copies. */

import { containerClassification } from "./architecture-choices.ts";
import {
  type ContractField,
  type ContractValue,
  contractCanonical,
  contractKey,
  contractOwnerElement,
} from "./architecture-contracts.ts";
import { backendEntity, backendEntityFields } from "./backend-entity.ts";
import { type BackendEntity, type BackendReference, backendCollections } from "./backend-model.ts";
import { validateBackendQueries } from "./backend-queries.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";

export { backendEntity, backendEntityFields } from "./backend-entity.ts";

const sameFields = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
const requiredScalar = (f: ContractField | undefined) =>
  !!f && f.required && !f.nullable && scalar(f);
function scalar(v: ContractValue): boolean {
  return (
    ["uuid", "boolean", "timestamp"].includes(v.type) ||
    (v.type === "text" && (!!v.enumValues?.length || v.maxLength !== undefined)) ||
    (v.type === "integer" &&
      v.minimum !== undefined &&
      v.maximum !== undefined &&
      Number.isSafeInteger(v.minimum) &&
      Number.isSafeInteger(v.maximum))
  );
}
function bounded(v: ContractValue): boolean {
  if (v.type === "object") return !!v.fields?.length && v.fields.every(bounded);
  if (v.type === "array") return v.maxItems !== undefined && !!v.items && bounded(v.items);
  if (v.type === "map")
    return !!v.keys?.maxLength && v.maxEntries !== undefined && !!v.values && bounded(v.values);
  if (v.type === "tagged-union") return !!v.variants?.length && v.variants.every(bounded);
  return scalar(v);
}
function compatible(a: ContractField, b: ContractField): boolean {
  const value = (v: ContractValue) => ({
    type: v.type,
    enumValues: v.enumValues,
    minLength: v.minLength,
    maxLength: v.maxLength,
    minimum: v.minimum,
    maximum: v.maximum,
  });
  return scalar(a) && scalar(b) && contractCanonical(value(a)) === contractCanonical(value(b));
}
export function validateBackendData(design: DesignDocument): Finding[] {
  const model = design.architecture;
  const backend = model?.backend;
  if (!model || !backend) return [];
  const result: Finding[] = [];
  const add = (
    code: "CONFIG_INVALID" | "UNKNOWN_REFERENCE" | "DUPLICATE_ID" | "CONFIG_REQUIRED",
    path: (string | number)[],
    message: string,
  ) => result.push(finding(code, message, { path: ["architecture", "backend", ...path] }));
  const outerIds = new Set([
    "system",
    ...design.elements.flatMap((e) => [e.id, ...e.attachments.map((a) => a.id)]),
    ...design.connections.map((c) => c.id),
    ...design.annotations.map((a) => a.id),
    ...Object.entries(model).flatMap(([, value]) =>
      Array.isArray(value)
        ? value.flatMap((v) => (v && typeof v === "object" && "id" in v ? [v.id as string] : []))
        : [],
    ),
  ]);
  for (const collection of backendCollections) {
    const seen = new Set<string>();
    const other = new Set(
      backendCollections
        .filter((key) => key !== collection)
        .flatMap((key) => (backend[key] ?? []).map((v) => v.id)),
    );
    for (const value of backend[collection] ?? []) {
      const key = contractKey(value);
      if (seen.has(key) || outerIds.has(value.id) || other.has(value.id))
        add("DUPLICATE_ID", [collection, key], `Backend identity ${key} is already used.`);
      seen.add(key);
    }
  }
  const dataset = (e: BackendEntity) => model.datasets?.find((d) => d.id === e.dataset);
  const owner = (e: BackendEntity) => {
    const d = dataset(e);
    return d?.owners.length === 1 && d.owners[0]
      ? contractOwnerElement(design, d.owners[0])
      : undefined;
  };
  const fields = new Map(
    backend.entities.map((e) => [contractKey(e), backendEntityFields(design, e)]),
  );
  const field = (e: BackendEntity, id: string) =>
    fields.get(contractKey(e))?.find((f) => f.id === id);
  const keyFields = (e: BackendEntity) => [
    e.primaryKey,
    ...e.uniqueKeys.map((k) =>
      k.scope === "entity-scope" && e.scope.kind === "field"
        ? [
            e.scope.field,
            ...k.fields.filter((f) => f !== (e.scope.kind === "field" ? e.scope.field : undefined)),
          ]
        : k.fields,
    ),
  ];
  for (const e of backend.entities) {
    const path = ["entities", contractKey(e)];
    const invalid = (suffix: (string | number)[], message: string) =>
      add("CONFIG_INVALID", [...path, ...suffix], `${e.name}: ${message}`);
    const missing = (suffix: (string | number)[], message: string) =>
      add("UNKNOWN_REFERENCE", [...path, ...suffix], `${e.name}: ${message}`);
    const d = dataset(e);
    const c = model.contracts?.find((c) => contractKey(c) === contractKey(e.contract));
    if (!d)
      missing(
        ["dataset"],
        `dataset ${e.dataset} does not exist; update the entity before removal.`,
      );
    if (c?.kind !== "data")
      missing(["contract"], `select an existing exact data contract ${contractKey(e.contract)}.`);
    if (d && contractKey(d.contract) !== contractKey(e.contract))
      invalid(["contract"], "the exact contract must match the authoritative dataset.");
    if (c?.source)
      invalid(
        ["contract"],
        "legacy resource sources retain their existing schema; use the read-only adapter, not an editable entity copy.",
      );
    if (d) {
      if (d.owners.length !== 1 || !owner(e) || d.owners[0]?.kind === "external-system")
        invalid(["dataset"], "a persisted entity needs one application authority in its dataset.");
      if (!d.store)
        invalid(["dataset"], "select the authoritative dataset store before defining persistence.");
      if (d.store) {
        const store = design.elements.find((s) => s.id === d.store);
        if (
          !store ||
          containerClassification(store).kind !== "Data store" ||
          (store.planned !== "relational-store" && store.template?.id !== "postgres")
        )
          invalid(
            ["dataset"],
            "v1 entities require a relational store; a channel/object store is not relational persistence.",
          );
      }
      if (d.tenant === "Tenant scoped" && e.scope.kind !== "field")
        invalid(["scope"], "tenant-scoped authority requires an explicit persisted scope key.");
      if (d.tenant === "Public" && e.scope.kind !== "global")
        invalid(["scope"], "public authority cannot contradict a scoped entity.");
      if (d.tenant === "Unknown")
        add(
          "CONFIG_REQUIRED",
          [...path, "scope"],
          `${e.name}: dataset scope is undecided; resolve it before compilation.`,
        );
    }
    if (
      backend.entities.some(
        (other) =>
          other !== e &&
          other.id !== e.id &&
          (other.dataset === e.dataset ||
            (dataset(other)?.store === d?.store && other.storageId === e.storageId)),
      )
    )
      invalid(
        ["storageId"],
        "another entity already owns this dataset or physical table identity.",
      );
    for (const other of backend.entities.filter((v) => v !== e && v.id === e.id)) {
      if (
        other.storageId !== e.storageId ||
        other.dataset !== e.dataset ||
        e.fields.some((f) =>
          other.fields.some((v) => v.field === f.field && v.storageId !== f.storageId),
        )
      )
        invalid(
          ["storageId"],
          "versions of one stable entity must preserve dataset/table/column identities.",
        );
    }
    const seen = new Set<string>();
    const columns = new Set<string>();
    for (const a of e.fields) {
      const at = ["fields", a.field];
      if (seen.has(a.field)) invalid(at, `field ${a.field} is annotated twice.`);
      seen.add(a.field);
      for (const column of [
        a.storageId,
        ...(a.storage.kind === "money" ? [a.storage.currencyStorageId] : []),
      ]) {
        if (columns.has(column)) invalid(at, `column identity ${column} is repeated.`);
        columns.add(column);
      }
      const f = field(e, a.field);
      if (!c?.shape?.payload.some((f) => f.id === a.field)) {
        missing(at, `field ${a.field} does not exist in the selected exact contract.`);
        continue;
      }
      if (!f) {
        add(
          "CONFIG_REQUIRED",
          [...path, ...at],
          `${e.name}: resolve the logical field type before compilation.`,
        );
        continue;
      }
      if (a.required !== f.required || a.nullable !== !!f.nullable)
        invalid(
          at,
          "required/nullable annotations must agree with the exact logical field; absence and null are distinct.",
        );
      if (f.type === "unresolved") {
        add(
          "CONFIG_REQUIRED",
          [...path, ...at],
          `${e.name}: unresolved storage type cannot compile.`,
        );
        continue;
      }
      if (a.storage.kind === "scalar" && !scalar(f))
        invalid(
          at,
          "scalar storage requires UUID, bounded text/enum, boolean, UTC timestamp or a bounded safe integer.",
        );
      if (a.storage.kind === "json" && !bounded(f))
        invalid(at, "opaque JSON storage requires a fully resolved bounded schema.");
      if (a.storage.kind === "money") {
        const storage = a.storage;
        const amount = f.fields?.find((v) => v.id === storage.minorUnits);
        const currency = f.fields?.find((v) => v.id === storage.currency);
        if (
          f.type !== "object" ||
          f.fields?.length !== 2 ||
          !amount ||
          amount.type !== "integer" ||
          !requiredScalar(amount) ||
          !currency ||
          currency.type !== "text" ||
          !requiredScalar(currency) ||
          !currency.enumValues?.every((v) => /^[A-Z]{3}$/.test(v))
        )
          invalid(
            at,
            "money requires exactly one bounded integer minor-unit field and one required enum of uppercase three-letter currency codes.",
          );
      }
      if (a.serverOwned) {
        if (!requiredScalar(f))
          invalid(at, "server-owned fields must be required nonnullable scalars.");
        if (["id", "principal", "scope"].includes(a.serverOwned) && f.type !== "uuid")
          invalid(at, "server identity fields must be UUIDs.");
        if (a.serverOwned === "clock" && f.type !== "timestamp")
          invalid(at, "a server clock field must be a UTC timestamp.");
        if (a.serverOwned === "version" && (f.type !== "integer" || (f.minimum ?? -1) < 0))
          invalid(at, "a version must be a nonnegative bounded integer.");
        if (a.serverOwned === "id" && !e.primaryKey.includes(a.field))
          invalid(at, "an ID factory must supply a primary-key field.");
        if (a.serverOwned === "scope" && (e.scope.kind !== "field" || e.scope.field !== a.field))
          invalid(at, "server scope must supply the selected scope key.");
      }
    }
    for (const f of c?.shape?.payload ?? [])
      if (!seen.has(f.id))
        missing(
          ["fields", f.id],
          "every persisted payload field needs an explicit storage annotation.",
        );
    const checkFields = (values: string[], at: (string | number)[], required = false) => {
      if (new Set(values).size !== values.length) invalid(at, "field references must be distinct.");
      for (const id of values) {
        const f = field(e, id),
          a = e.fields.find((a) => a.field === id);
        if (!a || !f) missing(at, `selected field ${id} is missing.`);
        else if (a.storage.kind !== "scalar" || !scalar(f) || (required && !requiredScalar(f)))
          invalid(
            at,
            "keys/indexes need scalar fields; primary/scope keys must be required and nonnullable.",
          );
      }
    };
    checkFields(e.primaryKey, ["primaryKey"], true);
    if (e.scope.kind === "field") {
      checkFields([e.scope.field], ["scope"], true);
      if (field(e, e.scope.field)?.type !== "uuid")
        invalid(["scope"], "a scope key must be a UUID.");
      if (
        e.fields.find((a) => e.scope.kind === "field" && a.field === e.scope.field)?.serverOwned !==
        "scope"
      )
        invalid(["scope"], "scope keys must come from trusted server scope.");
    }
    const localIds = new Set<string>();
    for (const item of [...e.relations, ...e.uniqueKeys, ...e.indexes]) {
      if (localIds.has(item.id))
        invalid([item.id], "relation, unique-key and index identities must be locally unique.");
      localIds.add(item.id);
    }
    for (const k of e.uniqueKeys) {
      checkFields(k.fields, ["uniqueKeys", k.id]);
      if (k.scope === "entity-scope" && e.scope.kind === "global")
        invalid(["uniqueKeys", k.id], "a scoped unique key needs an entity scope field.");
      if (k.nulls === "forbidden" && k.fields.some((id) => !requiredScalar(field(e, id))))
        invalid(["uniqueKeys", k.id], "forbidden nulls conflict with nullable or optional fields.");
    }
    for (const index of e.indexes)
      checkFields(
        index.fields.map((f) => f.field),
        ["indexes", index.id],
      );
    for (const r of e.relations) {
      const at = ["relations", r.id];
      const target = backendEntity(design, r.target);
      if (!target) {
        missing(at, `target entity ${contractKey(r.target)} is missing.`);
        continue;
      }
      if (dataset(target)?.store !== d?.store || owner(target) !== owner(e))
        invalid(at, "relations require the same authoritative store and application owner.");
      checkFields(
        r.fields.map((p) => p.source),
        at,
      );
      if (
        !keyFields(target).some((key) =>
          sameFields(
            key,
            r.fields.map((p) => p.target),
          ),
        )
      )
        invalid(
          at,
          "relation target must select a complete primary or unique key in declared order.",
        );
      const dataFields = r.fields.filter(
        (p) => e.scope.kind !== "field" || p.source !== e.scope.field,
      );
      for (const p of r.fields) {
        const source = field(e, p.source),
          dest = field(target, p.target);
        if (!dest) missing(at, `target field ${p.target} does not exist.`);
        else if (source && !compatible(source, dest))
          invalid(at, "relation fields have incompatible logical scalar types or bounds.");
      }
      if (
        r.onDelete === "set-null" &&
        (!dataFields.length ||
          dataFields.some((p) => !field(e, p.source)?.nullable || e.primaryKey.includes(p.source)))
      )
        invalid(
          at,
          "set-null requires nullable non-key relation fields; the trusted scope key is retained.",
        );
      if (r.onDelete === "cascade" && r.ownership !== "owned")
        invalid(at, "cascade deletion requires an explicit owned-child relation.");
      if (r.scope === "global-target") {
        if (target.scope.kind !== "global")
          invalid(at, "global-target must point to a globally scoped entity.");
      } else if (
        e.scope.kind !== target.scope.kind ||
        (e.scope.kind === "field" &&
          target.scope.kind === "field" &&
          !r.fields.some(
            (p) =>
              e.scope.kind === "field" &&
              target.scope.kind === "field" &&
              p.source === e.scope.field &&
              p.target === target.scope.field,
          ))
      )
        invalid(at, "same-scope relations must carry the persisted scope key to the target key.");
      if (
        r.cardinality === "one-to-one" &&
        !keyFields(e).some((key) =>
          sameFields(
            key,
            r.fields.map((p) => p.source),
          ),
        )
      )
        invalid(at, "one-to-one relation needs a unique source key.");
    }
  }
  const used = new Map<string, string>();
  for (const a of backend.aggregates) {
    const path = ["aggregates", contractKey(a)];
    const invalid = (suffix: (string | number)[], message: string) =>
      add("CONFIG_INVALID", [...path, ...suffix], `${a.name}: ${message}`);
    const refs = [a.root, ...a.children];
    const participants = refs.flatMap((r) => {
      const e = backendEntity(design, r);
      if (!e)
        add(
          "UNKNOWN_REFERENCE",
          [...path, "entities", contractKey(r)],
          `Aggregate entity ${contractKey(r)} is missing.`,
        );
      return e ? [e] : [];
    });
    if (new Set(refs.map(contractKey)).size !== refs.length)
      invalid(["children"], "root and children must be distinct.");
    const app = contractOwnerElement(design, a.owner);
    const application = design.elements.find((e) => e.id === app);
    if (!application || containerClassification(application).kind !== "Application")
      invalid(["owner"], "select one existing application or its component as aggregate owner.");
    for (const e of participants) {
      if (dataset(e)?.store !== a.store || owner(e) !== app)
        invalid(
          ["entities", contractKey(e)],
          "an atomic aggregate requires one store and one authoritative application; cross-store atomicity is unsupported.",
        );
      const key = contractKey(e),
        previous = used.get(key);
      if (previous && previous !== a.id)
        invalid(
          ["entities", key],
          "an entity cannot belong to multiple aggregate owners/boundaries.",
        );
      used.set(key, a.id);
    }
    const root = backendEntity(design, a.root);
    for (const child of participants.filter((e) => contractKey(e) !== contractKey(a.root))) {
      if (
        root &&
        (child.scope.kind !== root.scope.kind || dataset(child)?.tenant !== dataset(root)?.tenant)
      )
        invalid(
          ["children", contractKey(child)],
          "aggregate children must share the root's scope semantics.",
        );
      const reachable = new Set([contractKey(a.root)]);
      for (let n = 0; n < participants.length; n++)
        for (const e of participants)
          if (
            e.relations.some((r) => r.ownership === "owned" && reachable.has(contractKey(r.target)))
          )
            reachable.add(contractKey(e));
      if (!reachable.has(contractKey(child)))
        invalid(
          ["children", contractKey(child)],
          "a child needs an explicit owned relation path to the aggregate root.",
        );
    }
    const resolveField = (ref: { entity: BackendReference; field: string }, at: string) => {
      const e = backendEntity(design, ref.entity);
      if (!e || !refs.some((r) => contractKey(r) === contractKey(ref.entity))) {
        add(
          "UNKNOWN_REFERENCE",
          [...path, at],
          "Field reference must select an exact aggregate participant.",
        );
        return undefined;
      }
      const f = field(e, ref.field);
      if (!f) add("UNKNOWN_REFERENCE", [...path, at], `Aggregate field ${ref.field} is missing.`);
      return f;
    };
    if (a.concurrency.kind === "optimistic") {
      const ref = a.concurrency.version,
        f = resolveField(ref, "concurrency");
      if (
        contractKey(ref.entity) !== contractKey(a.root) ||
        !f ||
        !requiredScalar(f) ||
        f.type !== "integer" ||
        (f.minimum ?? -1) < 0 ||
        root?.fields.find((a) => a.field === ref.field)?.serverOwned !== "version"
      )
        invalid(
          ["concurrency"],
          "optimistic concurrency needs a server-owned nonnegative integer revision on the root; commands must require expectedVersion.",
        );
    } else {
      const rows = a.concurrency.entities.map(contractKey);
      if (
        new Set(rows).size !== rows.length ||
        !sameFields([...rows].sort(), rows) ||
        !sameFields([...refs.map(contractKey)].sort(), rows)
      )
        invalid(
          ["concurrency"],
          "row locks must name every participant once in stable entity-ID/primary-key order.",
        );
    }
    const seen = new Set<string>();
    for (const invariant of a.invariants) {
      const at = ["invariants", invariant.id];
      if (seen.has(invariant.id)) invalid(at, "invariant identities must be unique.");
      seen.add(invariant.id);
      if (invariant.strategy === "required-child") {
        const child = backendEntity(design, invariant.child);
        if (
          !a.children.some((r) => contractKey(r) === contractKey(invariant.child)) ||
          !child?.relations.some(
            (r) =>
              r.id === invariant.relation &&
              r.ownership === "owned" &&
              contractKey(r.target) === contractKey(a.root),
          )
        )
          invalid(at, "required-child must select an owned direct child/root relation.");
        if (invariant.minimum > invariant.maximum)
          invalid(at, "required child count bounds are reversed.");
      } else if (invariant.strategy === "nonnegative") {
        const f = resolveField(invariant.value, invariant.id);
        if (f && (!requiredScalar(f) || f.type !== "integer"))
          invalid(at, "nonnegative invariants require a required bounded integer.");
      } else if (invariant.strategy === "field-comparison") {
        const left = resolveField(invariant.left, invariant.id),
          right = resolveField(invariant.right, invariant.id);
        if (
          left &&
          right &&
          (!requiredScalar(left) ||
            !requiredScalar(right) ||
            !compatible(left, right) ||
            (invariant.operator !== "eq" && !["integer", "timestamp"].includes(left.type)))
        )
          invalid(
            at,
            "comparison needs compatible required scalars; ordering supports integer/timestamp only.",
          );
      } else {
        const stock = resolveField(invariant.stock, invariant.id),
          reserved = resolveField(invariant.reserved, invariant.id);
        const reservation = backendEntity(design, invariant.reserved.entity);
        if (
          [stock, reserved].some(
            (f) => f && (!requiredScalar(f) || f.type !== "integer" || (f.minimum ?? -1) < 0),
          ) ||
          !reservation?.relations.some(
            (r) =>
              r.id === invariant.relation &&
              r.ownership === "owned" &&
              contractKey(r.target) === contractKey(invariant.stock.entity),
          ) ||
          contractKey(invariant.stock.entity) !== contractKey(a.root) ||
          !a.children.some((r) => contractKey(r) === contractKey(invariant.reserved.entity))
        )
          invalid(
            at,
            "inventory balance requires bounded nonnegative stock/root and reserved/child quantities linked by the owned relation.",
          );
      }
    }
  }
  result.push(...validateBackendQueries(design));
  if (backend.entities.length || backend.aggregates.length || backend.queries?.length)
    result.push(
      finding(
        "NEEDS_TEMPLATE",
        "Backend persistence, queries, concurrency and invariant strategies are design declarations; no compiler/runtime implementation is selected.",
        { path: ["architecture", "backend"] },
      ),
    );
  return result;
}

/** Removal preview uses the same source-addressed checks as atomic editing. */
export const backendDataRemovalFindings = validateBackendData;

/** Prevent accidental physical renames under a stable identity; labels remain editable. */
export function validateBackendDataTransition(
  before: DesignDocument,
  after: DesignDocument,
): Finding[] {
  const result: Finding[] = [];
  for (const e of before.architecture?.backend?.entities ?? []) {
    const replacements = after.architecture?.backend?.entities.filter((v) => v.id === e.id) ?? [];
    for (const next of replacements) {
      const invalid = (message: string) =>
        result.push(
          finding("CONFIG_INVALID", message, {
            path: ["architecture", "backend", "entities", contractKey(e), "storageId"],
          }),
        );
      if (e.storageId !== next.storageId || e.dataset !== next.dataset)
        invalid(
          "Stable entity storage/dataset identities cannot be retargeted; define a separate entity and explicit migration outside this design package.",
        );
      for (const f of e.fields) {
        const target = next.fields.find((v) => v.field === f.field);
        if (
          target &&
          (f.storageId !== target.storageId ||
            (f.storage.kind === "money" &&
              target.storage.kind === "money" &&
              f.storage.currencyStorageId !== target.storage.currencyStorageId))
        )
          invalid(`Stable field ${f.field} storage identity cannot change through a rename.`);
      }
    }
  }
  return result;
}
