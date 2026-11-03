/** Exact finite grant joins; design validation only, never an authorization evaluator. */
import { contractCanonical, contractKey, contractOwnerElement } from "./architecture-contracts.ts";
import { backendEntity, backendEntityFields } from "./backend-entity.ts";
import type { BackendEntity } from "./backend-model.ts";
import type { BackendAccessPolicy } from "./backend-policy-model.ts";
import type { DesignDocument } from "./design.ts";

type Grant = Extract<BackendAccessPolicy["clauses"][number], { kind: "group-grant" }>;
export function inspectGroupGrant(
  design: DesignDocument,
  policy: BackendAccessPolicy,
  clause: Grant,
): string[] {
  const issues: string[] = [];
  const fail = (text: string) => issues.push(text);
  const resource = backendEntity(design, policy.resource);
  const authority = (entity: BackendEntity) => {
    const dataset = design.architecture?.datasets?.find((d) => d.id === entity.dataset);
    return [dataset?.store, dataset?.owners[0] && contractOwnerElement(design, dataset.owners[0])];
  };
  const check = (entity: BackendEntity | undefined) => {
    if (!entity) {
      fail("select an existing exact grant/membership/path entity.");
      return;
    }
    if (
      entity.scope.kind !== "field" ||
      !resource ||
      contractCanonical(authority(entity)) !== contractCanonical(authority(resource))
    )
      fail(
        "grant, group, memberships and parent path must share the scoped resource application and relational store.",
      );
  };
  const field = (entity: BackendEntity | undefined, id: string, kind?: string) => {
    const f = entity && backendEntityFields(design, entity).find((f) => f.id === id);
    if (
      !f ||
      !f.required ||
      f.nullable ||
      entity?.fields.find((f) => f.field === id)?.storage.kind !== "scalar" ||
      (kind && f.type !== kind)
    )
      fail(
        `grant field ${id} must select a required nonnullable persisted scalar${kind ? ` ${kind}` : ""}.`,
      );
    return f;
  };
  const value = (
    entity: BackendEntity | undefined,
    test: { field: string; value: string | boolean },
  ) => {
    const f = field(entity, test.field);
    if (
      f &&
      (typeof test.value === "boolean"
        ? f.type !== "boolean"
        : f.type !== "text" || !f.enumValues?.includes(test.value))
    )
      fail(`grant field ${test.field} must match its declared boolean or enum value.`);
  };
  const relation = (entity: BackendEntity | undefined, id: string) => {
    const r = entity?.relations.find((r) => r.id === id);
    if (!r) {
      fail(`grant relation ${id} does not exist.`);
      return;
    }
    const target = backendEntity(design, r.target);
    check(target);
    if (r.scope !== "same-scope" || r.fields.some((k) => !field(entity, k.source)))
      fail("grant paths require nonnullable same-scope forward to-one relations.");
    return target;
  };
  check(resource);
  if (policy.context.scope !== "authorized-scope")
    fail("group grants require current authorized workspace scope.");
  if (clause.subject.kind === "session-principal") {
    if (policy.context.identity !== "session-principal")
      fail("a service cannot borrow the initiating session principal for a grant.");
  } else field(resource, clause.subject.field, "uuid");
  let category = resource;
  const seen = new Set(resource ? [contractKey(resource)] : []);
  for (const path of clause.resourcePath) {
    category = relation(category, path);
    if (category && seen.has(contractKey(category)))
      fail("grant resource paths cannot repeat an entity or form a cycle.");
    if (category) seen.add(contractKey(category));
  }
  const grant = backendEntity(design, clause.grant.entity),
    member = backendEntity(design, clause.membership.entity),
    workspace = backendEntity(design, clause.workspaceMembership.entity);
  check(grant);
  check(member);
  check(workspace);
  const grantResource = relation(grant, clause.grant.resourceRelation);
  if (category && grantResource && contractKey(category) !== contractKey(grantResource))
    fail("grant resource relation must target the exact final protected parent.");
  const grantGroup = relation(grant, clause.grant.groupRelation),
    memberGroup = relation(member, clause.membership.groupRelation);
  if (grantGroup && memberGroup && contractKey(grantGroup) !== contractKey(memberGroup))
    fail("grant and active membership must target the same exact group.");
  field(member, clause.membership.principal, "uuid");
  value(member, clause.membership.active);
  field(workspace, clause.workspaceMembership.principal, "uuid");
  value(workspace, clause.workspaceMembership.active);
  const access = field(grant, clause.grant.access.field, "text");
  if (
    !access?.enumValues ||
    clause.grant.access.values.some((v) => !access.enumValues?.includes(v)) ||
    new Set(clause.grant.access.values).size !== clause.grant.access.values.length
  )
    fail("grant access values must be distinct choices from its exact persisted enum.");
  if (clause.public) value(category, clause.public);
  return issues;
}
