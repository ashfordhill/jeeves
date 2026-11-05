import { validateArchitecture } from "./architecture.ts";
import { containerClassification } from "./architecture-choices.ts";
import { type DesignDocument, type DesignIdType, designIdNouns, designIds } from "./design.ts";
import { type Finding, finding } from "./findings.ts";

/** Every finding for a studio design: identities, references, C1 context and studio settings. */
export function validateDesign(design: DesignDocument): Finding[] {
  const findings: Finding[] = validateArchitecture(design);

  const seen = new Map<string, DesignIdType>();
  for (const { id, type } of designIds(design)) {
    const previous = seen.get(id);
    if (previous) {
      findings.push(
        finding(
          "DUPLICATE_ID",
          `ID "${id}" is used by ${designIdNouns[previous]} and ${designIdNouns[type]}.`,
          type === "package" || type === "entry"
            ? { path: ["architecture", "studio", type === "package" ? "packages" : "entries", id] }
            : { [type]: id },
        ),
      );
    } else {
      seen.set(id, type);
    }
  }

  const bound = new Set(design.architecture?.studio?.elements.map((item) => item.element));
  for (const element of design.elements) {
    if (!bound.has(element.id))
      findings.push(
        finding("CONFIG_INVALID", `"${element.name}" has no studio settings.`, {
          element: element.id,
        }),
      );
    const classification = containerClassification(element);
    if (
      classification.kind === "External system" &&
      classification.ownership === "System responsibility"
    )
      findings.push(
        finding(
          "CONFIG_INVALID",
          "An external system cannot be a system-owned responsibility; choose Application or Data store.",
          { element: element.id, path: ["classification"] },
        ),
      );
  }

  const elements = new Set(design.elements.map((element) => element.id));
  for (const connection of design.connections) {
    const target = { connection: connection.id };
    const ends = [connection.from.element, connection.to.element];
    for (const end of ends)
      if (!elements.has(end))
        findings.push(
          finding(
            "UNKNOWN_REFERENCE",
            `Connection "${connection.id}" refers to missing element "${end}".`,
            target,
          ),
        );
    if (connection.from.element === connection.to.element)
      findings.push(
        finding("CONFIG_INVALID", "Connect two different applications or stores.", target),
      );
  }

  return findings;
}
