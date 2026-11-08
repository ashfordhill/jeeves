// Ported from automation-illustrator src/board/tiles/HumanFigure.tsx (0803c4a).
// The stick-figure person on the actor tile. The artwork lives in human-figure.svg; the stroke is
// `currentColor`, set by `color`.
//
// Changes from automation-illustrator: no head crop and no accessories.
import humanMarkup from "./human-figure.svg?raw";
import { svgInner } from "./svgInner.ts";

const INNER = svgInner(humanMarkup);

export function HumanFigure({
  size = 44,
  color = "var(--ink)",
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size * 1.55}
      viewBox="0 0 40 64"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      aria-hidden
      color={color}
    >
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static artwork bundled from human-figure.svg. */}
      <g dangerouslySetInnerHTML={{ __html: INNER }} />
    </svg>
  );
}
