/** Explicit planned store/provider boundaries; these interfaces establish no runtime support. */
import type { Architecture } from "./architecture.ts";
import type { ArchitectureContract, ContractValue } from "./architecture-contracts.ts";
import { vcField as field, vcMoney, vcRef } from "./vendure-core-data.ts";

const uuid: ContractValue = { type: "uuid" },
  key: ContractValue = { type: "text", minLength: 1, maxLength: 200 };
export function vendureCoreAdapters(model: Architecture) {
  const bytes: ArchitectureContract = {
    id: "vc-byte-adapter",
    version: "v1",
    name: "Byte-store process adapter",
    kind: "in-process",
    coverage: "Partial",
    description:
      "Outside SQL. Process-owned stream handles are not public URLs or authorization. Caller checks exact current catalog publication or current order ownership/staff before each byte request. P72b owns bounded file settings and byte selection.",
    shape: {
      payload: [],
      operations: [
        {
          id: "read-object",
          name: "Proxy authorized bytes",
          description:
            "Explicit provider operation; current policy and exact durable identity are caller obligations.",
          input: [field("scopeId", uuid), field("objectKey", key)],
          output: [
            field("streamId", uuid),
            field("mime", { type: "text", enumValues: ["text/plain"] }),
            field("size", { type: "integer", minimum: 1, maximum: 10485760 }),
          ],
        },
      ],
    },
  };
  const email: ArchitectureContract = {
    id: "vc-email-adapter",
    version: "v1",
    name: "External delivery adapter",
    kind: "in-process",
    coverage: "Partial",
    description:
      "Stable logical delivery identity; uncertain send remains visible for reconciliation. Message-ID is not an exactly-once guarantee. Recheck current persisted recipient and order policy before send. No provider call belongs inside SQL.",
    shape: {
      payload: [],
      operations: [
        {
          id: "deliver",
          name: "Send currently eligible metadata",
          description:
            "Explicit provider operation; current policy and exact durable identity are caller obligations.",
          input: [
            field("deliveryId", key),
            field("recipientId", uuid),
            field("orderId", uuid),
            field("action", { type: "text", minLength: 1, maxLength: 200 }),
          ],
          output: [field("state", { type: "text", enumValues: ["sent", "rejected", "unknown"] })],
        },
      ],
    },
  };
  const provider: ArchitectureContract = {
    id: "vc-provider-adapter",
    version: "v1",
    name: "Durable payment provider boundary",
    kind: "in-process",
    coverage: "Partial",
    description:
      "P72a boundary only: exact reference-v1 and pinned Stripe wire semantics remain in frozen providers/callback contracts. P72b owns executable mappings, H19 and recovery. Stable request identity and immutable amount precede dispatch; no new key on uncertainty, no network transaction or automatic charge rollback.",
    shape: {
      payload: [],
      operations: [
        {
          id: "dispatch",
          name: "Dispatch durable typed attempt",
          description:
            "Explicit provider operation; current policy and exact durable identity are caller obligations.",
          input: [
            field("paymentId", uuid),
            field("orderId", uuid),
            field("scopeId", uuid),
            field("requestKey", key),
            field("amount", vcMoney()),
          ],
          output: [
            field("state", {
              type: "text",
              enumValues: ["settled", "failed", "pending", "unknown"],
            }),
            { ...field("providerId", key), nullable: true },
          ],
        },
        {
          id: "lookup",
          name: "Reconcile existing durable identity",
          description:
            "Explicit provider operation; current policy and exact durable identity are caller obligations.",
          input: [field("scopeId", uuid), field("paymentId", uuid), field("requestKey", key)],
          output: [
            field("state", {
              type: "text",
              enumValues: ["settled", "failed", "pending", "unknown"],
            }),
          ],
        },
      ],
    },
  };
  model.contracts!.push(bytes, email, provider);
  const bind = (
    contract: { id: string; version: string; name: string },
    provider: string,
    consumer: string,
    connection: string,
    id: string,
    role: "read" | "write" | "request",
    transport: string,
  ) => {
    const provided = `${contract.id}-${provider}-provided`;
    if (!model.interfaces!.some((i) => i.id === provided))
      model.interfaces!.push({
        id: provided,
        name: contract.name,
        owner: { kind: "element", id: provider },
        direction: "provided",
        necessity: "required",
        contract: vcRef(contract.id),
      });
    model.interfaces!.push({
      id: `${id}-required`,
      name: contract.name,
      owner: { kind: "component", id: consumer },
      direction: "required",
      necessity: "required",
      contract: vcRef(contract.id),
    });
    model.bindings!.push({
      id,
      name: contract.name,
      relationship: { kind: "connection", id: connection },
      provided,
      required: `${id}-required`,
      contract: vcRef(contract.id),
      role,
      transport,
      businessSynchrony: "Synchronous",
      policies: { access: { identity: "Service", tenant: "Tenant scoped", network: "Private" } },
    });
  };
  bind(bytes, "vc-files", "vc-catalog", "vc-api-files", "vc-catalog-bytes", "request", "HTTPS/S3");
  bind(bytes, "vc-files", "vc-orders", "vc-api-files", "vc-order-receipts", "request", "HTTPS/S3");
  bind(
    email,
    "vc-email",
    "vc-notifications",
    "vc-worker-email",
    "vc-delivery",
    "request",
    "SMTP/TLS",
  );
  bind(
    provider,
    "vc-payment",
    "vc-payments",
    "vc-api-payment",
    "vc-payment-provider",
    "request",
    "HTTPS/JSON",
  );
  for (const dataset of model.datasets!) {
    const owner = dataset.writers[0];
    if (owner?.kind !== "component") continue;
    bind(
      { ...dataset.contract, name: dataset.name },
      "vc-db",
      owner.id,
      owner.id === "vc-notifications" ? "vc-worker-db" : "vc-api-db",
      `${dataset.id}-storage`,
      "write",
      "SQL",
    );
  }
  // Original-byte callbacks are provider-to-API communications, not thin-client requests.
  for (const [contractId, operation, source, connection] of [
    ["vc-reference-events-api", "reference-callback", "vc-payment", "vc-payment-api"],
    ["vc-stripe-events-api", "stripe-callback", "vc-payment", "vc-payment-api"],
    ["vc-warehouse-events-api", "sync-inventory", "vc-warehouse", "vc-warehouse-api"],
  ]) {
    const contract = model.contracts!.find((c) => c.id === contractId)!;
    const required = `vc-${operation}-source-required`;
    model.interfaces!.push({
      id: required,
      name: `Authenticated ${operation}`,
      owner: { kind: "element", id: source! },
      direction: "required",
      necessity: "required",
      contract: vcRef(contract.id),
    });
    model.bindings!.push({
      id: `vc-${operation}-source-binding`,
      name: `Original-byte ${operation}`,
      relationship: { kind: "connection", id: connection! },
      provided: `${contract.id}-provided`,
      required,
      contract: vcRef(contract.id),
      role: "request",
      transport: "HTTPS/JSON",
      businessSynchrony: "Asynchronous",
      policies: { access: { identity: "Service", tenant: "Tenant scoped", network: "Public" } },
    });
  }
}
