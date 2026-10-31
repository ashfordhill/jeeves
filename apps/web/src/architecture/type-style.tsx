import {
  type ArchitectureViewNode,
  type DesignDocument,
  type Element,
  plannedCapability,
} from "@jeeves/spec";
import { TemplateIcon } from "../draw/TemplateIcon.tsx";

/** Presentation only. Identity and support/verification status are separate from family. */
export const typeStyles = {
  api: { label: "Application API", icon: "server" },
  client: { label: "Client", icon: "browser" },
  endpoint: { label: "API capability", icon: "api" },
  domain: { label: "Responsibility", icon: "puzzle" },
  data: { label: "Data store", icon: "database" },
  worker: { label: "Background processing", icon: "cpu" },
  messaging: { label: "Messaging", icon: "mail" },
  external: { label: "External system", icon: "world" },
  person: { label: "Person", icon: "user" },
  system: { label: "Software system", icon: "building" },
} as const;
export type TypeFamily = keyof typeof typeStyles;

export function templateFamily(id?: string): TypeFamily {
  switch (id) {
    case "http-service":
      return "api";
    case "web-app":
    case "resource-workspace":
      return "client";
    case "postgres":
      return "data";
    case "rest-api-server":
    case "rest-api-client":
      return "endpoint";
    case "durable-events":
      return "messaging";
    case "local-execution":
    case "local-http-pool":
      return "worker";
    default:
      return "domain";
  }
}
export function capabilityFamily(id: string): TypeFamily {
  const capability = plannedCapability(id);
  if (!capability) return "domain";
  if (capability.role === "external") return "external";
  if (capability.group === "Messaging") return "messaging";
  if (capability.scope === "component") return "domain";
  return (
    {
      frontend: "client",
      service: "api",
      worker: "worker",
      database: "data",
      external: "external",
    } as const
  )[capability.role];
}
export function elementFamily(element?: Element): TypeFamily {
  return element?.planned
    ? capabilityFamily(element.planned)
    : templateFamily(element?.template?.id);
}
export function nodeFamily(node: ArchitectureViewNode, design: DesignDocument): TypeFamily {
  if (node.kind === "person") return "person";
  if (node.kind === "system") return "system";
  if (node.kind === "external-system") return "external";
  if (node.binding?.component) return "domain";
  if (node.binding?.extension || node.binding?.resource || node.binding?.accounts)
    return "endpoint";
  const element = design.elements.find((item) => item.id === node.binding?.element);
  const attachment = element?.attachments.find((item) => item.id === node.binding?.attachment);
  return attachment ? templateFamily(attachment.template.id) : elementFamily(element);
}
export function TypeBadge({ family }: { family: TypeFamily }) {
  const style = typeStyles[family];
  return (
    <span className="type-badge" data-family={family}>
      <TemplateIcon name={style.icon} size={17} />
      {style.label}
    </span>
  );
}
export function TypeLegend() {
  return (
    <div className="type-legend">
      {(Object.keys(typeStyles) as TypeFamily[]).map((family) => (
        <TypeBadge key={family} family={family} />
      ))}
      <p>
        Color identifies type. A dashed border and Planned label mark planned capabilities; outlines
        mark selection and issue badges mark findings.
      </p>
    </div>
  );
}
