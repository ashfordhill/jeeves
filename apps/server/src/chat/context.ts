/**
 * What the design chat agent is told (PLAN §7): its rules, a short template catalog, the current
 * design summary, and the selection. Full template details are fetched on demand with tools.
 */
import type { Registry } from "@jeeves/registry";
import type { DesignDocument, Finding } from "@jeeves/spec";

export const INSTRUCTIONS = `You are the design assistant in Jeeves, a tool that turns a software design into a working, tested application.

You edit the design on the Draw Jeeves board. The design has:
- elements: design-level boxes (a service, a frontend, a database, ...), each backed by a template from the registry;
- attachments: capabilities added to an element, such as a REST API server or a REST API client, each backed by an attachment template;
- connections: typed arrows between elements or attachments (uses-database, calls, depends-on);
- annotations: text, notes, and frames that never affect generation;
- per element and attachment: config (validated by the template) and implementation notes (free Markdown describing what to build).

You know software design and coding, but you never implement anything. Later steps generate a template project from the design and coding agents implement the notes.

Rules:
- Use only templates that listTemplates returns. Never invent template IDs, versions, or config keys. Call describeTemplate before setting config or connecting ports you haven't seen yet.
- If the person needs a capability no template provides, add an element with "template": null (it shows as "needs a template") and put the requirement in its notes.
- Make all changes with applyOperations. A batch applies all-or-nothing; if it's refused, read the errors, fix the ops, and try again. IDs are lowercase slugs you choose (e.g. "links-db"); they must be unique across the design.
- Write implementation notes that a coding agent can act on: endpoints, data, behavior, edge cases.
- Ask with askUser only when the answer would change the design materially. Offer short, concrete choices. After askUser, end your turn.
- When you're done, reply briefly: what you changed and anything still open (e.g. findings). Don't repeat the whole design.
- Messages that start with "[Jeeves]" come from Jeeves itself, not the person.`;

/** The registry's latest templates, one line each. */
export function catalogSummary(registry: Registry): string {
  const latest = new Map(registry.list().map((m) => [m.id, m]));
  return [...latest.values()]
    .map((m) => {
      const kind = m.kind === "element" ? `element, ${m.elementKind}` : "attachment";
      return `- ${m.id}@${m.version} (${kind}): ${m.displayName}. ${m.description}`;
    })
    .join("\n");
}

export function designSummary(design: DesignDocument, findings: readonly Finding[]): string {
  if (design.elements.length === 0 && design.annotations.length === 0) {
    return `The design is empty (revision ${design.revision}).`;
  }
  const lines = [`Design at revision ${design.revision}:`];
  lines.push("Elements:");
  for (const element of design.elements) {
    const template = element.template
      ? `${element.template.id}@${element.template.version}`
      : "needs a template";
    const config = Object.keys(element.config).length
      ? ` config ${JSON.stringify(element.config)}`
      : "";
    lines.push(
      `- ${element.id} "${element.name}" [${template}]${config}${notesHint(element.notes)}`,
    );
    for (const attachment of element.attachments) {
      const attConfig = Object.keys(attachment.config).length
        ? ` config ${JSON.stringify(attachment.config)}`
        : "";
      lines.push(
        `  - attachment ${attachment.id} [${attachment.template.id}@${attachment.template.version}]${attConfig}${notesHint(attachment.notes)}`,
      );
    }
  }
  if (design.connections.length) {
    lines.push("Connections:");
    for (const c of design.connections) {
      lines.push(`- ${c.id}: ${endpoint(c.from)} ${c.kind} → ${endpoint(c.to)}`);
    }
  }
  if (design.annotations.length) {
    lines.push(`Annotations: ${design.annotations.map((a) => `${a.id} (${a.kind})`).join(", ")}`);
  }
  lines.push(
    findings.length
      ? `Findings:\n${findings.map((f) => `- ${f.code}: ${f.message}`).join("\n")}`
      : "No findings.",
  );
  return lines.join("\n");
}

/** The per-turn context message: catalog, design, and selection. */
export function turnContext(
  registry: Registry,
  design: DesignDocument,
  findings: readonly Finding[],
  selection: readonly string[],
): string {
  return [
    "[Jeeves] Context for this message.",
    `Templates:\n${catalogSummary(registry)}`,
    designSummary(design, findings),
    selection.length ? `Selected on the board: ${selection.join(", ")}` : "Nothing is selected.",
  ].join("\n\n");
}

function endpoint(e: { element: string; attachment?: string }) {
  return e.attachment ? `${e.element}/${e.attachment}` : e.element;
}

function notesHint(notes: string) {
  if (!notes) return "";
  const firstLine = notes.split("\n")[0] ?? "";
  return ` notes: "${firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine}"${notes.length > firstLine.length ? " (more)" : ""}`;
}
