/** Pool 0.1 eligibility is deliberately limited to generated session/owner resource behavior. */
import { z } from "zod";
import type { DesignDocument, Element } from "./design.ts";
import { localExecutionFor } from "./local-execution.ts";
import { resourceConfigSchema } from "./resources.ts";

export const localHttpPoolConfigSchema = z.strictObject({
  replicas: z.union([z.literal(2), z.literal(3)]).default(2),
});
export const localHttpPoolBindingSchema = z.strictObject({
  version: z.literal("0.1.0"),
  attachment: z.string(),
  replicas: z.union([z.literal(2), z.literal(3)]),
  port: z.int().min(1024).max(65535),
  instances: z.array(z.string()).min(2).max(3),
});
export type LocalHttpPoolBinding = z.infer<typeof localHttpPoolBindingSchema>;
export function localHttpPoolFor(element: Element): LocalHttpPoolBinding | undefined {
  const attachment = element.attachments.find(
    (a) => a.template.id === "local-http-pool" && a.template.version === "0.1.0",
  );
  const parsed = attachment && localHttpPoolConfigSchema.safeParse(attachment.config);
  if (!attachment || !parsed?.success) return undefined;
  return {
    version: "0.1.0",
    attachment: attachment.id,
    replicas: parsed.data.replicas,
    port: Number(element.config.port ?? 8080),
    instances: Array.from(
      { length: parsed.data.replicas },
      (_, i) => `${element.id}-instance-${i + 1}`,
    ),
  };
}
export function localHttpPoolProblems(design: DesignDocument, element: Element): string[] {
  if (!element.attachments.some((a) => a.template.id === "local-http-pool")) return [];
  const issues: string[] = [];
  if (element.template?.id !== "http-service" || element.template.version !== "0.4.0")
    issues.push("Upgrade this HTTP service to 0.4.0 before adding a local pool.");
  if (design.recipe)
    issues.push("Protected recipes require a separately reviewed release before adding a pool.");
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(element.id) || element.id.length > 40)
    issues.push(
      "Local pool service IDs must use at most 40 lowercase letters, numbers and hyphens.",
    );
  const port = Number(element.config.port ?? 8080);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    issues.push("Local pools require an unprivileged port from 1024 to 65535.");
  if (Number(element.config.replicas ?? 1) !== 1)
    issues.push(
      "Set the legacy Replicas hint to one; the local pool policy controls the actual instance count.",
    );
  if (!localExecutionFor(element))
    issues.push("Add and configure a local execution policy for every application instance.");
  if (element.notes.trim())
    issues.push(
      "Local pools support generated resources only; service implementation notes require separate review.",
    );
  for (const attachment of element.attachments) {
    if (!["rest-api-server", "local-execution", "local-http-pool"].includes(attachment.template.id))
      issues.push(`Capability ${attachment.template.id} is not eligible for local pool 0.1.0.`);
  }
  const rest = element.attachments.find((a) => a.template.id === "rest-api-server");
  if (rest && rest.template.version !== "0.1.0")
    issues.push("Local pool 0.1.0 requires the reviewed REST API server 0.1.0 capability.");
  if (rest?.notes.trim())
    issues.push(
      "Resource implementation notes require review before local pooling; keep this API on generated operations only.",
    );
  const model = resourceConfigSchema.safeParse(rest?.config.model);
  if (
    !rest ||
    rest.config.auth !== "session" ||
    !model.success ||
    model.data.resources.length === 0
  )
    issues.push("Configure session-backed owned resources on one Postgres store before pooling.");
  if (model.success) {
    if (model.data.resources.some((resource) => resource.access !== "owner"))
      issues.push("Local pool 0.1.0 supports owner-scoped resources only.");
    if (model.data.extensions.length)
      issues.push(
        "Domain extensions need their own state/lifecycle review; local pool 0.1.0 supports generated operations only.",
      );
    const stores = design.connections.filter(
      (c) => c.kind === "uses-database" && c.from.element === element.id,
    );
    const database = design.elements.find((e) => e.id === stores[0]?.to.element);
    if (database?.template?.id === "postgres" && database.template.version !== "0.1.0")
      issues.push("Local pool 0.1.0 requires the reviewed Postgres 0.1.0 template.");
    if (
      stores.length !== 1 ||
      stores[0]?.id !== model.data.storeConnection ||
      design.elements.find((e) => e.id === stores[0]?.to.element)?.template?.id !== "postgres"
    )
      issues.push("Select exactly one shared Postgres connection for this resource API.");
  }
  const pool = localHttpPoolFor(element);
  for (const instance of pool?.instances ?? [])
    if (design.elements.some((e) => e.id === instance))
      issues.push(`Deployment instance name ${instance} conflicts with an application element.`);
  return issues;
}
