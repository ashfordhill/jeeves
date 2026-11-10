// The board's connect mode gesture. Pressing on a tile and dragging past a few pixels draws a
// provisional line from the tile to the pointer, with an arrowhead at the pointer: the drag's
// direction is the new line's. The board dims, with holes for the tile and the tiles the caller
// allows as ends (`canConnect`), which stay bright with a dashed outline that thickens on the one
// under the pointer; on a refused tile the line turns the refusal colour and a tip by the pointer
// gives the caller's reason (`connectRefusal`). Releasing on an allowed tile connects the two
// (`onConnect`); on a refused tile it reports the refusal (`onConnectRefused`); on the tile itself
// or anywhere else, or after Escape, nothing happens. A press that never moves that far is a
// click, so it still selects. The click a drag would end with is swallowed, so a drag never
// selects. The paper still pans; tiles are `nopan`, so a press on one never does.
//
// The scrim is the attach tab's, ported from automation-illustrator src/board/controls/TileChrome.tsx
// (0803c4a). Its holes stop at the board's edge, so a tile under a side rail stays covered.
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { holeRect, rectExit, TARGET_PAD, tileScreenRect } from "./overlay.ts";

/** How far a press moves before it is a drag, not a click. */
export const CONNECT_THRESHOLD = 6;
/** The arrowhead's arms, in screen pixels. */
const ARROW = 14;

/** What connect mode may join, and what a release does; all four are the caller's. */
export type ConnectRules = {
  /** Whether a line dragged from `from` may end on `to`. Allowed tiles show through the scrim. */
  canConnect?: (from: string, to: string) => boolean;
  /** Why a line from `from` can't end on `to`, in words: the tip on that tile while the pointer is on it. */
  connectRefusal?: (from: string, to: string) => string | undefined;
  /** A drag from `from` was released on `to`, which `canConnect` allows. */
  onConnect?: (from: string, to: string) => void;
  /** A drag from `from` was released on `to`, which `canConnect` refuses. Nothing is connected. */
  onConnectRefused?: (from: string, to: string) => void;
};

/** A connect drag under way. */
export type ConnectDrag = {
  from: string;
  /** The pointer, in screen pixels. */
  x: number;
  y: number;
  /** The other tile under the pointer, if any. */
  over: string | null;
  /** The tiles `canConnect` allows, worked out when the drag starts. */
  targets: ReadonlySet<string>;
};

/** The tile a DOM node belongs to on this board, if any. */
function tileOf(host: HTMLElement, target: EventTarget | Element | null): string | undefined {
  const node = target instanceof Element ? target.closest<HTMLElement>(".react-flow__node") : null;
  return node && host.contains(node) ? node.dataset.id : undefined;
}

/** Stops the click that ends a drag (it would select whatever the pointer was released on). */
function swallowClick() {
  const stop = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener("click", stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", stop, true), 0);
}

/**
 * Connect mode's drag, while `enabled`: pressing on a tile inside `host` and moving starts it.
 * Returns the drag under way, or null. `others` lists the tiles that may be ends.
 */
export function useConnectDrag(
  host: RefObject<HTMLElement | null>,
  enabled: boolean,
  others: () => readonly string[],
  rules: ConnectRules,
): ConnectDrag | null {
  const [drag, setDrag] = useState<ConnectDrag | null>(null);
  const latest = useRef({ others, rules });
  latest.current = { others, rules };
  useEffect(() => {
    const el = host.current;
    if (!el || !enabled) return;
    let stop = () => {};
    const onDown = (down: PointerEvent) => {
      if (down.button !== 0 || down.isPrimary === false) return;
      const from = tileOf(el, down.target);
      if (!from) return;
      stop();
      /** Pressed (not yet a drag), dragging, or cancelled by Escape (waiting for the release). */
      let phase: "pressed" | "dragging" | "cancelled" = "pressed";
      let targets: ReadonlySet<string> = new Set();
      const finish = () => {
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onCancel, true);
        window.removeEventListener("keydown", onKey, true);
        stop = () => {};
        setDrag(null);
      };
      const overAt = (x: number, y: number) => {
        const over = tileOf(el, document.elementFromPoint(x, y));
        return over && over !== from ? over : null;
      };
      const onMove = (e: PointerEvent) => {
        if (phase === "cancelled") return;
        if (
          phase === "pressed" &&
          Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < CONNECT_THRESHOLD
        )
          return;
        if (phase === "pressed") {
          phase = "dragging";
          const { canConnect } = latest.current.rules;
          targets = new Set(
            latest.current.others().filter((id) => id !== from && canConnect?.(from, id) === true),
          );
        }
        setDrag({ from, x: e.clientX, y: e.clientY, over: overAt(e.clientX, e.clientY), targets });
      };
      const onUp = (e: PointerEvent) => {
        const was = phase;
        finish();
        if (was === "pressed") return;
        swallowClick();
        const over = was === "dragging" ? overAt(e.clientX, e.clientY) : null;
        if (!over) return;
        const { onConnect, onConnectRefused } = latest.current.rules;
        if (targets.has(over)) onConnect?.(from, over);
        else onConnectRefused?.(from, over);
      };
      const onCancel = () => finish();
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "Escape" || phase !== "dragging") return;
        e.preventDefault();
        e.stopPropagation();
        phase = "cancelled";
        setDrag(null);
      };
      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onCancel, true);
      window.addEventListener("keydown", onKey, true);
      stop = finish;
    };
    el.addEventListener("pointerdown", onDown, true);
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      stop();
    };
  }, [host, enabled]);
  return drag;
}

/** Two arms of an arrowhead at `tip`, pointing away from `from`. */
function arrowHead(from: { x: number; y: number }, tip: { x: number; y: number }): string {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const arm = (turn: number) =>
    `${tip.x - ARROW * Math.cos(angle + turn)} ${tip.y - ARROW * Math.sin(angle + turn)}`;
  return `M ${arm(0.45)} L ${tip.x} ${tip.y} L ${arm(-0.45)}`;
}

/** The screen-space layer of a connect drag: the scrim, the provisional line and the refusal tip. */
export function ConnectOverlay({
  drag,
  host,
  refusal,
}: {
  drag: ConnectDrag;
  host: RefObject<HTMLElement | null>;
  /** Why the tile under the pointer can't be the end, when it can't. */
  refusal?: string;
}) {
  const ids = useId();
  if (typeof document === "undefined") return null;
  const board = host.current?.getBoundingClientRect();
  const rect = (id: string) => tileScreenRect(host.current, id);
  const source = rect(drag.from);
  const holes = [drag.from, ...drag.targets].flatMap((id) => {
    const found = rect(id);
    return found ? [holeRect(found, id === drag.from ? 0 : TARGET_PAD)] : [];
  });
  const refused = drag.over !== null && !drag.targets.has(drag.over);
  const tip = { x: drag.x, y: drag.y };
  const start = source ? rectExit(source, tip) : tip;
  const scrimMask = `${ids}-scrim`;
  const boardClip = `${ids}-board`;
  return createPortal(
    <div className="board-overlay board-connect" aria-hidden>
      <svg className="board-scrim" width="100%" height="100%" aria-hidden>
        <defs>
          {board ? (
            <clipPath id={boardClip}>
              <rect x={board.x} y={board.y} width={board.width} height={board.height} />
            </clipPath>
          ) : null}
          <mask id={scrimMask} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="100%" height="100%" fill="white" />
            <g clipPath={board ? `url(#${boardClip})` : undefined}>
              {holes.map((hole) => (
                <rect key={`${hole.x},${hole.y}`} {...hole} fill="black" />
              ))}
            </g>
          </mask>
        </defs>
        <rect className="board-scrim-fill" width="100%" height="100%" mask={`url(#${scrimMask})`} />
      </svg>
      <svg className="board-connect-line" width="100%" height="100%" aria-hidden>
        <g data-refused={refused || undefined}>
          <line x1={start.x} y1={start.y} x2={tip.x} y2={tip.y} />
          <path d={arrowHead(start, tip)} fill="none" />
        </g>
      </svg>
      {refused && refusal ? (
        <span className="board-connect-tip" style={{ left: drag.x, top: drag.y }}>
          {refusal}
        </span>
      ) : null}
    </div>,
    document.body,
  );
}
