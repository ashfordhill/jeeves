/** Explicit compatibility decisions. Semver ordering alone never authorizes an upgrade. */
import type { DesignDocument } from "./design.ts";
import type { TemplateRef } from "./ids.ts";
import type { TemplateLookup } from "./manifest.ts";

export const compatibleTemplateUpgrades = [
  { id: "http-service", from: "0.1.0", to: "0.2.0" },
  { id: "http-service", from: "0.2.0", to: "0.3.0" },
  { id: "http-service", from: "0.1.0", to: "0.3.0" },
  { id: "http-service", from: "0.1.0", to: "0.4.0" },
  { id: "http-service", from: "0.2.0", to: "0.4.0" },
  { id: "http-service", from: "0.3.0", to: "0.4.0" },
  { id: "web-app", from: "0.1.0", to: "0.2.0" },
] as const;
export type TemplateUpgradeReview =
  | { ok: false; reason: string }
  | {
      ok: true;
      id: string;
      from: TemplateRef;
      to: TemplateRef;
      revision: number;
      available: string[];
      retained: { configuration: string[]; attachments: string[]; connections: string[] };
    };

export function reviewTemplateUpgrade(
  design: DesignDocument,
  id: string,
  to: TemplateRef,
  lookup: TemplateLookup,
): TemplateUpgradeReview {
  const no = (reason: string): TemplateUpgradeReview => ({ ok: false, reason });
  const element = design.elements.find((item) => item.id === id);
  if (!element?.template) return no("Select an existing element template before upgrading.");
  if (design.recipe)
    return no(
      "This application belongs to a protected recipe release. A template change requires a separately reviewed recipe upgrade.",
    );
  const from = element.template;
  if (
    from.id !== to.id ||
    !compatibleTemplateUpgrades.some(
      (path) => path.id === from.id && path.from === from.version && path.to === to.version,
    )
  )
    return no(
      `No reviewed compatible upgrade from ${from.id}@${from.version} to ${to.id}@${to.version}.`,
    );
  const current = lookup.get(from),
    target = lookup.get(to);
  if (
    current?.kind !== "element" ||
    target?.kind !== "element" ||
    current.elementKind !== target.elementKind
  )
    return no("Both versions must be available element templates of the same kind.");
  const before = current.config.safeParse(element.config),
    after = target.config.safeParse(element.config);
  if (!before.success || !after.success)
    return no("The stored configuration must be valid for both versions before upgrading.");
  if (JSON.stringify(before.data) !== JSON.stringify(after.data))
    return no("The target changes effective configuration defaults; this requires a migration.");
  if (JSON.stringify(current.ports) !== JSON.stringify(target.ports))
    return no("The target changes connection contracts; this requires a migration.");
  for (const attachment of element.attachments) {
    if (lookup.get(attachment.template)?.kind !== "attachment")
      return no(`Attachment ${attachment.id} has an unavailable template.`);
    const slot = target.attachmentSlots.find((item) => item.template === attachment.template.id);
    const count = element.attachments.filter(
      (item) => item.template.id === attachment.template.id,
    ).length;
    if (!slot || (slot.max !== undefined && count > slot.max))
      return no(`The target cannot retain attachment ${attachment.id}.`);
  }
  return {
    ok: true,
    id,
    from: { ...from },
    to: { ...to },
    revision: design.revision,
    available: target.attachmentSlots
      .filter((slot) => !current.attachmentSlots.some((old) => old.template === slot.template))
      .map((slot) => {
        const version = lookup.versions(slot.template).at(-1);
        return (
          (version && lookup.get({ id: slot.template, version })?.displayName) || slot.template
        );
      }),
    retained: {
      configuration: Object.keys(element.config).sort(),
      attachments: element.attachments.map((item) => item.id),
      connections: design.connections
        .filter((item) => item.from.element === id || item.to.element === id)
        .map((item) => item.id),
    },
  };
}
