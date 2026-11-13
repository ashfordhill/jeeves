// Ported from automation-illustrator src/board/controls/TileChrome.tsx (0803c4a).
// The selected tile's tabs, on its right. A click on a tab opens its fan of items beside it, and
// a click on an item picks it; a second click on the tab, a click anywhere else, the wheel or
// Escape closes the fan. A tab can still be pulled: past 36px a thick rubber band stretches from
// under the tile face to the pointer, and releasing over an item picks it; releasing anywhere
// else, or Escape, springs back. Pointer capture stays on the tab, so panning never steals the
// gesture. A tab never links to existing tiles (no drop targets, no dimming); the board's
// connect mode does that.
//
// Changes from automation-illustrator: the tabs and fan items come from props; a tab's mark is a
// `+` or a link glyph; a tab opens by click (or the keyboard) as well as by a pull; a fan item can be disabled
// (greyed in its slot, its tip gives the reason, picking it changes nothing); once past the
// threshold the pull stays open until it ends, so a fan item the board's edge pushed back beside
// the tab can still be picked; Escape cancels and a cancelled pull springs back. The fan stays
// inside the board (`placeFan`). A long list can be a grid fan instead (`layout: "grid"`): a row
// per item group right of the tab, each item captioned with its name, on one panel kept on the
// board as a block (`placeGrid`), so it reads over the tiles it covers; where the board is too
// narrow for it beside the tab it goes beside its own tile (left, below or above), not over it.
// An item's tip gives its name and, when disabled, the reason. No path tab, tile pickup or insert
// silhouette.
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
import type { Point, Size, SlotOrder } from "../layout/metrics.ts";
import { FAN_PANEL_PAD, fanCenters, fanGrid, gridBounds, placeFan, placeGrid } from "./fan.ts";
import { LinkGlyph } from "./LinkGlyph.tsx";
import {
  fallbackTileRect,
  holeRect,
  type TileRect,
  taffyRibbon,
  tileScreenRect,
  underTileOrigin,
} from "./overlay.ts";
import { prefersReducedMotion } from "./useAnimatedLayout.ts";

export const PULL_THRESHOLD = 36;
const PANEL_PAD = FAN_PANEL_PAD;
export const SPRING_MS = 200;

/**
 * One item of a create tab's fan: an icon, named by `label` (its accessible name and hover tip,
 * and its caption in a grid fan). A `disabled` item (the reason, in words) is greyed in its usual
 * slot, its tip adds the reason, and picking it changes nothing. In a grid fan, items with the
 * same `group` share a row.
 */
export type FanItem = {
  id: string;
  label: string;
  content: ReactNode;
  shape?: "rect" | "pill";
  disabled?: string;
  group?: string;
};

/** How a fan lays out its items: on an arc right of the tab, or in a grid of rows beside it. */
export type FanLayout = "arc" | "grid";

/** A tab's mark, and its band's colour: a `+`, or a link glyph. */
export type TabGlyph = "plus" | "link";

/** A tab on the selected tile's right: its fan's items create; it never drops on a tile. */
export type CreateTab = {
  id: string;
  kind: "create";
  /** Accessible name. */
  label: string;
  /** Tooltip; defaults to the label. */
  title?: string;
  /** Default `plus`. */
  glyph?: TabGlyph;
  /** Every item, always in the same order, so each sits in the same slot every time. */
  items: readonly FanItem[];
  /** Default `arc`; `grid` puts each group of items in a row and captions every item. */
  layout?: FanLayout;
  /** The row a tile picked from this fan takes, next to an existing tile (a lane's last tile). */
  order?: SlotOrder;
};
/** A tab on the selected tile. */
export type TabSpec = CreateTab;

export const tabGlyph = (tab: TabSpec): TabGlyph => tab.glyph ?? "plus";

export type ChromeProps = {
  tile: string;
  size: Size;
  tabs: readonly TabSpec[];
  host: RefObject<HTMLElement | null>;
  onPick: (tab: CreateTab, item: string) => void;
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
/** A fan opened by a click: where the tab rests and its tile, on screen, when it opened. */
type Clicked = { rest: Point; tile: TileRect };

/** Whether the pointer is past the threshold from the tab's resting place. */
const stretched = (drag: Drag, at: { clientX: number; clientY: number }) =>
  Math.hypot(at.clientX - drag.restX, at.clientY - drag.restY) >= PULL_THRESHOLD;

function TabGlyphMark({ glyph }: { glyph: TabGlyph }) {
  return glyph === "plus" ? <span aria-hidden>+</span> : <LinkGlyph size={22} />;
}

export function TileChrome(props: ChromeProps) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="board-chrome" data-pulling={active ? true : undefined}>
      {props.tabs.length ? (
        <div className="board-tabs" data-many={props.tabs.length > 2 || undefined}>
          {props.tabs.map((tab) => (
            <PullTab key={tab.id} tab={tab} chrome={props} onActive={setActive} />
          ))}
        </div>
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
  const [clicked, setClicked] = useState<Clicked | null>(null);
  const [clickHover, setClickHover] = useState<string | null>(null);
  /** The layer of a fan opened by a click. */
  const clickLayer = useRef<HTMLDivElement>(null);
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

  // A fan opened by a click closes on a press anywhere but the fan and its tab (the tab's own
  // press closes it), on the wheel (the board would move under it), on a resize and on Escape.
  const isOpen = clicked !== null;
  useEffect(() => {
    if (!isOpen) return;
    const close = () => {
      setClicked(null);
      setClickHover(null);
    };
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (restRef.current?.contains(target) || clickLayer.current?.contains(target));
    const away = (event: Event) => {
      if (!inside(event.target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("wheel", away, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("wheel", away, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  /** The rest point and the tile, on screen now. */
  const measure = () => {
    const rest = restRef.current?.getBoundingClientRect();
    if (!rest) return undefined;
    return {
      rest: { x: rest.left + rest.width / 2, y: rest.top + rest.height / 2 },
      tile: tileScreenRect(host.current, tile) ?? fallbackTileRect(rest, chrome.size),
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || drag) return;
    e.preventDefault();
    e.stopPropagation();
    // A press on the tab of an open fan closes it (a second click).
    if (clicked) {
      setClicked(null);
      setClickHover(null);
      return;
    }
    const at = measure();
    if (!at) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = e.pointerId;
    setDrag({
      x: e.clientX,
      y: e.clientY,
      restX: at.rest.x,
      restY: at.rest.y,
      tile: at.tile,
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
    // Released before the threshold: a click, which opens the fan until the next click.
    if (!drag.opened && !stretched(drag, e)) {
      end();
      const at = measure();
      if (at) setClicked(at);
      return;
    }
    const hover = hitAt(e.clientX, e.clientY);
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

  const board = host.current?.getBoundingClientRect();
  const overlay =
    typeof document === "undefined"
      ? null
      : drag
        ? createPortal(
            <PullOverlay ids={ids} tab={tab} drag={drag} open={open} board={board} />,
            document.body,
          )
        : clicked
          ? createPortal(
              <div
                ref={clickLayer}
                className="board-overlay board-pull"
                data-fan={ids}
                data-clicked
                data-glyph={tabGlyph(tab)}
                data-layout={tab.layout === "grid" ? "grid" : undefined}
              >
                <FanItems
                  tab={tab}
                  rest={clicked.rest}
                  tile={clicked.tile}
                  board={board}
                  hovered={clickHover}
                  onHover={setClickHover}
                  onPick={(item) => {
                    if (item.disabled) return;
                    setClicked(null);
                    setClickHover(null);
                    chrome.onPick(tab, item.id);
                  }}
                />
              </div>,
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
        aria-expanded={isOpen}
        title={tab.title ?? tab.label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={(e) => {
          e.stopPropagation();
          // A click from the keyboard (no pointer press) toggles the fan too, focusing its first
          // item that can be picked.
          if (e.detail !== 0) return;
          const at = clicked ? null : measure();
          setClicked(at ?? null);
          setClickHover(null);
          if (at)
            requestAnimationFrame(() =>
              clickLayer.current
                ?.querySelector<HTMLElement>('[data-fan-item]:not([aria-disabled="true"])')
                ?.focus(),
            );
        }}
      >
        <TabGlyphMark glyph={tabGlyph(tab)} />
      </button>
      {overlay}
    </>
  );
}

/**
 * A fan's items (and a grid fan's panel), in their slots around the tab resting at `rest`, kept on
 * the board and, for a grid, off `tile`. Opened by a click (`onPick`), each item is a button the
 * pointer picks, with its tip while the pointer is on it; during a pull the tab's pointer picks
 * and `hovered` is the item under it.
 */
function FanItems({
  tab,
  rest,
  tile,
  board,
  hovered,
  onHover,
  onPick,
}: {
  tab: TabSpec;
  rest: Point;
  tile: TileRect;
  /** The board's screen rect. */
  board: DOMRect | undefined;
  hovered: string | null;
  onHover?: (item: string | null) => void;
  onPick?: (item: FanItem) => void;
}) {
  const { items } = tab;
  const grid = tab.layout === "grid";
  // Slots come from the item's place in the whole list, disabled or not, so they never shift.
  const box = board && { x: board.x, y: board.y, w: board.width, h: board.height };
  const centers = grid
    ? placeGrid(
        fanGrid(
          rest.x,
          rest.y,
          items.map((item) => item.group),
        ),
        box,
        tile,
      )
    : placeFan(fanCenters(rest.x, rest.y, items.length), box);
  const panel = grid && centers.length ? gridBounds(centers) : undefined;
  const clickable = onPick !== undefined;
  return (
    <>
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
      {items.map((item, i) => {
        const at = centers[i];
        return at ? (
          <button
            key={item.id}
            type="button"
            tabIndex={clickable ? 0 : -1}
            className="board-fan-item"
            data-fan-item={item.id}
            data-fan-tab={tab.id}
            data-shape={item.shape ?? "rect"}
            data-hover={hovered === item.id || undefined}
            aria-label={item.label}
            aria-disabled={item.disabled ? true : undefined}
            style={{ left: at.x, top: at.y }}
            {...(clickable && {
              onPointerEnter: () => onHover?.(item.id),
              onPointerLeave: () => onHover?.(null),
              onFocus: () => onHover?.(item.id),
              onBlur: () => onHover?.(null),
              onClick: () => onPick(item),
            })}
          >
            <span className="board-fan-content">{item.content}</span>
            {grid ? <span className="board-fan-caption">{item.label}</span> : null}
            {hovered === item.id ? (
              <span className="board-fan-tip" data-wrap={item.disabled ? true : undefined}>
                {item.label}
                {item.disabled ? <span className="board-fan-reason">{item.disabled}</span> : null}
              </span>
            ) : null}
          </button>
        ) : null;
      })}
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
  const glyph = tabGlyph(tab);
  const origin = underTileOrigin(drag.tile, drag.restY);
  const ribbon = taffyRibbon(origin.x, origin.y, drag.x, drag.y);
  const exit = holeRect(drag.tile, 0);
  const exitMask = `${ids}-exit`;
  return (
    <div
      className="board-overlay board-pull"
      data-fan={ids}
      data-glyph={glyph}
      data-layout={tab.layout === "grid" ? "grid" : undefined}
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
      {open ? (
        <FanItems
          tab={tab}
          rest={{ x: drag.restX, y: drag.restY }}
          tile={drag.tile}
          board={board}
          hovered={drag.hover?.item ?? null}
        />
      ) : null}
      <div className="board-tab-ghost" data-glyph={glyph} style={{ left: drag.x, top: drag.y }}>
        <TabGlyphMark glyph={glyph} />
      </div>
    </div>
  );
}
