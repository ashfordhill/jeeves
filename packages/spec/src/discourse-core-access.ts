/** Current-state access and stable bounded queries for P71a. No policy/query execution. */

import type { BackendEntity, BackendQuery } from "./backend-model.ts";
import type { BackendAccessPolicy } from "./backend-policy-model.ts";
import type { DesignDocument } from "./design.ts";
import { dcRef } from "./discourse-core-data.ts";

const ref = (id: string) => dcRef(`dc-${id}-entity`);
const condition = (...clauses: string[]) => ({ operator: "all" as const, clauses });
const sites = [
  "read",
  "write",
  "search",
  "bytes",
  "materialization",
  "delivery",
  "export",
  "job",
  "idempotent-replay",
] as const;
const parents: Record<string, string[]> = {
  category: [],
  topic: ["category"],
  post: ["topic", "category"],
  revision: ["post", "topic", "category"],
  subscription: ["topic", "category"],
  notification: ["post", "topic", "category"],
  flag: ["post", "topic", "category"],
  "attachment-link": ["post", "topic", "category"],
  audit: ["category"],
  adjudication: ["post", "topic", "category"],
  "search-projection": ["post", "topic", "category"],
};
export function discourseCoreAccess(design: DesignDocument) {
  const model = design.architecture!,
    backend = model.backend!;
  const policies = backend.accessPolicies!;
  const entity = (id: string) => backend.entities.find((e) => e.id === `dc-${id}-entity`)!;
  const role: BackendAccessPolicy["clauses"][number] = {
    id: "moderator",
    kind: "role",
    authority: "persisted-role-store",
    entity: ref("workspace-member"),
    principal: "principal-id",
    field: "role",
    values: ["moderator", "administrator"],
  };
  const admin: typeof role = { ...role, id: "admin", values: ["administrator"] };
  const grant = (
    id: string,
    path: string[],
    write = false,
    subject: Extract<BackendAccessPolicy["clauses"][number], { kind: "group-grant" }>["subject"] = {
      kind: "session-principal",
    },
  ): BackendAccessPolicy["clauses"][number] => ({
    id,
    kind: "group-grant",
    resourcePath: path,
    subject,
    workspaceMembership: {
      entity: ref("workspace-member"),
      principal: "principal-id",
      active: { field: "state", value: "active" },
    },
    grant: {
      entity: ref("grant"),
      resourceRelation: "category",
      groupRelation: "group",
      access: { field: "access", values: write ? ["write"] : ["read", "write"] },
    },
    membership: {
      entity: ref("membership"),
      groupRelation: "group",
      principal: "principal-id",
      active: { field: "state", value: "active" },
    },
    public: { field: "visibility", value: "public" },
  });
  const make = (
    e: BackendEntity,
    clauses: BackendAccessPolicy["clauses"],
    read: string[][],
    write: string[][],
    service = false,
  ): BackendAccessPolicy => {
    const p: BackendAccessPolicy = {
      id: `${e.id}${service ? "-service" : ""}-policy`,
      version: "v1",
      name: `${e.name}${service ? " service recipient" : " current access"}`,
      resource: dcRef(e.id),
      context: {
        identity: service ? "verified-service" : "session-principal",
        authentication: "server-established",
        scope: "authorized-scope",
        correlation: "server-established",
        ...(service
          ? {
              service: {
                purpose: "discussion-delivery",
                authority: "server-service-identity",
                scope: "authorized-scope",
                initiatingActor: "provenance-only",
              },
            }
          : {}),
      },
      default: "deny",
      conflict: "deny-wins",
      clauses,
      rules: [
        ...read.map((c, i) => ({
          id: `read-${i + 1}`,
          effect: "allow" as const,
          actions: [
            "read",
            "list",
            "bytes",
            "materialization",
            "delivery",
            "export",
            "job",
            "idempotent-replay",
          ],
          when: condition(...c),
        })),
        ...write.map((c, i) => ({
          id: `write-${i + 1}`,
          effect: "allow" as const,
          actions: ["write"],
          when: condition(...c),
        })),
      ],
      projections: [
        {
          id: "read",
          mode: "read",
          fields: e.fields.map((f) => f.field),
          when: { operator: "any", clauses: clauses.map((c) => c.id) },
          unknownFields: "reject",
        },
        ...(e.fields.some((f) => !f.serverOwned)
          ? [
              {
                id: "write",
                mode: "write" as const,
                fields: e.fields.filter((f) => !f.serverOwned).map((f) => f.field),
                when: { operator: "any" as const, clauses: clauses.map((c) => c.id) },
                unknownFields: "reject" as const,
              },
            ]
          : []),
      ],
      revocation: { strategy: "current-state", cache: "none", recheck: [...sites] },
    };
    policies.push(p);
    return p;
  };
  for (const e of backend.entities) {
    const id = e.id.slice(3).replace(/-entity$/, ""),
      path = parents[id];
    const clauses: BackendAccessPolicy["clauses"] = [
      { id: "authenticated", kind: "authenticated" },
      role,
      admin,
    ];
    const ownerField = ["principal-id", "owner-id", "author-id", "reporter-id"].find((f) =>
      e.fields.some((v) => v.field === f),
    );
    if (ownerField) clauses.push({ id: "owner", kind: "owner", field: ownerField });
    if (path) {
      clauses.push(grant("category-read", path), grant("category-write", path, true));
    }
    let read = path ? [["category-read"]] : ownerField ? [["owner"], ["admin"]] : [["admin"]];
    let write = path ? [["category-write"]] : ownerField ? [["owner"], ["admin"]] : [["admin"]];
    if (
      [
        "workspace",
        "group",
        "workspace-member",
        "membership",
        "grant",
        "category",
        "trust",
        "activity",
        "hold",
      ].includes(id)
    )
      write = [["admin"]];
    if (id === "revision") {
      clauses.push(
        { id: "post-visible", kind: "visibility", via: "post", field: "state", value: "visible" },
        { id: "post-hidden", kind: "visibility", via: "post", field: "state", value: "hidden" },
      );
      read = [
        ["category-read", "post-visible"],
        ["category-read", "post-hidden", "moderator"],
      ];
      write = [["category-write"]];
    }
    if (id === "post")
      write = [
        ["category-write", "owner"],
        ["category-write", "moderator"],
      ];
    if (id === "subscription") read = write = [["category-read", "owner"]];
    if (["audit", "flag"].includes(id)) read = [["category-read", "moderator"]];
    if (id === "flag") write = [["category-read"]];
    if (id === "audit") write = [["category-write", "moderator"]];
    if (id === "adjudication") {
      clauses.push({ id: "post-author", kind: "owner", via: "post", field: "author-id" });
      read = write = [
        ["category-read", "post-author"],
        ["category-read", "moderator"],
      ];
    }
    if (id === "search-projection" || id === "notification") {
      clauses.push({
        id: "post-visible",
        kind: "visibility",
        via: "post",
        field: "state",
        value: "visible",
      });
      read = [["category-read", "post-visible", ...(id === "notification" ? ["owner"] : [])]];
    }
    if (id === "attachment-link") {
      clauses.push(
        { id: "post-visible", kind: "visibility", via: "post", field: "state", value: "visible" },
        { id: "post-hidden", kind: "visibility", via: "post", field: "state", value: "hidden" },
      );
      read = [
        ["category-read", "post-visible"],
        ["category-read", "post-hidden", "moderator"],
      ];
    }
    if (id === "notification") {
      clauses.push(
        { id: "watch", kind: "visibility", via: "subscription", field: "mode", value: "watch" },
        {
          id: "inbox-enabled",
          kind: "visibility",
          via: "subscription",
          field: "inbox-enabled",
          value: true,
        },
      );
      read = read.map((c) => [...c, "watch", "inbox-enabled"]);
    }
    const p = make(e, clauses, read, write);
    p.rules.push(
      ...read.map((c, i) => ({
        id: `search-${i + 1}`,
        effect: "allow" as const,
        actions: ["search"],
        when: condition(...c, ...(id === "post" ? ["visible"] : [])),
      })),
    );
    if (["post", "topic", "flag"].includes(id))
      p.rules.push({
        id: "moderate",
        effect: "allow",
        actions: ["moderate"],
        when: condition("category-write", "moderator"),
      });
    if (id === "post") {
      p.clauses.push(
        { id: "visible", kind: "visibility", field: "state", value: "visible" },
        { id: "hidden", kind: "visibility", field: "state", value: "hidden" },
      );
      p.projections[0]!.conditional = [
        {
          field: "text",
          allow: [condition("visible"), condition("hidden", "moderator")],
          otherwise: "null",
        },
      ];
    }
    if (id === "subscription" || id === "notification") {
      const recipient = id === "subscription" ? e : entity("notification");
      const c: BackendAccessPolicy["clauses"] = [
        { id: "service", kind: "service-purpose", purpose: "discussion-delivery" },
        grant("category-read", parents[id]!, false, {
          kind: "resource-field",
          field: "principal-id",
        }),
      ];
      if (id === "subscription")
        c.push({ id: "watch", kind: "visibility", field: "mode", value: "watch" });
      else
        c.push({
          id: "post-visible",
          kind: "visibility",
          via: "post",
          field: "state",
          value: "visible",
        });
      make(
        recipient,
        c,
        [["service", "category-read", id === "subscription" ? "watch" : "post-visible"]],
        [],
        true,
      );
    }
  }
  // Policy before matching, snippets, ordering and keyset limit. These are not executed SQL.
  const query = (
    id: string,
    name: string,
    root: string,
    fields: string[],
    order: string[],
    filters: string[] = [],
    site: "read" | "search" = "read",
    policy?: string,
  ) => {
    const q: BackendQuery = {
      id: `dc-${id}`,
      version: "v1",
      name,
      root: ref(root),
      joins: [],
      filters: filters.map((field) => ({
        id: `filter-${field}`,
        field: { source: "root", field },
        comparisons: ["eq"],
      })),
      projection: fields.map((field) => ({ id: field, field: { source: "root", field } })),
      order: order.map((field) => ({ field: { source: "root", field }, direction: "asc" })),
      cursor: { kind: "keyset", fields: order.map((field) => ({ source: "root", field })) },
      limit: { default: 25, maximum: 100 },
      accessPolicy: { kind: "policy", reference: dcRef(policy ?? `dc-${root}-entity-policy`) },
      accessProjection: "read",
      accessSite: site,
      freshness: { kind: "authoritative" },
    };
    backend.queries!.push(q);
    return q;
  };
  query(
    "topics-query",
    "Readable topics",
    "topic",
    ["id", "category-id", "title", "state", "version", "created-at"],
    ["created-at", "id"],
    ["category-id", "state"],
  );
  query(
    "posts-query",
    "Current posts including safe tombstones",
    "post",
    ["id", "topic-id", "author-id", "text", "state", "version", "created-at"],
    ["created-at", "id"],
    ["topic-id"],
  );
  query(
    "history-query",
    "Currently authorized immutable history",
    "revision",
    ["post-id", "post-version", "text", "author-id", "at"],
    ["post-version", "post-id"],
    ["post-id"],
  );
  query(
    "subscriptions-query",
    "Owned current preferences",
    "subscription",
    ["id", "principal-id", "topic-id", "mode", "inbox-enabled", "email-enabled", "version"],
    ["created-at", "id"],
    ["topic-id"],
  );
  query(
    "inbox-query",
    "Current eligible inbox",
    "notification",
    ["id", "principal-id", "post-id", "event-id", "text", "created-at"],
    ["created-at", "id"],
  );
  query(
    "reviews-query",
    "Current moderator review queue",
    "flag",
    ["id", "post-id", "reporter-id", "state", "version", "created-at"],
    ["created-at", "id"],
    ["state"],
  );
  query(
    "audit-query",
    "Protected metadata audit",
    "audit",
    ["id", "actor-id", "target-id", "action", "at", "created-at"],
    ["created-at", "id"],
  );
  const search = query(
    "search-query",
    "Authoritatively filtered search candidates",
    "post",
    ["id", "topic-id", "text", "created-at"],
    ["created-at", "id"],
    ["topic-id"],
    "search",
  );
  search.joins = [{ id: "topic", from: "root", relation: "topic", kind: "inner" }];
  search.projection.push({ id: "title", field: { source: "topic", field: "title" } });
  search.order = [
    { field: { source: "topic", field: "created-at" }, direction: "asc" },
    { field: { source: "topic", field: "id" }, direction: "asc" },
    { field: { source: "root", field: "id" }, direction: "asc" },
  ];
  search.cursor.fields = search.order.map((o) => o.field);
  search.sourcePolicies = [
    {
      source: "topic",
      policy: { kind: "policy", reference: dcRef("dc-topic-entity-policy") },
      projection: "read",
    },
  ];
  // Exact operation access uses are a P64 selection, not P71b executable bindings.
  const uses: Record<string, [string, string]> = {
    "put-membership": ["membership", "admin"],
    "put-grant": ["grant", "admin"],
    "create-topic": ["topic", "write"],
    "get-topic": ["topic", "read"],
    "list-topics": ["topic", "read"],
    reply: ["topic", "write"],
    "list-posts": ["post", "read"],
    "edit-post": ["post", "write"],
    "post-history": ["revision", "read"],
    "transition-topic": ["topic", "moderate"],
    "transition-post": ["post", "moderate"],
    "put-subscription": ["subscription", "write"],
    inbox: ["notification", "read"],
    "stage-file": ["attachment", "write"],
    "put-file-bytes": ["attachment", "write"],
    "attach-file": ["attachment-link", "write"],
    "download-file": ["attachment-link", "read"],
    "flag-post": ["flag", "write"],
    "review-queue": ["flag", "read"],
    "review-flag": ["flag", "moderate"],
    search: ["post", "read"],
    audit: ["audit", "read"],
    "evaluate-trust": ["trust", "write"],
    adjudicate: ["adjudication", "write"],
    "schedule-digest": ["digest", "write"],
    "get-digest": ["digest", "read"],
    render: ["topic", "write"],
    restructure: ["topic", "moderate"],
    privacy: ["privacy-request", "write"],
    rank: ["topic", "read"],
  };
  for (const contract of model.contracts!.filter((c) => c.kind === "api"))
    for (const op of contract.shape!.operations) {
      const use = uses[op.id];
      if (!use) continue;
      const [root, action] = use;
      const owner = model.interfaces!.find(
        (i) => i.direction === "provided" && i.contract.id === contract.id,
      )!.owner;
      if (owner.kind === "external-system") continue;
      const write = !["GET", "HEAD"].includes(op.transport!.method);
      const policy = dcRef(`dc-${root}-entity-policy`);
      backend.accessBindings!.push({
        id: `dc-${op.id}-access-use`,
        version: "v1",
        name: `${op.name} current access`,
        target: { kind: "operation", contract: dcRef(contract.id), operation: op.id, owner },
        resource: ref(root),
        policy: { kind: "policy", reference: policy },
        action: op.id === "search" ? "search" : action === "admin" ? "write" : action,
        site:
          op.id === "download-file"
            ? "bytes"
            : write
              ? "write"
              : op.id === "search"
                ? "search"
                : "read",
        projection: write ? "write" : "read",
        relationshipBinding: `${contract.id}-binding`,
      });
    }
}
