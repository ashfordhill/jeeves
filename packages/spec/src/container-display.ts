/** C4 display defaults, independent of manifests, pins and generated configuration. */
import type { Element } from "./design.ts";
import { plannedCapability } from "./planned-capabilities.ts";

export const templateTechnology: Readonly<Record<string, string>> = {
  "http-service": "Node.js · Fastify",
  "web-app": "React · Vite",
  postgres: "PostgreSQL 17",
  "rest-api-server": "HTTP · OpenAPI",
  "rest-api-client": "TypeScript · OpenAPI Fetch",
  "resource-workspace": "React · TypeScript",
  "durable-events": "PostgreSQL · Node.js",
  "local-execution": "Docker Compose",
  "local-http-pool": "Node.js · HTTP",
};

export function containerTechnology(element: Element): string {
  const capability = plannedCapability(element.planned);
  if (!capability) {
    const value = templateTechnology[element.template?.id ?? ""];
    return typeof value === "string" ? value : "Technology unspecified";
  }
  const engine = capability.fields.find((field) => field.key === "engine");
  return (
    element.technology?.trim() ||
    String(element.config.engine ?? engine?.default ?? "Technology unspecified")
  );
}

export function containerDescription(element: Element): string {
  if (element.description?.trim()) return element.description.trim();
  const planned = plannedCapability(element.planned);
  if (planned) return planned.description;
  const value = {
    "http-service": "Application runtime and its declared responsibilities.",
    "web-app": "Browser application and user interactions.",
    postgres: "Persistent data store for connected applications.",
  }[element.template?.id ?? ""];
  return typeof value === "string" ? value : "Describe this container's responsibility.";
}
