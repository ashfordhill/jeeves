/** Relationship notation stays at screen size; the mouse opens its direction convention. */
export function LineLegend() {
  const sample = (dashed: boolean) => (
    <svg width="30" height="14" viewBox="0 0 30 14" aria-hidden="true">
      <path d="M 1 7 H 27" strokeDasharray={dashed ? "5 3" : undefined} />
      <path d="m 21 2 6 5-6 5" />
    </svg>
  );
  return (
    <details className="lane-line-legend">
      <summary aria-label="Line guide">
        <span>{sample(false)}Request</span>
        <span>{sample(true)}Async</span>
      </summary>
      <p>Solid: caller → target, including reads. Arrows show calls, not the return of data.</p>
      <p>
        Dashed: publisher → channel → consumer. Direct asynchronous calls point sender → receiver.
      </p>
      <p>Click a line for its label and inferred access.</p>
    </details>
  );
}
