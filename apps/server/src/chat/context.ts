/**
 * What the design chat agent is told (PLAN §7): its rules, implemented/planned catalogs, the current
 * design summary, and the selection. Full schemas/options are fetched on demand with tools.
 */
import type { Registry } from "@jeeves/registry";
import { type DesignDocument, type Finding, plannedCapabilities } from "@jeeves/spec";

export const INSTRUCTIONS = `You are the design assistant in Jeeves, a tool that turns a software design into a working, tested application.

You edit the design on the Draw Jeeves board. The design has:
- elements: design-level boxes (a service, a frontend, a database, ...), backed by an implemented template or a planned library family;
- attachments: capabilities added to an element, such as a REST API server or a REST API client, each backed by an attachment template;
- connections: typed arrows between outer elements (uses-database, calls, depends-on). When a connection has several compatible capabilities, the inspector selects them; attachments are never semantic endpoints;
- annotations: text, notes, and frames that never affect generation;
- per element and attachment: config (validated by the template) and implementation notes (free Markdown describing what to build).

You know software design and coding, but you never implement anything. Later steps generate a template project from the design and coding agents implement the notes.

Rules:
- Use only templates that listTemplates returns. Never invent template IDs, versions, or config keys. Call describeTemplate before setting config or connecting ports you haven't seen yet.
- For architecture briefs such as "an app like bit.ly", use listPlannedCapabilities and describePlannedCapability to choose planned C2 containers and C3 responsibilities with their validated options. Use template:null plus planned:<container ID> and config on elements; use capability:<component ID> and config on architecture.components. Planned IDs are never template IDs. Do not mix runtime attachments into planned containers.
- Planning families provide design intent only: they have no runtime and block generation. Technology, traffic, availability and latency are proposals/targets, never implemented or verified claims. If the person requests a runnable application, explain gaps and use implemented templates where they fit.
- If no family fits, use a generic planned domain-module inside a compatible service/worker for a responsibility, or an element with template:null and no planned ID ("needs a template"). Describe the unsupported requirement in notes. Never invent planned IDs or option keys/values.
- Follow C4: C1 architecture.system, nodes (person/external-system) and relationships describe the system's purpose and actors with no technology. The system endpoint ID is "system". C2 elements have a name, one-line description and proposed technology, with at most 15 containers for an initial design. Keep external providers outside the system by choosing an external family; a C1 provider can reuse its C2 identity via node.container.
- C3 components scope one existing application via element:<host ID>; frontend families belong on frontend hosts, backend families on service/worker hosts. Supply a name, responsibility and proposed technology. Start with a few cohesive responsibilities (at most 10 per container), not UI widgets or data fields. Component dependencies must join two components within that same host.
- Label every relationship with a verb phrase such as "Reads and writes link records". C2/C3 relationships include a protocol and interaction ("Request / response", "Asynchronous" or "Streaming"); asynchronous flows are dashed by the view. C1 descriptions have no protocol/technology. Planned C2 connections use planned:{label,protocol,interaction,security}, with outer element endpoints. C3 usesConnections references existing connections, never invents wiring.
- setArchitecture replaces the entire architecture. Read getDesign first and preserve existing nodes, relationships, components and bindings when extending it. Apply elements and connections before the setArchitecture that references them. Context bindings describe traceability, never executable network calls.
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
  if (design.elements.length === 0 && design.annotations.length === 0 && !design.architecture) {
    return `The design is empty (revision ${design.revision}).`;
  }
  const lines = [`Design at revision ${design.revision}:`];
  lines.push("Elements:");
  for (const element of design.elements) {
    const template = element.template
      ? `${element.template.id}@${element.template.version}`
      : element.planned
        ? `planned:${element.planned} (no runtime)`
        : "needs a template";
    const config = Object.keys(element.config).length
      ? ` config ${JSON.stringify(element.config)}`
      : "";
    lines.push(
      `- ${element.id} "${element.name}" [${template}]${config}${element.description ? ` description: ${JSON.stringify(element.description)}` : ""}${element.technology ? ` technology: ${JSON.stringify(element.technology)}` : ""}${notesHint(element.notes)}`,
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
      lines.push(
        `- ${c.id}: ${endpoint(c.from)} ${c.kind} → ${endpoint(c.to)}${c.planned ? ` planned ${JSON.stringify(c.planned)}` : ` display ${JSON.stringify({ label: c.label, protocol: c.protocol, interaction: c.interaction })}`}`,
      );
    }
  }
  if (design.architecture) {
    lines.push(
      `Architecture (complete C1/C3; preserve entries when calling setArchitecture):\n${JSON.stringify(design.architecture)}`,
    );
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
    `Planning library (design only; no runtime; blocks generation). Read options with describePlannedCapability:\n${plannedCapabilities.map((entry) => `- ${entry.id} (${entry.scope}, ${entry.role}): ${entry.name}. ${entry.description}`).join("\n")}`,
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
