/** Explicit adapter contracts. Planned interfaces establish no provider availability. */
import type { Architecture } from "./architecture.ts";
import type { ContractField, ContractValue } from "./architecture-contracts.ts";
import { dcRef } from "./discourse-core-data.ts";

const field = (name: string, value: ContractValue, required = true): ContractField => ({
  id: name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
  name,
  required,
  description: "",
  ...value,
});
const uuid: ContractValue = { type: "uuid" },
  key: ContractValue = { type: "text", minLength: 1, maxLength: 200 };
export function discourseCoreAdapters(model: Architecture) {
  const bytes = {
    id: "dc-private-bytes",
    version: "v1",
    name: "Private byte-store adapter",
    kind: "in-process" as const,
    coverage: "Partial" as const,
    description:
      "Explicit provider boundary. Bytes and SQL do not share atomicity; stream references are bounded process-owned handles, not public download authority. P71b owns lifecycle/settings/recovery bindings.",
    shape: {
      payload: [],
      operations: [
        {
          id: "write-object",
          name: "Stage verified bytes",
          description:
            "Outside SQL. Actual size/MIME/hash must match the declared metadata; partial writes remain unavailable.",
          input: [
            field("scopeId", uuid),
            field("objectKey", key),
            field("streamId", uuid),
            field("mime", { type: "text", enumValues: ["text/plain", "image/png"] }),
            field("size", { type: "integer", minimum: 1, maximum: 10485760 }),
            field("sha256", {
              type: "text",
              textConstraint: "sha256",
              minLength: 64,
              maxLength: 64,
            }),
          ],
          output: [
            field("state", { type: "text", enumValues: ["validated", "incomplete", "uncertain"] }),
          ],
        },
        {
          id: "read-object",
          name: "Read authorized private bytes",
          description:
            "Caller rechecks current attachment association/parent policy before proxying each byte request. No signed/public URL grant.",
          input: [field("scopeId", uuid), field("objectKey", key)],
          output: [
            field("streamId", uuid),
            field("mime", { type: "text", enumValues: ["text/plain", "image/png"] }),
            field("size", { type: "integer", minimum: 1, maximum: 10485760 }),
          ],
        },
        {
          id: "delete-orphan",
          name: "Delete selected eligible orphan",
          description:
            "Only an exact object unlinked/incomplete for at least 24h after current association/claim recheck; never broad prefix deletion.",
          input: [
            field("scopeId", uuid),
            field("objectKey", key),
            field("expectedVersion", { type: "integer", minimum: 1, maximum: 2147483647 }),
          ],
          output: [
            field("state", { type: "text", enumValues: ["deleted", "retained", "uncertain"] }),
          ],
        },
      ],
    },
  };
  const email = {
    id: "dc-email-delivery",
    version: "v1",
    name: "External email delivery adapter",
    kind: "in-process" as const,
    coverage: "Partial" as const,
    description:
      "External delivery outside SQL; Message-ID is not exactly-once. Stable logical identity and unknown outcome must survive retries; P71b owns typed delivery/reconciliation settings.",
    shape: {
      payload: [],
      operations: [
        {
          id: "deliver-email",
          name: "Deliver eligible email",
          description:
            "Recheck current recipient access/preferences immediately before send. An uncertain result requires reconciliation, not a new send identity.",
          input: [
            field("deliveryId", { type: "text", minLength: 1, maxLength: 128 }),
            field("recipient", { type: "text", textConstraint: "email", maxLength: 254 }),
            field("messageId", key),
            field("text", { type: "text", minLength: 1, maxLength: 20000 }),
          ],
          output: [
            field("state", { type: "text", enumValues: ["sent", "rejected", "uncertain"] }),
            field("providerRef", key, false),
          ],
        },
      ],
    },
  };
  model.contracts!.push(bytes, email);
  const bind = (
    contract: { id: string; version: string; name: string },
    provider: string,
    consumer: string,
    connection: string,
    id: string,
    role: "read" | "write" | "request",
    async = false,
  ) => {
    const provided = `${contract.id}-${provider}-provided`;
    if (!model.interfaces!.some((i) => i.id === provided))
      model.interfaces!.push({
        id: provided,
        name: contract.name,
        owner: { kind: "element", id: provider },
        direction: "provided",
        necessity: "required",
        contract: dcRef(contract.id),
      });
    model.interfaces!.push({
      id: `${id}-required`,
      name: contract.name,
      owner: { kind: "component", id: consumer },
      direction: "required",
      necessity: "required",
      contract: dcRef(contract.id),
    });
    model.bindings!.push({
      id,
      name: contract.name,
      relationship: { kind: "connection", id: connection },
      provided,
      required: `${id}-required`,
      contract: dcRef(contract.id),
      role,
      transport: provider === "dc-db" ? "SQL" : provider === "dc-files" ? "HTTPS/S3" : "SMTP/TLS",
      businessSynchrony: async ? "Asynchronous" : "Synchronous",
      policies: { access: { identity: "Service", tenant: "Tenant scoped", network: "Private" } },
    });
  };
  bind(bytes, "dc-files", "dc-attachments", "dc-api-files", "dc-private-bytes-api", "request");
  bind(bytes, "dc-files", "dc-cleanup", "dc-worker-files", "dc-private-bytes-cleanup", "request");
  bind(email, "dc-email", "dc-notifications", "dc-worker-email", "dc-email-send", "request", true);
  for (const dataset of model.datasets ?? []) {
    const owner = dataset.writers[0];
    if (owner?.kind !== "component") continue;
    bind(
      { ...dataset.contract, name: dataset.name },
      "dc-db",
      owner.id,
      owner.id === "dc-notifications" || owner.id === "dc-mail" ? "dc-worker-db" : "dc-api-db",
      `${dataset.id}-storage`,
      "write",
    );
  }
}
