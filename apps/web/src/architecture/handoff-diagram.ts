import {
  type ArchitectureProjection,
  type HandoffDiagram,
  handoffDiagramSchema,
  handoffHash,
} from "@jeeves/spec";

/** Capture the actual selected view after layout: world geometry excludes the camera transform. */
export async function captureHandoffDiagram(
  root: HTMLElement,
  projection: ArchitectureProjection,
  view: string,
  scenario?: HandoffDiagram["scenario"],
): Promise<HandoffDiagram> {
  const viewport = root.querySelector<HTMLElement>(".react-flow__viewport");
  if (root.querySelector('.architecture-graph[aria-busy="true"]'))
    throw new Error("Wait for the selected diagram to finish loading.");
  if (!viewport) throw new Error("Wait for the selected diagram to finish loading.");
  const matrix = new DOMMatrix(viewport.style.transform || getComputedStyle(viewport).transform);
  const origin = viewport.getBoundingClientRect();
  const round = (n: number) => Math.round(n * 100) / 100;
  const box = (node: Element) => {
    const r = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const dimension = (axis: "width" | "height") => {
      const extra =
        style.boxSizing === "border-box"
          ? 0
          : axis === "width"
            ? parseFloat(style.paddingLeft) +
              parseFloat(style.paddingRight) +
              parseFloat(style.borderLeftWidth) +
              parseFloat(style.borderRightWidth)
            : parseFloat(style.paddingTop) +
              parseFloat(style.paddingBottom) +
              parseFloat(style.borderTopWidth) +
              parseFloat(style.borderBottomWidth);
      return round(parseFloat(style[axis]) + extra);
    };
    const width = dimension("width"),
      height = dimension("height");
    let x = (r.x - origin.x) / matrix.a,
      y = (r.y - origin.y) / matrix.d;
    const element = node as HTMLElement;
    if (node.classList.contains("react-flow__node")) {
      const transform = new DOMMatrix(element.style.transform);
      x = transform.e;
      y = transform.f;
    } else if (node.classList.contains("architecture-relation-label")) {
      x = parseFloat(element.style.left);
      y = parseFloat(element.style.top);
    } else if (node.classList.contains("edge-chip")) {
      const translate = [
        ...element.style.transform.matchAll(/translate\(([-\d.e+]+)px,\s*([-\d.e+]+)px\)/g),
      ].at(-1);
      if (translate) {
        x = Number(translate[1]) - width / 2;
        y = Number(translate[2]) - height / 2;
      }
    }
    return { x: round(x), y: round(y), width, height };
  };
  const byId = (selector: string, id: string) =>
    [...root.querySelectorAll<HTMLElement>(selector)].find((n) => n.dataset.id === id);
  const nodes = projection.nodes.map((node) => {
    const element =
      byId(".react-flow__node", node.id) ??
      byId(".react-flow__node", node.binding?.element ?? node.id.replace(/^context:/, ""));
    if (!element)
      throw new Error(
        `Diagram geometry is unavailable for ${node.name}. Select a complete view and retry.`,
      );
    return {
      id: node.id,
      name: node.name,
      description: node.description,
      technology: node.technology,
      support: node.support,
      box: box(element),
    };
  });
  const edges = projection.edges.map((edge) => {
    const element =
      byId(".react-flow__edge", edge.id) ??
      byId(".react-flow__edge", edge.connection ?? edge.context ?? edge.id);
    const pathElement = element?.querySelector<SVGPathElement>(".react-flow__edge-path");
    const rawPath = pathElement?.getAttribute("d");
    const path = rawPath?.replace(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi, (value) =>
      String(round(Number(value))),
    );
    const pathBox = pathElement?.getBBox();
    if (!path)
      throw new Error(
        `Diagram geometry is unavailable for ${edge.description}. Wait for layout and retry.`,
      );
    const label = [
      ...root.querySelectorAll<HTMLElement>(".architecture-relation-label, .edge-chip"),
    ].find(
      (n) => n.dataset.relationId === edge.id || n.dataset.edgeId === (edge.connection ?? edge.id),
    );
    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      description: edge.description,
      protocol: edge.protocol,
      planned:
        edge.planned ??
        nodes.some((n) => [edge.from, edge.to].includes(n.id) && n.support === "planned"),
      dash:
        (pathElement
          ? getComputedStyle(pathElement)
              .strokeDasharray.match(/[\d.]+/g)
              ?.map(Number)
          : undefined) ?? [],
      ...(label?.querySelector(".scenario-numbers") && {
        steps: label.querySelector(".scenario-numbers")!.textContent!.split(",").map(Number),
      }),
      line: (!pathElement || getComputedStyle(pathElement).strokeDasharray === "none"
        ? "solid"
        : getComputedStyle(pathElement).strokeDasharray.startsWith("2")
          ? "dotted"
          : "dashed") as "solid" | "dashed" | "dotted",
      path,
      ...(pathBox && {
        bounds: {
          x: round(pathBox.x),
          y: round(pathBox.y),
          width: Math.max(1, round(pathBox.width)),
          height: Math.max(1, round(pathBox.height)),
        },
      }),
      ...(label && { label: box(label) }),
    };
  });
  const groups = [...root.querySelectorAll<HTMLElement>(".architecture-scope-frame")].map(
    (node) => ({
      name: node.textContent?.trim() ?? "Scope",
      box: box(node),
    }),
  );
  const geometry = {
    view,
    title: projection.name,
    ...(scenario && { scenario }),
    nodes,
    edges,
    groups,
  };
  return handoffDiagramSchema.parse({
    ...geometry,
    layoutFingerprint: await handoffHash(geometry),
  });
}
const xml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const wrap = (s: string, limit: number, max: number) => {
  const lines: string[] = [];
  for (const word of s.split(/\s+/)) {
    if (!lines.length || lines[lines.length - 1]!.length + word.length > limit) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  return lines
    .slice(0, max)
    .map((line, i) =>
      i === max - 1 && lines.length > max ? `${line.slice(0, limit - 1)}…` : line,
    );
};
export function handoffSvg(input: HandoffDiagram, fingerprint: string) {
  const d = handoffDiagramSchema.parse(input);
  const boxes = [
    ...d.nodes.map((n) => n.box),
    ...d.groups.map((g) => g.box),
    ...d.edges.flatMap((e) => [...(e.label ? [e.label] : []), ...(e.bounds ? [e.bounds] : [])]),
  ];
  const left = Math.min(0, ...boxes.map((b) => b.x)) - 32,
    top = Math.min(0, ...boxes.map((b) => b.y)) - 100;
  const right = Math.max(400, ...boxes.map((b) => b.x + b.width)) + 48,
    bottom = Math.max(200, ...boxes.map((b) => b.y + b.height)) + 100;
  const text = (x: number, y: number, lines: string[], size = 14, weight = 400) =>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? size + 4 : 0}">${xml(line)}</tspan>`).join("")}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${right - left} ${bottom - top}" width="${right - left}" height="${bottom - top}" role="img" aria-labelledby="title desc"><title id="title">${xml(d.title)}</title><desc id="desc">Architecture intent. Design ${xml(fingerprint)}. Layout ${d.layoutFingerprint}. Planned responsibilities have no runtime implementation.</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker></defs><rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="#fffdf8"/><g font-family="Arial, sans-serif" fill="#182c3a">${text(left + 24, top + 32, [d.title], 22, 700)}${text(left + 24, top + 57, [`View: ${d.view}${d.scenario ? ` · ${d.scenario.name} / ${d.scenario.path}` : ""} · Unverified architecture intent`], 13)}${d.groups.map((g) => `<rect x="${g.box.x}" y="${g.box.y}" width="${g.box.width}" height="${g.box.height}" rx="12" fill="#eef3f6" stroke="#8294a5" stroke-dasharray="6 4"/>${text(g.box.x + 12, g.box.y + 22, [g.name], 14, 700)}`).join("")}${d.edges.map((e) => `<path d="${xml(e.path)}" fill="none" stroke="#475569" stroke-width="2" ${e.dash.length ? `stroke-dasharray="${e.dash.join(" ")}"` : ""} marker-end="url(#arrow)"/>`).join("")}${d.nodes.map((n) => `<g data-identity="${xml(n.id)}"><rect x="${n.box.x}" y="${n.box.y}" width="${n.box.width}" height="${n.box.height}" rx="10" fill="${n.support === "planned" ? "#edf3ff" : "#ffffff"}" stroke="#31576d" stroke-width="2" ${n.support === "planned" ? 'stroke-dasharray="6 3"' : ""}/>${text(n.box.x + 14, n.box.y + 27, wrap(n.name, Math.max(15, Math.floor(n.box.width / 9)), 2), 16, 700)}${text(n.box.x + 14, n.box.y + 71, wrap(n.description, Math.max(15, Math.floor(n.box.width / 8)), 3), 13)}${text(n.box.x + 14, n.box.y + n.box.height - 35, wrap(n.technology, Math.max(15, Math.floor(n.box.width / 8)), 1), 12)}${text(n.box.x + 14, n.box.y + n.box.height - 15, [n.support === "planned" ? "PLANNED · implementation required" : n.support], 12, 700)}</g>`).join("")}${d.edges
    .map((e) => {
      const b = e.label;
      if (!b) return "";
      return `<g><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="4" fill="#fffdf8"/>${text(b.x + 5, b.y + 16, wrap(`${e.steps?.length ? `${e.steps.join(", ")}. ` : ""}${e.description}${e.protocol ? ` · ${e.protocol}` : ""}`, Math.max(10, Math.floor(b.width / 8)), Math.max(1, Math.floor(b.height / 17))), 12)}</g>`;
    })
    .join(
      "",
    )}${text(left + 24, bottom - 50, [d.view === "context" ? "Legend: arrows show authored direction; dashed relationships = declared context intent." : "Legend: arrows show authored direction; dashed relationships = asynchronous; dotted = streaming.", "PLANNED labels are intent. Template availability and runtime verification remain separate."], 13)}</g></svg>\n`;
}
