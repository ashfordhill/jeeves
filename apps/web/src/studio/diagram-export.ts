/** Presentation-only capture of the actual selected studio view before leaving Design. */
import {
  type ArchitectureProjection,
  type HandoffDiagram,
  handoffDiagramSchema,
  handoffFingerprint,
  handoffHash,
  studioDefinitions,
  studioScopes,
  studioViews,
} from "@jeeves/spec";
import { create } from "zustand";
import { captureHandoffDiagram } from "../architecture/handoff-diagram.ts";
import { useDraw } from "../draw/store.ts";
import { studioPaths } from "./routing.ts";

type Captured = { revision: number; fingerprint: string; diagram: HandoffDiagram };
export const useStudioDiagram = create<{
  projects: Record<string, Captured>;
  errors: Record<string, string | undefined>;
}>(() => ({ projects: {}, errors: {} }));

export async function captureStudioDiagram() {
  const base = useDraw.getState().loaded;
  const root = document.querySelector<HTMLElement>(".studio-graph");
  if (!base || !root) return;
  try {
    await useDraw.getState().flushLayout();
    if (root.dataset.dragging === "true")
      throw new Error("Finish moving the card before exporting.");
    const views = studioViews(base.design, studioDefinitions, base.project.name);
    const scope = studioScopes(views).find((item) => item.key === root.dataset.scope);
    if (!scope) throw new Error("The selected scope is no longer available.");
    const paths = studioPaths(scope);
    const projection: ArchitectureProjection = {
      level: scope.level,
      name: scope.name,
      description: scope.description,
      resources: [],
      nodes: scope.nodes.map((node) => ({
        id: node.id,
        kind: "container",
        name: node.name,
        description: "",
        technology: "",
        support: "intent",
        acceptance: [],
      })),
      edges: paths.map((path) => ({
        id: path.id,
        from: path.item.from,
        to: path.item.to,
        description: path.item.actions.join("; "),
        protocol: path.item.protocols.join(", "),
        planned: false,
      })),
    };
    const captured = await captureHandoffDiagram(root, projection, scope.key);
    const byId = new Map(captured.edges.map((edge) => [edge.id, edge]));
    const visibleLabel = (id: string) => {
      const text = [...root.querySelectorAll<SVGTextElement>(".react-flow__edge text")].find(
        (item) => item.closest<HTMLElement>(".react-flow__edge")?.dataset.id === id,
      );
      if (!text || getComputedStyle(text).display === "none") return;
      const box = text.getBBox();
      return box.width && box.height
        ? { x: box.x, y: box.y, width: box.width, height: box.height }
        : undefined;
    };
    const geometry = {
      view: captured.view,
      title: captured.title,
      // Compact source cards have no exported availability badge or implementation claim.
      nodes: captured.nodes.map((node) => ({ ...node, support: "" })),
      edges: paths.map((path) => {
        const edge = byId.get(path.id);
        if (!edge) throw new Error("A selected relationship has no captured path.");
        // The drawn label is short (SG07); the export keeps the full description and protocol.
        const label = visibleLabel(path.id);
        return { ...edge, ...(label && { label }) };
      }),
      groups: captured.groups,
    };
    const diagram = handoffDiagramSchema.parse({
      ...geometry,
      layoutFingerprint: await handoffHash(geometry),
    });
    const fingerprint = await handoffFingerprint(base.design, base.project);
    const current = useDraw.getState().loaded;
    if (current?.project.id !== base.project.id || current.design.revision !== base.design.revision)
      throw new Error("The design changed during diagram capture. Return to Design and retry.");
    useStudioDiagram.setState((s) => ({
      projects: {
        ...s.projects,
        [base.project.id]: { revision: base.design.revision, fingerprint, diagram },
      },
      errors: { ...s.errors, [base.project.id]: undefined },
    }));
  } catch (e) {
    useStudioDiagram.setState((s) => {
      const projects = { ...s.projects };
      delete projects[base.project.id];
      return { projects, errors: { ...s.errors, [base.project.id]: (e as Error).message } };
    });
  }
}
