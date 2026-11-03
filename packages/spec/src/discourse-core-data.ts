/** Discourse-core authority and bounded reads. No SQL/session tables or runtime are generated. */
import type { Architecture } from "./architecture.ts";
import type { ContractField, ContractValue } from "./architecture-contracts.ts";
import { type BackendEntity, type BackendModel, backendModelSchema } from "./backend-model.ts";
export const dcRef = (id: string) => ({ id, version: "v1" });
const uuid: ContractValue = { type: "uuid" };
const text = (maxLength: number): ContractValue => ({ type: "text", minLength: 1, maxLength });
const enumeration = (...enumValues: string[]): ContractValue => ({ type: "text", enumValues });
const integer = (maximum = 1000000, minimum = 0): ContractValue => ({
  type: "integer",
  minimum,
  maximum,
});
const field = (name: string, value: ContractValue): ContractField => ({
  id: name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
  name,
  required: true,
  description: "",
  ...value,
});
const columns = (values: Record<string, ContractValue>) =>
  Object.entries(values).map(([name, value]) => field(name, value));
const ref = (id: string) => dcRef(`dc-${id}-entity`);
export function discourseCoreData(model: Architecture): BackendModel {
  const backend = backendModelSchema.parse({
    schemaVersion: 1,
    entities: [],
    aggregates: [],
    queries: [],
    accessPolicies: [],
    accessBindings: [],
  });
  const relation = (
    name: string,
    target: string,
    source: string,
    owned = false,
  ): BackendEntity["relations"][number] => ({
    id: name,
    target: ref(target),
    fields: [
      { source: "scope-id", target: "scope-id" },
      { source, target: "id" },
    ],
    cardinality: "many-to-one",
    ownership: owned ? "owned" : "reference",
    scope: "same-scope",
    onDelete: "restrict",
  });
  const add = (
    id: string,
    name: string,
    component: string,
    values: Record<string, ContractValue>,
    relations: BackendEntity["relations"] = [],
    unique: string[][] = [],
  ) => {
    const payload = columns({
      id: uuid,
      scopeId: uuid,
      version: integer(2147483647, 1),
      createdAt: { type: "timestamp" },
      ...values,
    });
    const cid = `dc-${id}-data`,
      dataset = `dc-${id}-dataset`;
    model.contracts!.push({
      id: cid,
      version: "v1",
      name: `${name} records`,
      kind: "data",
      coverage: "Complete",
      description:
        "Logical authoritative state. Scope and principal identities come from the existing server/session boundary; no duplicate account/session schema.",
      shape: { operations: [], payload },
    });
    model.datasets!.push({
      id: dataset,
      name,
      contract: dcRef(cid),
      owners: [{ kind: "element", id: "dc-api" }],
      ownershipDecision:
        "Discussion API owns mutable state; worker executes the same bounded modules under service-purpose and current recipient/resource policy. PostgreSQL is the authority; no cross-store transaction.",
      store: "dc-db",
      readers: [
        { kind: "component", id: `dc-${component === "files" ? "attachments" : component}` },
        { kind: "element", id: "dc-worker" },
      ],
      writers: [
        { kind: "component", id: `dc-${component === "files" ? "attachments" : component}` },
      ],
      tenant: "Tenant scoped",
      deletion: id === "audit" ? "Retain" : id === "revision" ? "Retain" : "Anonymize",
      exportAccess: id === "audit" ? "Authorized staff" : "Owner",
    });
    const entity: BackendEntity = {
      id: `dc-${id}-entity`,
      version: "v1",
      name,
      dataset,
      contract: dcRef(cid),
      storageId: `dc-${id}-table`,
      fields: payload.map((f) => ({
        field: f.id,
        storageId: `${f.id}-column`,
        required: true,
        nullable: !!f.nullable,
        storage:
          f.type === "array" || f.type === "object"
            ? { kind: "json", query: "opaque" }
            : { kind: "scalar" },
        ...(f.id === "id"
          ? { serverOwned: "id" as const }
          : f.id === "scope-id"
            ? { serverOwned: "scope" as const }
            : f.id === "version"
              ? { serverOwned: "version" as const }
              : f.id === "created-at"
                ? { serverOwned: "clock" as const }
                : ["author-id", "owner-id", "reporter-id", "actor-id"].includes(f.id)
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
    backend.entities.push(entity);
    return entity;
  };
  add("workspace", "Workspace", "access", { name: text(200) });
  add("group", "Group", "access", { name: text(200) });
  add(
    "workspace-member",
    "Workspace membership",
    "access",
    {
      principalId: uuid,
      state: enumeration("active", "revoked"),
      role: enumeration("member", "moderator", "administrator"),
    },
    [],
    [["principal-id"]],
  );
  add(
    "membership",
    "Group membership",
    "access",
    {
      principalId: uuid,
      groupId: uuid,
      state: enumeration("active", "revoked"),
      role: enumeration("member", "moderator"),
    },
    [relation("group", "group", "group-id")],
    [["principal-id", "group-id"]],
  );
  add("category", "Category", "categories", {
    name: text(200),
    visibility: enumeration("public", "private"),
  });
  add(
    "grant",
    "Category group grant",
    "access",
    { categoryId: uuid, groupId: uuid, access: enumeration("read", "write") },
    [relation("category", "category", "category-id"), relation("group", "group", "group-id")],
    [["category-id", "group-id"]],
  );
  add(
    "topic",
    "Topic",
    "content",
    { categoryId: uuid, title: text(200), state: enumeration("open", "closed", "archived") },
    [relation("category", "category", "category-id")],
  );
  add(
    "post",
    "Post",
    "content",
    {
      topicId: uuid,
      authorId: uuid,
      text: { ...text(20000), nullable: true },
      state: enumeration("visible", "hidden", "removed"),
    },
    [relation("topic", "topic", "topic-id", true)],
  );
  add(
    "revision",
    "Immutable post revision",
    "content",
    {
      postId: uuid,
      postVersion: integer(2147483647, 1),
      text: text(20000),
      authorId: uuid,
      at: { type: "timestamp" },
    },
    [relation("post", "post", "post-id", true)],
    [["post-id", "post-version"]],
  );
  add(
    "subscription",
    "Topic subscription",
    "subscriptions",
    {
      principalId: uuid,
      topicId: uuid,
      mode: enumeration("watch", "mute"),
      inboxEnabled: { type: "boolean" },
      emailEnabled: { type: "boolean" },
    },
    [relation("topic", "topic", "topic-id")],
    [["principal-id", "topic-id"]],
  );
  add(
    "notification",
    "Notification inbox",
    "notifications",
    { principalId: uuid, postId: uuid, eventId: uuid, subscriptionId: uuid, text: text(20000) },
    [
      relation("post", "post", "post-id"),
      relation("subscription", "subscription", "subscription-id"),
    ],
    [["principal-id", "event-id"]],
  );
  add(
    "flag",
    "Moderation flag",
    "moderation",
    {
      postId: uuid,
      reporterId: uuid,
      state: enumeration("pending", "dismissed", "upheld"),
      activeReview: integer(2147483647),
    },
    [relation("post", "post", "post-id")],
    [["reporter-id", "post-id", "active-review"]],
  );
  add("attachment", "Private attachment metadata", "files", {
    ownerId: uuid,
    state: enumeration("staged", "validated", "attached", "orphan", "deleted"),
    filename: text(200),
    mime: enumeration("text/plain", "image/png"),
    size: integer(10485760, 1),
    sha256: { type: "text", textConstraint: "sha256", minLength: 64, maxLength: 64 },
    objectKey: text(200),
  });
  add(
    "attachment-link",
    "Attachment association",
    "files",
    { attachmentId: uuid, postId: uuid },
    [relation("attachment", "attachment", "attachment-id"), relation("post", "post", "post-id")],
    [["attachment-id"]],
  );
  add(
    "audit",
    "Protected audit metadata",
    "audit",
    {
      actorId: uuid,
      categoryId: uuid,
      targetId: uuid,
      action: text(80),
      at: { type: "timestamp" },
    },
    [relation("category", "category", "category-id")],
  );
  add(
    "trust",
    "Principal trust profile",
    "access",
    {
      principalId: uuid,
      level: integer(2),
      reasons: {
        type: "array",
        items: enumeration("qualified", "inactive", "override"),
        maxItems: 3,
      },
      policyVersion: enumeration("trust-v1"),
    },
    [],
    [["principal-id"]],
  );
  add("activity", "Recorded principal activity", "access", {
    principalId: uuid,
    at: { type: "timestamp" },
    kind: enumeration("read", "reply", "approved"),
    count: integer(),
  });
  add(
    "hold",
    "Protected post retention hold",
    "privacy",
    { postId: uuid, reason: enumeration("legal-hold") },
    [relation("post", "post", "post-id")],
    [["post-id"]],
  );
  add(
    "adjudication",
    "Abuse adjudication",
    "moderation",
    {
      postId: uuid,
      decision: enumeration("allow", "review", "reject"),
      reason: enumeration("fixture-token", "appeal-accepted", "moderator-override"),
      ruleVersion: enumeration("abuse-v1"),
    },
    [relation("post", "post", "post-id")],
  );
  add(
    "digest",
    "Digest window",
    "notifications",
    {
      principalId: uuid,
      windowStart: { type: "timestamp" },
      windowEnd: { type: "timestamp" },
      timezone: text(100),
      topicIds: { type: "array", items: uuid, maxItems: 100 },
      state: enumeration("pending", "sent", "uncertain", "suppressed"),
      deliveryId: text(128),
    },
    [],
    [["principal-id", "window-start", "window-end"]],
  );
  add("privacy-request", "Privacy progress and hold", "privacy", {
    principalId: uuid,
    kind: enumeration("export", "erase"),
    state: enumeration("planned", "processing", "cancelled", "complete"),
    retentionDays: integer(36500),
    legalHold: { type: "boolean" },
    progressId: uuid,
  });
  add(
    "mail-receipt",
    "Verified inbound message receipt",
    "mail",
    { messageId: text(200), postId: uuid, sourceIdentity: text(128) },
    [relation("post", "post", "post-id")],
    [["message-id", "source-identity"]],
  );
  add(
    "search-projection",
    "Search projection",
    "search",
    {
      postId: uuid,
      title: text(200),
      plainText: text(20000),
      projectionVersion: integer(2147483647, 1),
      asOf: { type: "timestamp" },
    },
    [relation("post", "post", "post-id")],
    [["post-id"]],
  );
  backend.entities
    .find((e) => e.id === "dc-revision-entity")!
    .uniqueKeys.push({
      id: "post-version-global",
      fields: ["post-version", "post-id"],
      scope: "global",
      nulls: "forbidden",
    });
  const subscription = backend.entities.find((e) => e.id === "dc-subscription-entity")!;
  subscription.uniqueKeys.push({
    id: "recipient-subscription",
    fields: ["id", "principal-id"],
    scope: "entity-scope",
    nulls: "forbidden",
  });
  backend.entities
    .find((e) => e.id === "dc-notification-entity")!
    .relations.find((r) => r.id === "subscription")!
    .fields.push({ source: "principal-id", target: "principal-id" });
  const revisionAuthor = backend.entities
    .find((e) => e.id === "dc-revision-entity")!
    .fields.find((f) => f.field === "author-id")!;
  delete revisionAuthor.serverOwned;
  // One topic consistency boundary contains its posts/history. Per-record version guards remain P71b.
  backend.aggregates.push({
    id: "dc-discussion-aggregate",
    version: "v1",
    name: "Topic, posts and immutable history",
    root: ref("topic"),
    children: [ref("post"), ref("revision")],
    owner: { kind: "element", id: "dc-api" },
    store: "dc-db",
    concurrency: {
      kind: "row-lock",
      entities: [ref("post"), ref("revision"), ref("topic")],
      order: "entity-id-primary-key",
    },
    invariants: [],
  });
  for (const entity of backend.entities.filter(
    (e) => !["dc-topic-entity", "dc-post-entity", "dc-revision-entity"].includes(e.id),
  ))
    backend.aggregates.push({
      id: `${entity.id}-aggregate`,
      version: "v1",
      name: entity.name,
      root: dcRef(entity.id),
      children: [],
      owner: { kind: "element", id: "dc-api" },
      store: "dc-db",
      concurrency: { kind: "optimistic", version: { entity: dcRef(entity.id), field: "version" } },
      invariants: [],
    });
  return backend;
}
