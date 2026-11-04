/** Current ticket/article authority, never cached projection authority or runtime evaluation. */

import type { BackendQuery } from "./backend-model.ts";
import type { BackendAccessPolicy } from "./backend-policy-model.ts";
import type { DesignDocument } from "./design.ts";
import { zcEntity, zcRef } from "./zammad-core-data.ts";

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
const all = (...clauses: string[]) => ({ operator: "all" as const, clauses });
export function zammadCoreAccess(design: DesignDocument) {
  const a = design.architecture!,
    b = a.backend!;
  const entity = (id: string) => b.entities.find((e) => e.id === zcEntity(id).id)!;
  const select = (id: string) => ({ kind: "policy" as const, reference: zcRef(`zc-${id}-policy`) });
  const role = (id: string, values: string[]): BackendAccessPolicy["clauses"][number] => ({
    id,
    kind: "role",
    authority: "persisted-role-store",
    entity: zcEntity("scope-member"),
    principal: "principal-id",
    field: "role",
    values,
  });
  const member = (
    id: string,
    source: string,
    relation: string,
    path: string[],
    capabilities?: string[],
  ): BackendAccessPolicy["clauses"][number] => ({
    id,
    kind: "membership",
    scope: source === "agent-member" ? "group" : "organization",
    entity: zcEntity(source),
    principal: "principal-id",
    relation,
    ...(path.length ? { path } : {}),
    active: { field: "active", value: true },
    ...(capabilities ? { access: { field: "capability", values: capabilities } } : {}),
  });
  const writeFields: Record<string, string[]> = {
    organization: ["name", "share-tickets"],
    group: ["name", "ingress"],
    "agent-member": ["active", "capability"],
    "customer-member": ["active"],
    ticket: ["title", "state", "priority", "group-id", "assignee-id"],
    file: ["mime", "size", "sha256"],
    preference: ["channels"],
  };
  for (const e of b.entities) {
    const id = e.id.slice(3, -7),
      ticket = id === "ticket" || e.relations.some((r) => r.id === "ticket"),
      path = id === "ticket" ? [] : ["ticket"];
    const clauses: BackendAccessPolicy["clauses"] = [
      { id: "authenticated", kind: "authenticated" },
      member("scope-member", "scope-member", "scope", id === "scope" ? [] : ["scope"]),
      role("customer", ["customer"]),
      role("agent", ["agent", "supervisor", "administrator"]),
      role("admin", ["administrator"]),
    ];
    let reads = [["scope-member", "admin"]],
      writes = [["scope-member", "admin"]];
    if (ticket) {
      clauses.push(
        {
          id: "customer-owner",
          kind: "owner",
          field: "customer-id",
          ...(id === "ticket" ? {} : { via: "ticket" }),
        },
        member("organization-member", "customer-member", "organization", [...path, "organization"]),
        {
          id: "organization-sharing",
          kind: "visibility",
          path: [...path, "organization"],
          field: "share-tickets",
          value: true,
        },
        member(
          "group-read",
          "agent-member",
          "group",
          [...path, "group"],
          ["read", "write", "supervise"],
        ),
        member("group-write", "agent-member", "group", [...path, "group"], ["write", "supervise"]),
      );
      reads = [
        ["scope-member", "customer", "organization-member", "customer-owner"],
        ["scope-member", "customer", "organization-member", "organization-sharing"],
        ["scope-member", "agent", "group-read"],
      ];
      writes = [["scope-member", "agent", "group-write"]];
      const visibility =
        id === "article"
          ? { field: "visibility" }
          : e.relations.some((r) => r.id === "article")
            ? { via: "article", field: "visibility" }
            : id === "audit"
              ? { field: "visibility" }
              : undefined;
      if (visibility) {
        clauses.push({ id: "public-article", kind: "visibility", ...visibility, value: "public" });
        reads[0]!.push("public-article");
        reads[1]!.push("public-article");
      }
      if (id === "notification") {
        clauses.push({ id: "recipient", kind: "owner", field: "recipient-id" });
        reads = reads.map((c) => [...c, "recipient"]);
      }
      if (["assignment", "escalation", "routing-receipt"].includes(id))
        reads = [["scope-member", "agent", "group-read"]];
      // Creation/reply input policy is separate from the privileged ticket write projection.
      if (id !== "ticket") writes = [];
    } else if (["file", "preference", "scope-member", "customer-member"].includes(id)) {
      clauses.push({
        id: "owner",
        kind: "owner",
        field: id === "file" ? "owner-id" : "principal-id",
      });
      reads = [["scope-member", "owner"]];
      writes =
        id === "scope-member" || id === "customer-member"
          ? [["scope-member", "admin"]]
          : [["scope-member", "owner"]];
      if (id === "file") {
        clauses.push({ id: "staged", kind: "visibility", field: "state", value: "staged" });
        reads[0]!.push("staged");
        writes[0]!.push("staged");
      }
    } else if (id === "group") {
      clauses.push(
        member("group-read", "agent-member", "group", [], ["read", "write", "supervise"]),
        { id: "ingress", kind: "visibility", field: "ingress", value: true },
      );
      reads = [
        ["scope-member", "customer", "ingress"],
        ["scope-member", "agent", "group-read"],
      ];
    }
    if (["calendar", "sla", "routing-rule"].includes(id)) writes = [];
    const readFields = e.fields
      .map((f) => f.field)
      .filter((f) => !["object-key", "validated-at"].includes(f));
    const p: BackendAccessPolicy = {
      id: `zc-${id}-policy`,
      version: "v1",
      name: `${e.name} current access`,
      resource: zcRef(e.id),
      context: {
        identity: "session-principal",
        authentication: "server-established",
        scope: "authorized-scope",
        correlation: "server-established",
      },
      default: "deny",
      conflict: "deny-wins",
      clauses,
      rules: [
        ...reads.map((c, i) => ({
          id: `read-${i + 1}`,
          effect: "allow" as const,
          actions: ["read", "list", "search", "bytes", "export", "idempotent-replay"],
          when: all(...c),
        })),
        ...writes.map((c, i) => ({
          id: `write-${i + 1}`,
          effect: "allow" as const,
          actions: ["write"],
          when: all(...c),
        })),
      ],
      projections: [
        {
          id: "read",
          mode: "read",
          fields: readFields,
          when: all("scope-member"),
          unknownFields: "reject",
        },
        ...(writes.length && writeFields[id]?.length
          ? [
              {
                id: "write",
                mode: "write" as const,
                fields: writeFields[id]!,
                when: all("scope-member"),
                unknownFields: "reject" as const,
              },
            ]
          : []),
      ],
      revocation: { strategy: "current-state", cache: "none", recheck: [...sites] },
    };
    b.accessPolicies!.push(p);
  }
  // No public or customer operation selects the agent ticket write projection.
  const ticketPolicy = b.accessPolicies!.find((p) => p.id === "zc-ticket-policy")!;
  const input = structuredClone(ticketPolicy);
  input.id = "zc-customer-command-policy";
  input.name = "Current customer public input only";
  input.rules = [
    {
      id: "customer-input",
      effect: "allow",
      actions: ["write", "idempotent-replay"],
      when: all("scope-member", "customer", "organization-member", "customer-owner"),
    },
    {
      id: "agent-input",
      effect: "allow",
      actions: ["write", "idempotent-replay"],
      when: all("scope-member", "agent", "group-write"),
    },
  ];
  input.projections = [
    {
      id: "write",
      mode: "write",
      fields: ["title"],
      when: all("scope-member"),
      unknownFields: "reject",
    },
  ];
  b.accessPolicies!.push(input);
  // Append immutable definitions through a new version, never update an existing calendar/rule row.
  for (const id of ["calendar", "sla", "routing-rule"]) {
    const p = structuredClone(b.accessPolicies!.find((p) => p.id === `zc-${id}-policy`)!);
    p.id = `zc-${id}-append-policy`;
    p.name = `${entity(id).name} administrator append`;
    p.rules.push({
      id: "append",
      effect: "allow",
      actions: ["write"],
      when: all("scope-member", "admin"),
    });
    p.projections.push({
      id: "write",
      mode: "write",
      fields: entity(id)
        .fields.filter((f) => !f.serverOwned)
        .map((f) => f.field),
      when: all("scope-member", "admin"),
      unknownFields: "reject",
    });
    b.accessPolicies!.push(p);
  }
  const query = (
    id: string,
    root: string,
    fields: string[],
    filters: string[] = [],
    at: "read" | "search" = "read",
  ) => {
    const orderField = entity(root).fields.some((f) => f.field === "at") ? "at" : "created-at";
    const q: BackendQuery = {
      id: `zc-${id}-query`,
      version: "v1",
      name: id.replaceAll("-", " "),
      root: zcEntity(root),
      joins: [],
      filters: filters.map((field) => ({
        id: field,
        field: { source: "root", field },
        comparisons: ["eq"],
      })),
      projection: fields.map((field) => ({ id: field, field: { source: "root", field } })),
      order: [orderField, "id"].map((field) => ({
        field: { source: "root", field },
        direction: "asc",
      })),
      limit: { default: 25, maximum: 100 },
      cursor: {
        kind: "keyset",
        fields: [orderField, "id"].map((field) => ({ source: "root", field })),
      },
      accessPolicy: select(root),
      accessProjection: "read",
      accessSite: at,
      sourcePolicies: [],
      freshness: { kind: "authoritative" },
    };
    b.queries!.push(q);
    return q;
  };
  query(
    "tickets",
    "ticket",
    [
      "id",
      "customer-id",
      "organization-id",
      "group-id",
      "assignee-id",
      "title",
      "state",
      "priority",
      "version",
    ],
    ["state"],
  );
  query(
    "articles",
    "article",
    ["id", "ticket-id", "author-id", "author-kind", "visibility", "text", "at", "version"],
    ["ticket-id"],
  );
  query("groups", "group", ["id", "name", "version"]).order = [
    { field: { source: "root", field: "id" }, direction: "asc" },
  ];
  b.queries!.find((q) => q.id === "zc-groups-query")!.cursor.fields = [
    { source: "root", field: "id" },
  ];
  query("audit", "audit", ["id", "ticket-id", "actor-id", "action", "at"], ["ticket-id"]);
  const search = query(
    "search",
    "search-projection",
    ["id", "ticket-id", "article-id"],
    [],
    "search",
  );
  search.joins = [
    { id: "article", from: "root", relation: "article", kind: "inner" },
    { id: "ticket", from: "root", relation: "ticket", kind: "inner" },
  ];
  search.sourcePolicies = [
    { source: "article", policy: select("article"), projection: "read" },
    { source: "ticket", policy: select("ticket"), projection: "read" },
  ];
  search.filters = [
    { id: "text", field: { source: "article", field: "text" }, comparisons: ["prefix"] },
  ];
  search.projection.push(
    { id: "title", field: { source: "ticket", field: "title" } },
    { id: "snippet", field: { source: "article", field: "text" } },
  );
  search.order = [
    { field: { source: "article", field: "at" }, direction: "asc" },
    { field: { source: "root", field: "id" }, direction: "asc" },
  ];
  search.cursor.fields = search.order.map((o) => o.field);
  const inbox = query(
    "inbox",
    "notification",
    ["id", "ticket-id", "article-id", "recipient-id"],
    ["recipient-id"],
  );
  inbox.joins = [{ id: "article", from: "root", relation: "article", kind: "inner" }];
  inbox.sourcePolicies = [{ source: "article", policy: select("article"), projection: "read" }];
  inbox.projection.push({ id: "excerpt", field: { source: "article", field: "text" } });
  const attachments = query(
    "attachments",
    "attachment",
    ["id", "ticket-id", "article-id", "file-id"],
    ["article-id"],
  );
  attachments.joins = [{ id: "file", from: "root", relation: "file", kind: "inner" }];
  // File fields are private adapter metadata; live-link policy authorizes the public exact DTO.
  const fileRead = structuredClone(b.accessPolicies!.find((p) => p.id === "zc-file-policy")!);
  fileRead.id = "zc-file-linked-policy";
  fileRead.name = "Live-link file DTO fields";
  fileRead.clauses = [{ id: "authenticated", kind: "authenticated" }];
  fileRead.rules = [
    { id: "field-source", effect: "allow", actions: ["read"], when: all("authenticated") },
  ];
  fileRead.projections = [
    {
      id: "read",
      mode: "read",
      fields: ["id", "mime", "size", "sha256", "version"],
      when: all("authenticated"),
      unknownFields: "reject",
    },
  ];
  b.accessPolicies!.push(fileRead);
  attachments.sourcePolicies = [
    {
      source: "file",
      policy: { kind: "policy", reference: zcRef(fileRead.id) },
      projection: "read",
    },
  ];
  for (const field of ["mime", "size", "sha256"])
    attachments.projection.push({ id: field, field: { source: "file", field } });
  const uses: Record<string, string> = {
    "put-organization": "organization",
    "list-groups": "group",
    "put-membership": "agent-member",
    "create-ticket": "customer-command",
    "list-tickets": "ticket",
    "get-ticket": "ticket",
    "add-article": "customer-command",
    "list-articles": "article",
    "get-article": "article",
    "export-conversation": "article",
    "assign-ticket": "ticket",
    "transition-ticket": "ticket",
    "put-calendar": "calendar-append",
    "put-sla-policy": "sla-append",
    "preview-deadline": "sla",
    "get-deadline": "deadline",
    "escalation-backlog": "sla",
    "put-routing-rule": "routing-rule-append",
    "route-ticket": "ticket",
    "stage-file": "file",
    "put-file-bytes": "file",
    "download-file": "attachment",
    "attach-file": "article",
    "get-file": "attachment",
    search: "search-projection",
    audit: "audit",
    "put-preferences": "preference",
    inbox: "notification",
  };
  for (const contract of a.contracts!.filter((c) => c.kind === "api"))
    for (const op of contract.shape!.operations) {
      const id = uses[op.id];
      if (!id) continue;
      const p = b.accessPolicies!.find((p) => p.id === `zc-${id}-policy`)!;
      const owner = a.interfaces!.find(
        (i) => i.direction === "provided" && i.contract.id === contract.id,
      )!.owner;
      if (owner.kind === "external-system") continue;
      const write = op.transport!.method !== "GET";
      b.accessBindings!.push({
        id: `zc-${op.id}-access-use`,
        version: "v1",
        name: `${op.name} current access`,
        target: { kind: "operation", contract: zcRef(contract.id), operation: op.id, owner },
        resource: p.resource,
        policy: { kind: "policy", reference: zcRef(p.id) },
        action: op.id === "search" ? "search" : write ? "write" : "read",
        site:
          op.id === "download-file"
            ? "bytes"
            : op.id === "export-conversation"
              ? "export"
              : op.id === "search"
                ? "search"
                : write
                  ? "write"
                  : "read",
        projection: write ? "write" : "read",
        relationshipBinding: `${contract.id}-binding`,
      });
    }
}
