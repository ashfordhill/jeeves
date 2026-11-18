/**
 * Relationship notation at screen size: only the beaded sample, Async (D7, contract question 12).
 * Solid is the default reading and needs no sample, and there is no help text. It only informs,
 * so the pointer passes through it to the board.
 */
export function LineLegend() {
  return (
    <div className="lane-line-legend" role="note" aria-label="Line guide">
      <svg width="30" height="14" viewBox="0 0 30 14" aria-hidden="true">
        <path d="M 2 7 H 18" strokeDasharray="0.01 5" strokeLinecap="round" strokeWidth="3" />
        <path d="M 27 7 L 21 3.6 V 10.4 Z" fill="currentColor" strokeLinejoin="round" />
      </svg>
      Async
    </div>
  );
}
