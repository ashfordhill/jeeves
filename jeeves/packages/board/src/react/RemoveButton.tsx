// Ported from automation-illustrator src/board/controls/TileChrome.tsx (0803c4a), the X button.
// The red X that removes the selected tile or line: round, faint until the pointer is on it.
// Changes: the glyph is drawn inline (Tabler's IconX path) and it also sits on a selected line.
import type { CSSProperties } from "react";

export function RemoveButton({
  label,
  onRemove,
  className,
  style,
  onPointerEnter,
  onPointerLeave,
}: {
  /** Accessible name and tooltip, such as "Remove CDN". */
  label: string;
  onRemove: () => void;
  className?: string;
  style?: CSSProperties;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}) {
  return (
    <button
      type="button"
      className={`board-remove nopan nowheel${className ? ` ${className}` : ""}`}
      aria-label={label}
      title={label}
      style={style}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onRemove();
      }}
    >
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        focusable="false"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  );
}
