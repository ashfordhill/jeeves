/**
 * Every finding in the design. Clicking one selects what it's about on the board, brings it into
 * view, and opens it in the inspector, where the offending field is marked.
 */

import type { Finding } from "@jeeves/spec";
import { Button } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";
import { findingSubject, placeFinding } from "../findings.ts";
import { useDraw } from "../store.ts";
import { FindingList } from "./Inspector.tsx";

export function FindingsPanel({
  onNavigate,
  onReview,
}: {
  onNavigate?: (finding: Finding) => void;
  onReview?: () => void;
} = {}) {
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
        {onReview ? (
          <Button variant="default" onClick={onReview}>
            Open architecture review
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <section className="inspector-body" aria-label="All findings">
      {onReview ? (
        <Button variant="default" onClick={onReview}>
          Open architecture review
        </Button>
      ) : null}
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
          onNavigate?.(f);
        }}
      />
    </section>
  );
}
