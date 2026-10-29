/**
 * Every finding in the design. Clicking one selects what it's about on the board, brings it into
 * view, and opens it in the inspector, where the offending field is marked.
 */
import { IconCircleCheck } from "@tabler/icons-react";
import { findingSubject, placeFinding } from "../findings.ts";
import { useDraw } from "../store.ts";
import { FindingList } from "./Inspector.tsx";

export function FindingsPanel() {
  const loaded = useDraw((s) => s.loaded);
  const focus = useDraw((s) => s.focus);
  const setRailTab = useDraw((s) => s.setRailTab);
  if (!loaded) return null;
  const { design, findings, templates } = loaded;
  if (findings.length === 0) {
    return (
      <div className="inspector-body findings-clear" role="status">
        <IconCircleCheck size={28} aria-hidden />
        <p>No findings. The design is ready to generate.</p>
      </div>
    );
  }
  return (
    <section className="inspector-body" aria-label="All findings">
      <p className="inspector-empty">
        Generate needs these fixed. Click one to open it in the inspector.
      </p>
      <FindingList
        findings={findings}
        subject={(f) => findingSubject(design, templates, f)}
        onSelect={(f) => {
          const place = placeFinding(design, f);
          focus(
            { nodes: place.node ? [place.node] : [], edges: place.edge ? [place.edge] : [] },
            { zoom: true },
          );
          setRailTab("inspector");
        }}
      />
    </section>
  );
}
