// Ported from automation-illustrator src/board/controls/PathKnotIcon.tsx (0803c4a).
// The `---` tab glyph: three equal round dashes, drawn as capsules (not a stroke dash array) so
// they stay even at tab size, and wider than thick so they read as a dashed line, not an
// ellipsis. Changes: the ink is `currentColor` (the tab's CSS sets it).
const DASH = 7.6;
const GAP = 2.4;
const THICK = 4.2;
const TOTAL = DASH * 3 + GAP * 2;
const X0 = (32 - TOTAL) / 2;
const Y = (32 - THICK) / 2;

export function DashGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={X0 + i * (DASH + GAP)}
          y={Y}
          width={DASH}
          height={THICK}
          rx={THICK / 2}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
