// Ported from automation-illustrator src/board/controls/TileChrome.tsx (0803c4a).
// The selected tile's pull tabs: `+` (plus) and `---` (dash) on either side. Pulling a tab past
// 36px stretches a thick rubber band from under the tile face to the pointer, dims the board
// with a hole for the tile and opens the fan of items around the tab's resting place. Releasing
// over an item picks it; releasing over another tile drops on it (a link) when allowed; anywhere
// else, or Escape, springs back. Pointer capture stays on the tab, so panning never steals the
// gesture.
//
// Changes from automation-illustrator: the tabs, fan items and drop rules come from props; one
// tab both fans and drops (there, `+` only fans and the path tab only drops); a `---` tab's band
// is dashed; tiles the tab may drop on show through the scrim and the others stay dimmed; a
// refused drop is reported; Escape cancels and a cancelled pull springs back. The red X shows
// only when the caller lets the tile go (`remove`). No tile pickup or insert silhouette.
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { DockSide, Size, SlotOrder } from "../layout/metrics.ts";
import { DashGlyph } from "./DashGlyph.tsx";
import { fanCenters } from "./fan.ts";
import {
  fallbackTileRect,
  RIBBON_BORDER,
  type TileRect,
  taffyRibbon,
  tileScreenRect,
  underTileOrigin,
} from "./overlay.ts";
import { RemoveButton } from "./RemoveButton.tsx";
import { prefersReducedMotion } from "./useAnimatedLayout.ts";

export const PULL_THRESHOLD = 36;
export const SPRING_MS = 200;
/** Room around a drop target's hole in the scrim, for its outline. */
const TARGET_PAD = 14;

/** One item of a tab's fan: an icon, named by `label` (its accessible name and hover tip). */
export type FanItem = { id: string; label: string; content: ReactNode; shape?: "rect" | "pill" };

export type TabGlyph = "plus" | "dash";

/** A pull tab on the selected tile. */
export type TabSpec = {
  id: string;
  /** `after` sits on the right and fans right; `before` sits on the left and fans left. */
  side: DockSide;
  glyph: TabGlyph;
  /** Accessible name. */
  label: string;
  /** Tooltip; defaults to the label. */
  title?: string;
  /** A small mark on the tab's corner (an icon). */
  badge?: ReactNode;
  items: readonly FanItem[];
  /** The row a tile picked from this fan takes, next to an existing tile (a lane's last tile). */
  order?: SlotOrder;
};

/** What the board shows while a tab is pulled: the drop targets (once open) and the one under the pointer. */
export type PullState = { tab: string; targets: ReadonlySet<string> | null; over: string | null };

export type ChromeProps = {
  tile: string;
  size: Size;
  tabs: readonly TabSpec[];
  host: RefObject<HTMLElement | null>;
  /** Every other tile on the board. */
  others: () => readonly string[];
  canDrop: (tab: string, target: string) => boolean;
  onPull: (pull: PullState | null) => void;
  onPick: (tab: TabSpec, item: string) => void;
  onDrop: (tab: string, target: string) => void;
  onRefused: (tab: string, target: string) => void;
  /** The red X above the tile; none when the tile can't be removed. */
  remove?: { label: string; onRemove: () => void };
};

type Hover = { item: string } | { tile: string } | null;
type Drag = {
  x: number;
  y: number;
  restX: number;
  restY: number;
  tile: TileRect;
  /** False while springing back. */
  live: boolean;
  hover: Hover;
};

/** The same hole for the scrim and the band's exit: this tile's screen rect and radius. */
function holeRect(tile: TileRect, pad: number) {
  return {
    x: tile.x - pad,
    y: tile.y - pad,
    width: tile.w + pad * 2,
    height: tile.h + pad * 2,
    rx: tile.rx + pad,
  };
}

function TabGlyphMark({ glyph }: { glyph: TabGlyph }) {
  return glyph === "plus" ? <span aria-hidden>+</span> : <DashGlyph size={22} />;
}

export function TileChrome(props: ChromeProps) {
  const [active, setActive] = useState<string | null>(null);
  const sides: DockSide[] = ["before", "after"];
  return (
    <div className="board-chrome" data-pulling={active ? true : undefined}>
      {sides.map((side) => {
        const tabs = props.tabs.filter((tab) => tab.side === side);
        return tabs.length ? (
          <div key={side} className="board-tabs" data-side={side}>
            {tabs.map((tab) => (
              <PullTab key={tab.id} tab={tab} chrome={props} onActive={setActive} />
            ))}
          </div>
        ) : null;
      })}
      {props.remove ? (
        <RemoveButton
          className="board-remove-tile"
          label={props.remove.label}
          onRemove={props.remove.onRemove}
        />
      ) : null}
    </div>
  );
}

function PullTab({
  tab,
  chrome,
  onActive,
}: {
  tab: TabSpec;
  chrome: ChromeProps;
  onActive: (tab: string | null) => void;
}) {
  const { tile, host } = chrome;
  const restRef = useRef<HTMLButtonElement>(null);
  const pointer = useRef<number | null>(null);
  const targetsRef = useRef<Set<string> | null>(null);
  const springRef = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const ids = useId();
  const live = Boolean(drag?.live);
  const stretched = drag
    ? Math.hypot(drag.x - drag.restX, drag.y - drag.restY) >= PULL_THRESHOLD
    : false;
  const open = live && (stretched || prefersReducedMotion());
  const targets = () => {
    targetsRef.current ??= new Set(chrome.others().filter((id) => chrome.canDrop(tab.id, id)));
    return targetsRef.current;
  };
  const over = drag?.hover && "tile" in drag.hover ? drag.hover.tile : null;

  // The board dims and outlines tiles from this; reported only when something changes.
  const report = useRef(chrome.onPull);
  report.current = chrome.onPull;
  const shownTargets = open ? targets() : null;
  useEffect(() => {
    report.current(live ? { tab: tab.id, targets: shownTargets, over } : null);
  }, [live, tab.id, shownTargets, over]);
  const dragging = drag !== null;
  useEffect(() => {
    onActive(dragging ? tab.id : null);
  }, [dragging, onActive, tab.id]);
  useEffect(
    () => () => {
      report.current(null);
      onActive(null);
    },
    [onActive],
  );

  /**
   * What the pointer is on. Once it is on a tile it stays there until it leaves that tile, and
   * the fan steps back (faded, not hit), so a fan item over the tile can't take the release; on a
   * fan item, the item wins.
   */
  const hitAt = (x: number, y: number, previous: Hover): Hover => {
    if (previous && "tile" in previous) {
      const r = tileScreenRect(host.current, previous.tile);
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return previous;
    }
    const el = document.elementFromPoint(x, y);
    const item = el?.closest<HTMLElement>("[data-fan-item]");
    if (item?.dataset.fanTab === tab.id && item.dataset.fanItem)
      return { item: item.dataset.fanItem };
    const node = el?.closest<HTMLElement>(".react-flow__node");
    const id = node && host.current?.contains(node) ? node.dataset.id : undefined;
    return id && id !== tile ? { tile: id } : null;
  };

  const releaseCapture = () => {
    const id = pointer.current;
    pointer.current = null;
    if (id === null) return;
    try {
      restRef.current?.releasePointerCapture(id);
    } catch {
      /* already released */
    }
  };
  const end = () => {
    releaseCapture();
    targetsRef.current = null;
    setDrag(null);
  };
  /** Back to the resting tab: animated unless motion is reduced. */
  const springBack = () => {
    releaseCapture();
    targetsRef.current = null;
    if (prefersReducedMotion()) {
      setDrag(null);
      return;
    }
    setDrag((d) => {
      if (!d?.live) return d;
      springRef.current = { x: d.x, y: d.y };
      return { ...d, live: false, hover: null };
    });
  };

  const springing = drag !== null && !drag.live;
  useEffect(() => {
    const from = springRef.current;
    if (!springing || !from) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SPRING_MS);
      if (t >= 1) {
        springRef.current = null;
        setDrag(null);
        return;
      }
      const k = 1 - (1 - t) ** 3;
      setDrag((d) =>
        d && !d.live
          ? { ...d, x: from.x + (d.restX - from.x) * k, y: from.y + (d.restY - from.y) * k }
          : d,
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [springing]);

  // Escape cancels a pull.
  const cancel = useRef(springBack);
  cancel.current = springBack;
  useEffect(() => {
    if (!live) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      cancel.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [live]);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || drag) return;
    e.preventDefault();
    e.stopPropagation();
    const rest = restRef.current?.getBoundingClientRect();
    if (!rest) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = e.pointerId;
    targetsRef.current = null;
    setDrag({
      x: e.clientX,
      y: e.clientY,
      restX: rest.left + rest.width / 2,
      restY: rest.top + rest.height / 2,
      tile: tileScreenRect(host.current, tile) ?? fallbackTileRect(rest, chrome.size),
      live: true,
      hover: null,
    });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag?.live) return;
    e.stopPropagation();
    const dist = Math.hypot(e.clientX - drag.restX, e.clientY - drag.restY);
    const hover = dist >= PULL_THRESHOLD ? hitAt(e.clientX, e.clientY, drag.hover) : null;
    setDrag({
      ...drag,
      x: e.clientX,
      y: e.clientY,
      hover,
      tile: tileScreenRect(host.current, tile) ?? drag.tile,
    });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag?.live) return;
    e.stopPropagation();
    const dist = Math.hypot(e.clientX - drag.restX, e.clientY - drag.restY);
    const hover = dist >= PULL_THRESHOLD ? hitAt(e.clientX, e.clientY, drag.hover) : null;
    if (hover && "item" in hover) {
      end();
      chrome.onPick(tab, hover.item);
      return;
    }
    if (hover && "tile" in hover && targets().has(hover.tile)) {
      end();
      chrome.onDrop(tab.id, hover.tile);
      return;
    }
    if (hover && "tile" in hover) chrome.onRefused(tab.id, hover.tile);
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
    springBack();
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag?.live) return;
    e.stopPropagation();
    springBack();
  };

  const overlay =
    drag && typeof document !== "undefined"
      ? createPortal(
          <PullOverlay
            ids={ids}
            tab={tab}
            drag={drag}
            open={open}
            board={host.current?.getBoundingClientRect()}
            holes={
              open
                ? [...targets()].flatMap((id) => {
                    const rect = tileScreenRect(host.current, id);
                    return rect ? [holeRect(rect, TARGET_PAD)] : [];
                  })
                : []
            }
            refused={over !== null && !targets().has(over)}
          />,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={restRef}
        type="button"
        className="board-tab nopan"
        data-glyph={tab.glyph}
        data-hidden={drag ? true : undefined}
        aria-label={tab.label}
        title={tab.title ?? tab.label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={(e) => e.stopPropagation()}
      >
        <TabGlyphMark glyph={tab.glyph} />
        {tab.badge ? <span className="board-tab-badge">{tab.badge}</span> : null}
      </button>
      {overlay}
    </>
  );
}

/** The screen-space layer of one pull: scrim, band, fan and the tab under the pointer. */
function PullOverlay({
  ids,
  tab,
  drag,
  open,
  board,
  holes,
  refused,
}: {
  ids: string;
  tab: TabSpec;
  drag: Drag;
  open: boolean;
  /** The board's screen rect. */
  board: DOMRect | undefined;
  holes: ReturnType<typeof holeRect>[];
  refused: boolean;
}) {
  const before = tab.side === "before";
  const origin = underTileOrigin(drag.tile, drag.restY, before);
  const ribbon = taffyRibbon(origin.x, origin.y, drag.x, drag.y);
  const centers = fanCenters(drag.restX, drag.restY, tab.items.length, before);
  const exit = holeRect(drag.tile, 0);
  const scrimMask = `${ids}-scrim`;
  const boardClip = `${ids}-board`;
  const exitMask = `${ids}-exit`;
  const hovered = drag.hover && "item" in drag.hover ? drag.hover.item : null;
  const over = drag.hover && "tile" in drag.hover ? drag.hover.tile : null;
  return (
    <div
      className="board-overlay board-pull"
      data-glyph={tab.glyph}
      data-on-tile={over !== null || undefined}
      aria-hidden={!open}
    >
      {open ? (
        <svg className="board-scrim" width="100%" height="100%" aria-hidden>
          <defs>
            {board ? (
              <clipPath id={boardClip}>
                <rect x={board.x} y={board.y} width={board.width} height={board.height} />
              </clipPath>
            ) : null}
            <mask id={scrimMask} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
              <rect width="100%" height="100%" fill="white" />
              {/* Holes stop at the board's edge, so a tile under a side rail stays covered. */}
              <g clipPath={board ? `url(#${boardClip})` : undefined}>
                <rect data-tile-hole="true" {...exit} fill="black" />
                {holes.map((hole) => (
                  <rect key={`${hole.x},${hole.y}`} {...hole} fill="black" />
                ))}
              </g>
            </mask>
          </defs>
          <rect
            className="board-scrim-fill"
            width="100%"
            height="100%"
            mask={`url(#${scrimMask})`}
          />
        </svg>
      ) : null}
      <svg className="board-ribbon" width="100%" height="100%" overflow="visible" aria-hidden>
        <defs>
          <mask id={exitMask} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="100%" height="100%" fill="white" />
            <rect {...exit} fill="black" />
          </mask>
        </defs>
        <g mask={`url(#${exitMask})`}>
          {tab.glyph === "dash" ? (
            // An asynchronous band: the dashed-line colour with a dashed outline.
            <path
              data-ribbon="dash"
              d={ribbon.fill}
              fill="var(--board-dash)"
              stroke="var(--board-line)"
              strokeWidth={RIBBON_BORDER * 2}
              strokeDasharray="12 8"
              strokeLinejoin="round"
              paintOrder="stroke"
            />
          ) : (
            <>
              <path data-ribbon="outline" d={ribbon.outline} fill="var(--board-line)" />
              <path data-ribbon="plus" d={ribbon.fill} fill="var(--board-plus)" />
            </>
          )}
        </g>
      </svg>
      {open
        ? tab.items.map((item, i) => {
            const at = centers[i];
            return at ? (
              <button
                key={item.id}
                type="button"
                tabIndex={-1}
                className="board-fan-item"
                data-fan-item={item.id}
                data-fan-tab={tab.id}
                data-shape={item.shape ?? "rect"}
                data-hover={hovered === item.id || undefined}
                aria-label={item.label}
                style={{ left: at.x, top: at.y }}
              >
                {item.content}
                {hovered === item.id ? <span className="board-fan-tip">{item.label}</span> : null}
              </button>
            ) : null;
          })
        : null}
      <div
        className="board-tab-ghost"
        data-glyph={tab.glyph}
        data-refused={refused || undefined}
        style={{ left: drag.x, top: drag.y }}
      >
        <TabGlyphMark glyph={tab.glyph} />
        {tab.badge ? <span className="board-tab-badge">{tab.badge}</span> : null}
      </div>
    </div>
  );
}
