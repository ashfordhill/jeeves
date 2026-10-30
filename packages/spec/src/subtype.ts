import type { DesignDocument, Element } from "./design.ts";
import type { TemplateRef } from "./ids.ts";

export function subtypeDiscards(design: DesignDocument, element: Element): string[] {
  return [
    ...Object.keys(element.config)
      .sort()
      .map((key) => `configuration: ${key} = ${JSON.stringify(element.config[key])}`),
    ...element.attachments.map((a) => `component: ${a.id} (${a.template.id})`),
    ...design.connections
      .filter((c) => c.from.element === element.id || c.to.element === element.id)
      .map((c) => `connection: ${c.id} (${c.kind})`),
  ];
}
export function sameSubtype(a: TemplateRef | null, b: TemplateRef | null): boolean {
  return a?.id === b?.id && a?.version === b?.version;
}

/** Persisted review proposal: only a human UI action may submit its confirmation. */
export interface SubtypeReview {
  id: string;
  template: TemplateRef | null;
  revision: number;
  discarded: string[];
}
