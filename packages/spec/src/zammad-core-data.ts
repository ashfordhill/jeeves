/** Zammad authoritative data. Contracts own types; no SQL/session/runtime is supplied. */

import type { Architecture } from "./architecture.ts";
import type { ContractField, ContractValue } from "./architecture-contracts.ts";
import { type BackendEntity, type BackendModel, backendModelSchema } from "./backend-model.ts";
import { zammadCoreContracts } from "./zammad-core-contracts.ts";
export const zcRef = (id: string, version = "v1") => ({ id, version });
export const zcEntity = (id: string) => zcRef(`zc-${id}-entity`);
const uuid: ContractValue = { type: "uuid" };
const timestamp: ContractValue = { type: "timestamp" };
const text = (maxLength = 200): ContractValue => ({ type: "text", minLength: 1, maxLength });
const integer = (maximum = 9007199254740991, minimum = 0): ContractValue => ({
  type: "integer",
  minimum,
  maximum,
});
const enumeration = (...enumValues: string[]): ContractValue => ({ type: "text", enumValues });
const boolean: ContractValue = { type: "boolean" };
export const zcField = (name: string, value: ContractValue): ContractField => ({
  id: name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
  name,
  required: true,
  description: "",
  ...value,
});
export const zcRelation = (
  id: string,
  target: string,
  source: string,
  owned = false,
): BackendEntity["relations"][number] => ({
  id,
  target: zcEntity(target),
  fields:
    target === "scope"
      ? [{ source: "scope-id", target: "scope-id" }]
      : [
          { source: "scope-id", target: "scope-id" },
          { source, target: "id" },
        ],
  cardinality: "many-to-one",
  ownership: owned ? "owned" : "reference",
  scope: "same-scope",
  onDelete: "restrict",
});
export function zammadCoreData(model: Architecture): BackendModel {
  const backend = backendModelSchema.parse({
    schemaVersion: 1,
    entities: [],
    aggregates: [],
    queries: [],
    accessPolicies: [],
    accessBindings: [],
  });
  const add = (
    id: string,
    name: string,
    component: string,
    values: Record<string, ContractValue>,
    relations: BackendEntity["relations"] = [],
    unique: string[][] = [],
    meaning = "",
  ): BackendEntity => {
    const payload = Object.entries({
      id: uuid,
      scopeId: uuid,
      version: integer(9007199254740991, 1),
      createdAt: timestamp,
      ...values,
    }).map(([name, value]) => zcField(name, value));
    const contract = zcRef(`zc-${id}-data`),
      dataset = `zc-${id}-dataset`;
    model.contracts!.push({
      ...contract,
      name: `${name} records`,
      kind: "data",
      coverage: "Complete",
      description: `Authoritative scope-scoped state owned by the Help-desk API. Principal IDs reference the existing session owner; no competing account/session table. ${meaning}`,
      shape: { operations: [], payload },
    });
    model.datasets!.push({
      id: dataset,
      name,
      contract,
      owners: [{ kind: "element", id: "zc-api" }],
      ownershipDecision: `Help-desk API is the sole application authority. Worker executes explicitly granted modules against the same PostgreSQL store; bytes/providers are outside SQL. ${meaning}`,
      store: "zc-db",
      readers: [
        { kind: "component", id: `zc-${component}` },
        { kind: "element", id: "zc-worker" },
      ],
      writers: [{ kind: "component", id: `zc-${component}` }],
      tenant: "Tenant scoped",
      deletion: "Retain",
      exportAccess: ["audit", "assignment", "routing-rule", "calendar", "sla"].includes(id)
        ? "Authorized staff"
        : "Owner",
    });
    const e: BackendEntity = {
      id: `zc-${id}-entity`,
      version: "v1",
      name,
      dataset,
      contract,
      storageId: `zc-${id}-table`,
      fields: payload.map((f) => ({
        field: f.id,
        storageId: `${f.id}-column`,
        required: true,
        nullable: !!f.nullable,
        storage:
          f.type === "object" && f.fields?.length === 2 && f.fields.some((x) => x.id === "minor")
            ? {
                kind: "money",
                minorUnits: "minor",
                currency: "currency",
                currencyStorageId: `${f.id}-currency-column`,
              }
            : f.type === "object" || f.type === "array"
              ? { kind: "json", query: "opaque" }
              : { kind: "scalar" },
        ...(["id", "scope-id", "version", "created-at"].includes(f.id)
          ? {
              serverOwned: (
                {
                  id: "id",
                  "scope-id": "scope",
                  version: "version",
                  "created-at": "clock",
                } as const
              )[f.id as "id" | "scope-id" | "version" | "created-at"],
            }
          : ["owner-id", "author-id"].includes(f.id)
            ? { serverOwned: "principal" as const }
            : {}),
      })),
      primaryKey: ["id"],
      scope: { kind: "field", field: "scope-id" },
      relations,
      uniqueKeys: [
        { id: "scoped-id", fields: ["id"], scope: "entity-scope", nulls: "forbidden" },
        ...unique.map((fields, i) => ({
          id: `unique-${i + 1}`,
          fields,
          scope: "entity-scope" as const,
          nulls: "forbidden" as const,
        })),
      ],
      indexes: [
        {
          id: "created-order",
          fields: [
            { field: "created-at", direction: "asc" },
            { field: "id", direction: "asc" },
          ],
        },
      ],
    };
    if (id !== "scope") e.relations.push(zcRelation("scope", "scope", "scope-id"));
    else {
      e.primaryKey = ["scope-id"];
      delete e.fields.find((f) => f.field === "id")!.serverOwned;
    }
    backend.entities.push(e);
    return e;
  };
  const wire = (operation: string, field?: string): Record<string, ContractValue> => {
    const op = zammadCoreContracts
      .flatMap((c) => c.shape!.operations)
      .find((o) => o.id === operation)!;
    const payload = field
      ? op.output.find((f) => f.id === field)!.fields!
      : op.output.filter((f) => !f.id.startsWith("header-"));
    return Object.fromEntries(
      payload.map((f) => {
        const { id: _id, name, required: _required, description: _description, ...value } = f;
        return [name, structuredClone(value)];
      }),
    );
  };
  add("scope", "Application scope", "access", { name: text(), active: boolean });
  add(
    "scope-member",
    "Current application membership",
    "access",
    {
      principalId: uuid,
      active: boolean,
      role: enumeration("customer", "agent", "supervisor", "administrator"),
    },
    [],
    [["principal-id"]],
    "Existing durable session principal is external authority; this is application membership, never a second account/session table.",
  );
  add(
    "organization",
    "Organization sharing policy",
    "organizations",
    { name: text(), shareTickets: boolean },
    [],
    [],
    "Organization is distinct from application scope and support group. shareTickets false means own tickets only; true is a deliberate current organization policy.",
  );
  add(
    "group",
    "Support group",
    "organizations",
    { name: text(), ingress: boolean },
    [],
    [],
    "Customer ingress is explicitly configured; it grants no agent authority.",
  );
  add(
    "agent-member",
    "Agent group capability",
    "organizations",
    {
      principalId: uuid,
      groupId: uuid,
      active: boolean,
      capability: enumeration("read", "write", "supervise"),
    },
    [zcRelation("group", "group", "group-id")],
    [["principal-id", "group-id"]],
    "Capability is selected on this same active membership row; a role or capability from another group grants nothing.",
  );
  add(
    "customer-member",
    "Customer organization membership",
    "organizations",
    { principalId: uuid, organizationId: uuid, active: boolean },
    [zcRelation("organization", "organization", "organization-id")],
    [["principal-id", "organization-id"]],
  );
  add(
    "ticket",
    "Ticket",
    "tickets",
    wire("create-ticket", "ticket"),
    [
      zcRelation("organization", "organization", "organization-id"),
      zcRelation("group", "group", "group-id"),
    ],
    [],
    "Customer is server-established. Assignee is nullable. Current source/target group capability and eligible assignee must be rechecked under CAS by P73b.",
  );
  add(
    "article",
    "Immutable conversation article",
    "articles",
    wire("create-ticket", "article"),
    [zcRelation("ticket", "ticket", "ticket-id", true)],
    [],
    "Author, author kind, visibility and time are immutable server facts. Customer can create only public. Internal IDs/text/file references are absent, not placeholders, from every customer path.",
  );
  add(
    "assignment",
    "Assignment history",
    "assignment",
    {
      ticketId: uuid,
      groupId: uuid,
      assigneeId: { ...uuid, nullable: true },
      actorId: uuid,
      ticketVersion: integer(9007199254740991, 1),
      at: timestamp,
    },
    [zcRelation("ticket", "ticket", "ticket-id", true), zcRelation("group", "group", "group-id")],
    [["ticket-id", "ticket-version"]],
    "Append-only assignment facts; active assignment remains on ticket, never a second mutable authority.",
  );
  add(
    "calendar",
    "Immutable calendar version",
    "calendars",
    wire("put-calendar"),
    [],
    [],
    "Append-only exact id/version. Half-open Chicago wall intervals and dated holidays; actual UTC elapsed time. Repeated fall hour counts twice, missing spring hour contributes zero. P73b binds calculator settings; no runtime is supplied.",
  );
  add(
    "sla",
    "Immutable first-response policy version",
    "sla",
    wire("put-sla-policy"),
    [zcRelation("calendar", "calendar", "calendar-id")],
    [],
    "Append-only policy version pins exact calendar version and positive business minutes. Existing deadlines never follow a latest version pointer.",
  );
  add(
    "deadline",
    "First-response snapshot",
    "sla",
    wire("create-ticket", "deadline"),
    [
      zcRelation("ticket", "ticket", "ticket-id", true),
      zcRelation("calendar", "calendar", "calendar-id"),
      zcRelation("sla", "sla", "sla-policy-id"),
    ],
    [["ticket-id", "generation"]],
    "Immutable selected calendar/SLA versions/start/due; mutable clock status/version and separate satisfied/cancelled instants. State may remain escalated with a later satisfiedAt; closing never pretends satisfaction. P73b owns all clock commands.",
  );
  add(
    "escalation",
    "Logical escalation fact",
    "sla",
    {
      ticketId: uuid,
      deadlineId: uuid,
      generation: integer(9007199254740991, 1),
      deadlineVersion: integer(9007199254740991, 1),
      ticketVersion: integer(9007199254740991, 1),
      at: timestamp,
    },
    [
      zcRelation("ticket", "ticket", "ticket-id", true),
      zcRelation("deadline", "deadline", "deadline-id"),
    ],
    [["deadline-id", "generation"]],
    "One logical escalation identity per original schedule generation. P73b must bind fencing/current versions/cancellation and bounded recovery.",
  );
  add(
    "routing-rule",
    "Immutable routing rule version",
    "routing",
    wire("put-routing-rule"),
    [],
    [],
    "Append-only priority/UUID-ordered finite conditions and tagged actions: max10 conditions/max5 actions, first/all mode, once per originating event. No scripts, grants or recursive re-emission.",
  );
  add(
    "routing-receipt",
    "Routing event rule receipt",
    "routing",
    { ticketId: uuid, eventId: text(), ruleId: uuid, ruleVersion: integer(9007199254740991, 1) },
    [
      zcRelation("ticket", "ticket", "ticket-id", true),
      zcRelation("rule", "routing-rule", "rule-id"),
    ],
    [["ticket-id", "event-id", "rule-id", "rule-version"]],
  );
  add(
    "file",
    "Staged file identity",
    "attachments",
    { ...wire("get-file"), objectKey: text(), validatedAt: { ...timestamp, nullable: true } },
    [],
    [],
    "Bytes outside SQL, max10MiB, text/plain or image/png; original hash/size and state are authoritative. A staged uploader owns upload only; upload ownership never grants attached-byte access. P73b binds live association-safe orphan cleanup.",
  );
  add(
    "attachment",
    "Live article file association",
    "attachments",
    { ticketId: uuid, articleId: uuid, fileId: uuid },
    [
      zcRelation("ticket", "ticket", "ticket-id", true),
      zcRelation("article", "article", "article-id"),
      zcRelation("file", "file", "file-id"),
    ],
    [["file-id"]],
    "Only a validated live link grants metadata/bytes. Current ticket and immutable article visibility are checked before every read, export or replay; file IDs/old URLs grant nothing.",
  );
  add(
    "search-projection",
    "Article search identity",
    "search",
    { ticketId: uuid, articleId: uuid, projectionVersion: integer(9007199254740991, 1) },
    [zcRelation("ticket", "ticket", "ticket-id"), zcRelation("article", "article", "article-id")],
    [["article-id"]],
    "No duplicated title/body/visibility/group permission. Join authoritative ticket/article and filter current access before matching, snippets, keyset page or cursor. No hidden total.",
  );
  add(
    "preference",
    "Notification preferences",
    "notification-api",
    {
      principalId: uuid,
      channels: { type: "array", maxItems: 2, items: enumeration("inbox", "email") },
    },
    [],
    [["principal-id"]],
  );
  add(
    "notification",
    "Notification identity",
    "notification-api",
    { ticketId: uuid, articleId: uuid, recipientId: uuid, eventId: uuid, at: timestamp },
    [zcRelation("ticket", "ticket", "ticket-id"), zcRelation("article", "article", "article-id")],
    [["event-id", "recipient-id"]],
    "No copied private excerpt or attachment list. Reassemble current authorized article at read/materialization/send; initiating actor is provenance only. P73b binds delivery/service authorization and receipts.",
  );
  add(
    "audit",
    "Safe ticket audit",
    "audit",
    {
      ticketId: uuid,
      actorId: uuid,
      action: text(),
      at: timestamp,
      visibility: enumeration("public", "internal"),
    },
    [zcRelation("ticket", "ticket", "ticket-id", true)],
    [],
    "Append-only safe metadata. No internal article ID/text/file references. Internal events disappear entirely from customer audit/export; current ticket policy still applies.",
  );
  const entity = (id: string) => backend.entities.find((e) => e.id === zcEntity(id).id)!;
  // Article identity is tied to the same exact ticket, preventing sibling-parent substitution.
  entity("article").uniqueKeys.push({
    id: "ticket-article",
    fields: ["ticket-id", "id"],
    scope: "entity-scope",
    nulls: "forbidden",
  });
  for (const e of backend.entities) {
    const relation = e.relations.find((r) => r.id === "article");
    if (relation) relation.fields.push({ source: "ticket-id", target: "ticket-id" });
  }
  for (const id of ["calendar", "sla", "routing-rule"]) {
    const e = entity(id);
    e.primaryKey = ["id", "version"];
    e.uniqueKeys = e.uniqueKeys.filter((k) => k.id !== "scoped-id");
    e.uniqueKeys.push({
      id: "exact-version",
      fields: ["id", "version"],
      scope: "entity-scope",
      nulls: "forbidden",
    });
  }
  for (const [id, rel, version] of [
    ["sla", "calendar", "calendar-version"],
    ["deadline", "calendar", "calendar-version"],
    ["deadline", "sla", "sla-version"],
    ["routing-receipt", "rule", "rule-version"],
  ])
    entity(id!)
      .relations.find((r) => r.id === rel)!
      .fields.push({ source: version!, target: "version" });
  for (const e of backend.entities)
    backend.aggregates.push({
      id: e.id.replace("-entity", "-aggregate"),
      version: "v1",
      name: e.name,
      root: zcRef(e.id),
      children:
        e.id === "zc-ticket-entity"
          ? [zcEntity("article"), zcEntity("deadline"), zcEntity("audit"), zcEntity("assignment")]
          : [],
      owner: { kind: "element", id: "zc-api" },
      store: "zc-db",
      concurrency: { kind: "optimistic", version: { entity: zcRef(e.id), field: "version" } },
      invariants:
        e.id === "zc-ticket-entity"
          ? [
              {
                id: "initial-conversation",
                strategy: "required-child",
                child: zcEntity("article"),
                relation: "ticket",
                minimum: 1,
                maximum: 1000,
              },
            ]
          : [],
    });
  return backend;
}
