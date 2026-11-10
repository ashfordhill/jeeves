// Ported from automation-illustrator src/board/controls/TileChrome.tsx (0803c4a).
// The selected tile's pull tabs. A tab opens a fan of items around its resting place once pulled
// past 36px, while a thick rubber band stretches from under the tile face to the pointer;
// releasing over an item picks it. A tab never links to existing tiles (no drop targets, no
// dimming); the board's connect mode does that. Releasing anywhere else, or Escape, springs back.
// Pointer capture stays on the tab, so panning never steals the gesture.
//
// Changes from automation-illustrator: the tabs and fan items come from props; a tab's mark is a
// `+` or a link glyph; a fan item can be disabled (greyed in its slot, its tip gives the reason, a
// release on it changes nothing); once past the threshold the pull stays open until it ends, so a
// fan item the board's edge pushed back beside the tab can still be picked; Escape cancels and a
// cancelled pull springs back. The fan stays inside the board (`placeFan`). A long list can be a
// grid fan instead (`layout: "grid"`): a row per item group beside the tab (wrapping after
// `columns`), each item captioned with its name and, when it has one, a detail line, on one panel
// kept on the board as a block (`placeGrid`), so it reads over the tiles it covers. An item's tip
// gives its name, its description and, when disabled, the reason.
// The red X shows only when the caller lets the tile go (`remove`). No path tab, tile pickup or
// insert silhouette.
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
import {
  FAN_CELL,
  FAN_CELL_DETAIL,
  fanCenters,
  fanGrid,
  gridBounds,
  placeFan,
  placeGrid,
} from "./fan.ts";
import { LinkGlyph } from "./LinkGlyph.tsx";
import {
  fallbackTileRect,
  holeRect,
  type TileRect,
  taffyRibbon,
  tileScreenRect,
  underTileOrigin,
} from "./overlay.ts";
import { RemoveButton } from "./RemoveButton.tsx";
import { prefersReducedMotion } from "./useAnimatedLayout.ts";

export const PULL_THRESHOLD = 36;
/** A grid fan's panel reaches this far past its cells (6px of the board's 16px margin). */
const PANEL_PAD = 6;
export const SPRING_MS = 200;

/**
 * One item of a create tab's fan: an icon, named by `label` (its accessible name and hover tip,
 * and its caption in a grid fan). A `disabled` item (the reason, in words) is greyed in its usual
 * slot, its tip adds the reason, and releasing on it changes nothing. In a grid fan, items with
 * the same `group` share a row, and a `detail` (a few words, such as what the item is) is a
 * second caption line. A `description` (one sentence) follows the name in its tip.
 */
export type FanItem = {
  id: string;
  label: string;
  content: ReactNode;
  shape?: "rect" | "pill";
  disabled?: string;
  group?: string;
  detail?: string;
  description?: string;
};

/** How a fan lays out its items: on an arc around the tab, or in a grid of rows beside it. */
export type FanLayout = "arc" | "grid";

/** A tab's mark, and its band's colour: a `+`, or a link glyph. */
export type TabGlyph = "plus" | "link";

/** A pull tab on the selected tile: its fan's items create; it never drops on a tile. */
export type CreateTab = {
  id: string;
  kind: "create";
  /** `after` sits on the right (fans right); `before` on the left (fans left). */
  side: DockSide;
  /** Accessible name. */
  label: string;
  /** Tooltip; defaults to the label. */
  title?: string;
  /** Default `plus`. */
  glyph?: TabGlyph;
  /** A small mark on the tab's corner (an icon). */
  badge?: ReactNode;
  /** Every item, always in the same order, so each sits in the same slot every time. */
  items: readonly FanItem[];
  /** Default `arc`; `grid` puts each group of items in a row and captions every item. */
  layout?: FanLayout;
  /** A grid fan's longest row; a longer group wraps onto the next row. Default: no limit. */
  columns?: number;
  /** The row a tile picked from this fan takes, next to an existing tile (a lane's last tile). */
  order?: SlotOrder;
};
/** A pull tab on the selected tile. */
export type TabSpec = CreateTab;

export const tabGlyph = (tab: TabSpec): TabGlyph => tab.glyph ?? "plus";

export type ChromeProps = {
  tile: string;
  size: Size;
  tabs: readonly TabSpec[];
  host: RefObject<HTMLElement | null>;
  onPick: (tab: CreateTab, item: string) => void;
  /** The red X above the tile; none when the tile can't be removed. */
  remove?: { label: string; onRemove: () => void };
};

type Hover = { item: string } | null;
type Drag = {
  x: number;
  y: number;
  restX: number;
  restY: number;
  tile: TileRect;
  /** False while springing back. */
  live: boolean;
  /** The pull has gone past `PULL_THRESHOLD`; it stays open until it ends. */
  opened: boolean;
  hover: Hover;
};

/** Whether the pointer is past the threshold from the tab's resting place. */
const stretched = (drag: Drag, at: { clientX: number; clientY: number }) =>
  Math.hypot(at.clientX - drag.restX, at.clientY - drag.restY) >= PULL_THRESHOLD;

function TabGlyphMark({ glyph }: { glyph: TabGlyph }) {
  return glyph === "plus" ? <span aria-hidden>+</span> : <LinkGlyph size={22} />;
}

export function TileChrome(props: ChromeProps) {
  const [active, setActive] = useState<string | null>(null);
  const sides: DockSide[] = ["before", "after"];
  return (
    <div className="board-chrome" data-pulling={active ? true : undefined}>
      {sides.map((side) => {
        const tabs = props.tabs.filter((tab) => tab.side === side);
        return tabs.length ? (
          <div
            key={side}
            className="board-tabs"
            data-side={side}
            data-many={tabs.length > 2 || undefined}
          >
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
  const springRef = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const ids = useId();
  const live = Boolean(drag?.live);
  const open = live && (Boolean(drag?.opened) || prefersReducedMotion());

  const dragging = drag !== null;
  useEffect(() => {
    onActive(dragging ? tab.id : null);
  }, [dragging, onActive, tab.id]);
  useEffect(() => () => onActive(null), [onActive]);

  /** The fan item the pointer is on. */
  const hitAt = (x: number, y: number): Hover => {
    const item = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-fan-item]");
    return item?.dataset.fanTab === tab.id && item.dataset.fanItem
      ? { item: item.dataset.fanItem }
      : null;
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
    setDrag(null);
  };
  /** Back to the resting tab: animated unless motion is reduced. */
  const springBack = () => {
    releaseCapture();
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
    setDrag({
      x: e.clientX,
      y: e.clientY,
      restX: rest.left + rest.width / 2,
      restY: rest.top + rest.height / 2,
      tile: tileScreenRect(host.current, tile) ?? fallbackTileRect(rest, chrome.size),
      live: true,
      opened: false,
      hover: null,
    });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag?.live) return;
    e.stopPropagation();
    const opened = drag.opened || stretched(drag, e);
    const hover = opened ? hitAt(e.clientX, e.clientY) : null;
    setDrag({
      ...drag,
      opened,
      x: e.clientX,
      y: e.clientY,
      hover,
      tile: tileScreenRect(host.current, tile) ?? drag.tile,
    });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag?.live) return;
    e.stopPropagation();
    const hover = drag.opened || stretched(drag, e) ? hitAt(e.clientX, e.clientY) : null;
    // A disabled item is not picked: the pull springs back and nothing changes.
    const item = hover && tab.items.find((each) => each.id === hover.item);
    if (item && !item.disabled) {
      end();
      chrome.onPick(tab, item.id);
      return;
    }
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
        data-glyph={tabGlyph(tab)}
        data-hidden={drag ? true : undefined}
        aria-label={tab.label}
        title={tab.title ?? tab.label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={(e) => e.stopPropagation()}
      >
        <TabGlyphMark glyph={tabGlyph(tab)} />
        {tab.badge ? <span className="board-tab-badge">{tab.badge}</span> : null}
      </button>
      {overlay}
    </>
  );
}

/** The screen-space layer of one pull: the band, the fan and the tab under the pointer. */
function PullOverlay({
  ids,
  tab,
  drag,
  open,
  board,
}: {
  ids: string;
  tab: TabSpec;
  drag: Drag;
  open: boolean;
  /** The board's screen rect. */
  board: DOMRect | undefined;
}) {
  const before = tab.side === "before";
  const glyph = tabGlyph(tab);
  const origin = underTileOrigin(drag.tile, drag.restY, before);
  const ribbon = taffyRibbon(origin.x, origin.y, drag.x, drag.y);
  const { items } = tab;
  const grid = tab.layout === "grid";
  // Slots come from the item's place in the whole list, disabled or not, so they never shift.
  const box = board && { x: board.x, y: board.y, w: board.width, h: board.height };
  const detailed = grid && items.some((item) => item.detail);
  const cell = detailed ? FAN_CELL_DETAIL : FAN_CELL;
  const centers = grid
    ? placeGrid(
        fanGrid(
          drag.restX,
          drag.restY,
          items.map((item) => item.group),
          before,
          { cell, ...(tab.columns !== undefined && { columns: tab.columns }) },
        ),
        box,
        cell,
      )
    : placeFan(fanCenters(drag.restX, drag.restY, items.length, before), box);
  const panel = grid && open && centers.length ? gridBounds(centers, cell) : undefined;
  const exit = holeRect(drag.tile, 0);
  const exitMask = `${ids}-exit`;
  const hovered = drag.hover?.item ?? null;
  return (
    <div
      className="board-overlay board-pull"
      data-glyph={glyph}
      data-layout={grid ? "grid" : undefined}
      data-detail={detailed || undefined}
      aria-hidden={!open}
    >
      <svg className="board-ribbon" width="100%" height="100%" overflow="visible" aria-hidden>
        <defs>
          <mask id={exitMask} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="100%" height="100%" fill="white" />
            <rect {...exit} fill="black" />
          </mask>
        </defs>
        <g mask={`url(#${exitMask})`}>
          <path data-ribbon="outline" d={ribbon.outline} fill="var(--board-line)" />
          <path
            data-ribbon={glyph}
            d={ribbon.fill}
            fill={glyph === "plus" ? "var(--board-plus)" : "var(--board-link)"}
          />
        </g>
      </svg>
      {panel ? (
        <div
          className="board-fan-panel"
          style={{
            left: panel.x - PANEL_PAD,
            top: panel.y - PANEL_PAD,
            width: panel.w + 2 * PANEL_PAD,
            height: panel.h + 2 * PANEL_PAD,
          }}
        />
      ) : null}
      {open
        ? items.map((item, i) => {
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
                aria-disabled={item.disabled ? true : undefined}
                style={{ left: at.x, top: at.y }}
              >
                <span className="board-fan-content">{item.content}</span>
                {grid ? (
                  <span className="board-fan-caption">
                    {item.label}
                    {item.detail ? <span className="board-fan-detail">{item.detail}</span> : null}
                  </span>
                ) : null}
                {hovered === item.id ? (
                  <span
                    className="board-fan-tip"
                    data-wrap={item.disabled || item.description ? true : undefined}
                  >
                    {item.label}
                    {item.description ? (
                      <span className="board-fan-description">{item.description}</span>
                    ) : null}
                    {item.disabled ? (
                      <span className="board-fan-reason">{item.disabled}</span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            ) : null;
          })
        : null}
      <div className="board-tab-ghost" data-glyph={glyph} style={{ left: drag.x, top: drag.y }}>
        <TabGlyphMark glyph={glyph} />
        {tab.badge ? <span className="board-tab-badge">{tab.badge}</span> : null}
      </div>
    </div>
  );
}
