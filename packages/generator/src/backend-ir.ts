/** Pure versioned compiler data. These are responsibilities, never rendered runtime files. */
import type {
  BackendAccessBinding,
  BackendAccessPolicy,
  BackendAggregate,
  BackendEffect,
  BackendEntity,
  BackendHook,
  BackendImplementation,
  BackendImplementationReport,
  BackendOperation,
  BackendQuery,
  BackendReference,
  ContractValue,
  DesignDocument,
  Finding,
  ImplementationObligation,
} from "@jeeves/spec";

export type BackendReadonly<T> = T extends object
  ? { readonly [K in keyof T]: BackendReadonly<T[K]> }
  : T;

/** Paths select stable collection IDs/exact versions, never display-order array offsets. */
export interface BackendSource {
  kind:
    | ImplementationObligation["kind"]
    | "field"
    | "relation"
    | "constraint"
    | "query-part"
    | "policy-part";
  id: string;
  version?: string;
  path: (string | number)[];
}
export interface BackendResponsibility {
  /** Injective, version-aware compiler identity. */
  id: string;
  /** Symbol derived from stable IDs; presentation names are retained only in the snapshot. */
  name: string;
  source: BackendSource;
}
export interface BackendSourceMapEntry {
  output: string;
  source: BackendSource;
}
export interface BackendDiagnostic {
  code: string;
  message: string;
  source: BackendSource;
}
export interface BackendEntityLink {
  reference: BackendReference;
  entity?: string;
}
export interface BackendPolicyLink {
  selection: BackendQuery["accessPolicy"];
  policy?: string;
  projection?: string;
}
/** Resolved logical type with local field identities, without presentation metadata. */
export type BackendLogicalValue = Omit<
  ContractValue,
  "fields" | "items" | "values" | "variants"
> & {
  fields?: { id: string; required: boolean; value: BackendLogicalValue }[];
  items?: BackendLogicalValue;
  values?: BackendLogicalValue;
  variants?: BackendLogicalValue[];
};
export interface BackendHostIR extends BackendResponsibility {
  element: string;
  role?: string;
  planned?: string;
  template?: BackendReference;
  implementation?: BackendReference;
  configuration: DesignDocument["elements"][number]["config"];
}
export interface BackendFieldIR extends BackendResponsibility {
  field: string;
  storageId: string;
  storage: BackendEntity["fields"][number]["storage"];
  required: boolean;
  nullable: boolean;
  serverOwned?: BackendEntity["fields"][number]["serverOwned"];
  value?: BackendLogicalValue;
}
export interface BackendEntityIR extends BackendResponsibility {
  reference: BackendReference;
  dataset: string;
  contract: BackendReference;
  owner?: { kind: "element" | "component" | "external-system"; id: string };
  host?: string;
  store?: string;
  storageId: string;
  fields: BackendFieldIR[];
  primaryKey: string[];
  scope: BackendEntity["scope"];
  relations: (BackendResponsibility &
    Omit<BackendEntity["relations"][number], "id" | "target"> & {
      relation: string;
      target: BackendEntityLink;
    })[];
  uniqueKeys: (BackendResponsibility & Omit<BackendEntity["uniqueKeys"][number], "id">)[];
  indexes: (BackendResponsibility & Omit<BackendEntity["indexes"][number], "id">)[];
}
export interface BackendAggregateIR extends BackendResponsibility {
  reference: BackendReference;
  owner: BackendAggregate["owner"];
  host?: string;
  store?: string;
  root: BackendEntityLink;
  children: BackendEntityLink[];
  concurrency: BackendAggregate["concurrency"];
  invariants: BackendAggregate["invariants"];
}
export interface BackendQueryIR extends BackendResponsibility {
  reference: BackendReference;
  host?: string;
  store?: string;
  root: BackendEntityLink;
  sources: (BackendResponsibility & {
    alias: string;
    target?: BackendEntityLink;
    nullable?: boolean;
    join?: BackendQuery["joins"][number];
    access: BackendPolicyLink;
  })[];
  filters: (BackendResponsibility &
    Omit<BackendQuery["filters"][number], "id"> & { filter: string })[];
  projection: (BackendResponsibility &
    Omit<BackendQuery["projection"][number], "id"> & { output: string })[];
  /** Order and cursor tuples are semantic order; never alphabetically sorted. */
  order: BackendQuery["order"];
  limit: BackendQuery["limit"];
  cursor: BackendQuery["cursor"];
  freshness: BackendQuery["freshness"];
  accessSite: NonNullable<BackendQuery["accessSite"]>;
  accessBefore: ("filter" | "pagination" | "count" | "projection")[];
}
export interface BackendPolicyIR extends BackendResponsibility {
  reference: BackendReference;
  resource: BackendEntityLink;
  host?: string;
  store?: string;
  context: BackendAccessPolicy["context"];
  default: "deny";
  conflict: "deny-wins";
  clauses: (BackendResponsibility & {
    clause: BackendAccessPolicy["clauses"][number];
    entity?: string;
  })[];
  rules: (BackendResponsibility & { rule: BackendAccessPolicy["rules"][number] })[];
  projections: (BackendResponsibility & {
    projection: BackendAccessPolicy["projections"][number];
  })[];
  revocation: BackendAccessPolicy["revocation"];
}
export interface BackendAccessBindingIR extends BackendResponsibility {
  reference: BackendReference;
  resource: BackendEntityLink;
  access: BackendPolicyLink;
  intent: Omit<BackendAccessBinding, "id" | "version" | "name" | "resource" | "policy">;
}

/** P70b populates these behavior/dependency shapes and supplies modes/complete readiness. */
export interface BackendOperationAdapterIR extends BackendResponsibility {
  reference: BackendReference;
  host?: string;
  aggregate?: string;
  policy: BackendPolicyLink;
  transaction: string;
  intent: Omit<BackendOperation, "id" | "version" | "name">;
}
export interface BackendTransactionIR extends BackendResponsibility {
  operation: string;
  host?: string;
  store?: string;
  participants: BackendEntityLink[];
  intent: BackendOperation["transaction"];
}
export interface BackendEffectIR extends BackendResponsibility {
  reference: BackendReference;
  operation?: string;
  predecessors: string[];
  intent: Omit<BackendEffect, "id" | "version" | "name">;
}
export interface BackendRuntimeDependencyIR extends BackendResponsibility {
  implementation: BackendReference;
  host?: string;
  template: BackendReference;
  capability: BackendReference;
  dependencies: string[];
  environment?: BackendImplementation["environment"];
  /** Expected checks, never passed verification evidence. */
  evidencePackIds: string[];
}
export interface BackendHookObligationIR extends BackendResponsibility {
  reference: BackendReference;
  host?: string;
  operation?: string;
  intent: Omit<BackendHook, "id" | "version" | "name">;
}
export interface BackendDataIR {
  schemaVersion: 1;
  hosts: BackendHostIR[];
  entities: BackendEntityIR[];
  aggregates: BackendAggregateIR[];
  queries: BackendQueryIR[];
  policies: BackendPolicyIR[];
  accessBindings: BackendAccessBindingIR[];
}
export interface BackendIR extends BackendDataIR {
  operationAdapters: BackendOperationAdapterIR[];
  transactions: BackendTransactionIR[];
  effects: BackendEffectIR[];
  runtimeDependencies: BackendRuntimeDependencyIR[];
  hookObligations: BackendHookObligationIR[];
}
export type BackendDataPlan = BackendReadonly<{
  schemaVersion: 1;
  stage: "data";
  enabled: boolean;
  /** Exact authored input, including planned identities, ordering, labels and configuration. */
  sourceSnapshot: DesignDocument;
  ir?: BackendDataIR;
  sourceMap: BackendSourceMapEntry[];
  diagnostics: BackendDiagnostic[];
  /** Kept verbatim; no blanket NEEDS_TEMPLATE suppression or readiness claims. */
  rawFindings: Finding[];
  support: BackendImplementationReport;
}>;
