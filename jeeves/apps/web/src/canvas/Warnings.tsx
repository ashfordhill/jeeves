// Design warnings (`studioWarnings`): designs that look wrong but are allowed. A tile or action
// with one carries a small mark on its face (its tooltip is the message); its inspector lists
// them, and the system inspector lists every warning with a button that selects its tile.
// Warnings never block an edit.
import type { BoardSelection } from "@jeeves/board";
import type { StudioWarning } from "@jeeves/spec";
import { IconAlertTriangle } from "@tabler/icons-react";

/** The mark on a tile's face; `messages` are its warnings. */
export function WarningMark({ messages }: { messages?: readonly string[] }) {
  if (!messages?.length) return null;
  return (
    <span
      className="lane-warning-mark"
      role="img"
      aria-label={`Warning: ${messages.join(" ")}`}
      title={messages.join("\n")}
    >
      <IconAlertTriangle size={14} stroke={2.4} aria-hidden />
    </span>
  );
}

/**
 * A list of warnings. With `onSelect` and `name`, each names its tile as a button that selects
 * it (the system inspector); without, each is its message (a tile's or action's inspector).
 */
export function WarningList({
  warnings,
  name,
  onSelect,
}: {
  warnings: readonly StudioWarning[];
  name?: (id: string) => string;
  onSelect?: (next: BoardSelection) => void;
}) {
  if (!warnings.length) return null;
  return (
    <ul className="lane-warnings" aria-label="Warnings">
      {warnings.map((item) => (
        <li key={`${item.rule} ${item.node}`}>
          <IconAlertTriangle size={14} aria-hidden />
          <span>
            {onSelect && name ? (
              <button type="button" onClick={() => onSelect({ tile: item.node })}>
                {name(item.node)}
              </button>
            ) : null}
            {item.message}
          </span>
        </li>
      ))}
    </ul>
  );
}
