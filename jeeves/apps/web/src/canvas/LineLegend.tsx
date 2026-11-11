/**
 * Relationship notation stays at screen size. Collapsed, it shows only the dashed sample (Async);
 * the mouse opens what solid and dashed mean and the direction conventions.
 */
export function LineLegend() {
  return (
    <details className="lane-line-legend">
      <summary aria-label="Line guide">
        <span>
          <svg width="30" height="14" viewBox="0 0 30 14" aria-hidden="true">
            <path d="M 1 7 H 27" strokeDasharray="5 3" />
            <path d="m 21 2 6 5-6 5" />
          </svg>
          Async
        </span>
      </summary>
      <p>
        Solid: a direct call; the caller waits (HTTP, a database, storage or cache read or write).
      </p>
      <p>Dashed: sent through a queue or topic; nobody waits.</p>
      <p>
        Arrows point caller → target, including reads; dashed ones publisher → channel → consumer.
      </p>
      <p>Click a line for its label. Gaps at crossings mean separate routes.</p>
      <p>Select a tile to highlight its lines, or choose a route where lines overlap.</p>
    </details>
  );
}
