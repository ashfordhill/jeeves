/** Additional durable recovery records; P72a entities and storage identities remain untouched. */
import type { Architecture } from "./architecture.ts";
import { vcField as field, vcRef as ref } from "./vendure-core-data.ts";
export function vendureCoreRecoveryData(a: Architecture) {
  const m = a.backend!;
  for (const [name, owner, extras] of [
    [
      "reconciliation",
      "vc-payments",
      [
        field("targetId", { type: "uuid" }),
        field("identity", { type: "text", minLength: 1, maxLength: 200 }),
        field("kind", {
          type: "text",
          enumValues: ["payment", "refund", "payout", "warehouse", "delivery"],
        }),
        field("state", { type: "text", enumValues: ["pending", "resolved", "manual"] }),
        field("contentHash", {
          type: "text",
          textConstraint: "sha256",
          minLength: 64,
          maxLength: 64,
        }),
      ],
    ],
    [
      "delivery",
      "vc-notifications",
      [
        field("notificationId", { type: "uuid" }),
        field("requestKey", { type: "text", minLength: 1, maxLength: 200 }),
        field("state", { type: "text", enumValues: ["pending", "sent", "unknown", "suppressed"] }),
      ],
    ],
  ] as const) {
    const fields = [
      field("id", { type: "uuid" }),
      field("scopeId", { type: "uuid" }),
      field("version", { type: "integer", minimum: 1, maximum: 9007199254740991 }),
      field("createdAt", { type: "timestamp" }),
      ...extras,
    ];
    a.contracts!.push({
      id: `vc-${name}-data`,
      version: "v1",
      name: `Durable ${name}`,
      kind: "data",
      coverage: "Complete",
      description:
        "Exact durable identity/state; no credentials, arbitrary source bytes or mutable commercial snapshots.",
      shape: { payload: fields, operations: [] },
    });
    a.datasets!.push({
      id: `vc-${name}-dataset`,
      name: `Durable ${name}`,
      contract: ref(`vc-${name}-data`),
      owners: [{ kind: "element", id: "vc-api" }],
      writers: [{ kind: "component", id: owner }],
      readers: [
        { kind: "element", id: "vc-api" },
        { kind: "element", id: "vc-worker" },
      ],
      store: "vc-db",
      ownershipDecision:
        "Commerce API authority; bounded worker modules only. No provider/byte atomicity.",
      tenant: "Tenant scoped",
      deletion: "Retain",
      exportAccess: "Authorized staff",
    });
    m.entities.push({
      id: `vc-${name}-entity`,
      version: "v1",
      name: `Durable ${name}`,
      dataset: `vc-${name}-dataset`,
      contract: ref(`vc-${name}-data`),
      storageId: `vc-${name}-table`,
      fields: fields.map((f) => ({
        field: f.id,
        storageId: `${f.id}-column`,
        required: true,
        nullable: false,
        storage: { kind: "scalar" },
        ...(({ id: "id", "scope-id": "scope", version: "version", "created-at": "clock" } as const)[
          f.id as "id"
        ]
          ? {
              serverOwned: (
                {
                  id: "id",
                  "scope-id": "scope",
                  version: "version",
                  "created-at": "clock",
                } as const
              )[f.id as "id"],
            }
          : {}),
      })),
      primaryKey: ["id"],
      scope: { kind: "field", field: "scope-id" },
      relations: [],
      uniqueKeys: [
        {
          id: "identity",
          fields: [name === "delivery" ? "request-key" : "identity"],
          scope: "entity-scope",
          nulls: "forbidden",
        },
      ],
      indexes: [],
    });
    m.aggregates.push({
      id: `vc-${name}-aggregate`,
      version: "v1",
      name: `Durable ${name}`,
      root: ref(`vc-${name}-entity`),
      children: [],
      owner: { kind: "element", id: "vc-api" },
      store: "vc-db",
      concurrency: {
        kind: "optimistic",
        version: { entity: ref(`vc-${name}-entity`), field: "version" },
      },
      invariants: [],
    });
    const base = structuredClone(
      m.accessPolicies!.find((p) => p.id === "vc-payment-admin-policy")!,
    );
    base.id = `vc-${name}-policy`;
    base.name = `Protected ${name}`;
    base.resource = ref(`vc-${name}-entity`);
    base.clauses = base.clauses.filter((c) => ["authenticated", "admin"].includes(c.id));
    base.rules = base.rules.map((r) => ({
      ...r,
      when: { operator: "all", clauses: ["authenticated", "admin"] },
    }));
    base.projections = base.projections.map((p) => ({
      ...p,
      fields: fields
        .filter(
          (f) => p.mode === "read" || !["id", "scope-id", "version", "created-at"].includes(f.id),
        )
        .map((f) => f.id),
      when: { operator: "all", clauses: ["authenticated", "admin"] },
    }));
    m.accessPolicies!.push(base);
  }
}
