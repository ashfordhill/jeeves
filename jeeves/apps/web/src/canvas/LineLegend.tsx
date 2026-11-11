/**
 * Relationship notation at screen size: only the dashed sample, Async (D7, contract question 12).
 * Solid is the default reading and needs no sample, and there is no help text. It only informs,
 * so the pointer passes through it to the board.
 */
export function LineLegend() {
  return (
    <div className="lane-line-legend" role="note" aria-label="Line guide">
      <svg width="30" height="14" viewBox="0 0 30 14" aria-hidden="true">
        <path d="M 1 7 H 27" strokeDasharray="5 3" />
        <path d="m 21 2 6 5-6 5" />
      </svg>
      Async
    </div>
  );
}
