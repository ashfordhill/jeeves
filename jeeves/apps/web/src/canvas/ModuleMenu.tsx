// Adding a module, from the board and from the inspector, with one `+` (`ModuleAddButton`), one
// menu (`ModuleMenu`) and one command (`addModule`). The `+` toggles the menu: the module kinds
// the tile allows (`moduleKinds`), grouped by what each does (`moduleGroups`: Requests, Data,
// Events, Files & media, Custom), each a card in its group's colours with its name, a dot for what
// it can generate in that tile (Generated, Building block or You write it, from
// `moduleGeneration`), its icon and its one-line description; the dot's word starts its accessible
// description, and a legend under the last group explains the three dots. A pick adds a module of
// that kind named after it (`addModule`); the caller then opens it. A second click on the `+`, a
// press anywhere else, the wheel, a resize or Escape closes the menu, and picks nothing.
//
// On the board (`placement: "board"`) the menu sits beside the tile the `+` is in, below it when
// there is room, else on its right, left or above, inside the board; when the board has no room
// beside the tile, inside the window, over a rail (`placeBeside`). It covers the tile only when the
// window has no room either, and then as little as it can. From the inspector
// (`placement: "rail"`) it pops out to the left of the rail, level with the `+`. It lives on
// <body> at screen size, whatever the board's zoom. The board's tiles get their `+` from
// `ModuleAdding`, which only the live canvas provides in Pointer mode, so an export, Connect mode
// and a tile that can't take modules show none.
import { type Point, placeBeside, type ScreenBox } from "@jeeves/board";
import {
  buildStudioCommand,
  newModuleIdentity,
  type StudioComponentKind,
  type StudioKind,
  studioComponentDefinitions,
  studioComponentVisuals,
} from "@jeeves/spec";
import { IconPlus } from "@tabler/icons-react";
import {
  createContext,
  type MouseEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { commitAction } from "../studio/actions.ts";
import { moduleGroups } from "../studio/module-groups.ts";
import {
  generationWords,
  moduleGeneration,
  moduleGenerationOrder,
} from "../studio/module-status.ts";
import { StudioIcon } from "../studio/StudioIcon.tsx";

/** What a module kind can generate in a tile: the lead of a template, a part of one, or a stub. */
export type Generation = (typeof moduleGenerationOrder)[number];

/** One module kind in the menu. */
export type ModuleMenuItem = {
  kind: StudioComponentKind;
  name: string;
  description: string;
  /** What it can generate in this tile. */
  generation: Generation;
  icon: string;
};
/** The kinds of one group (`moduleGroups`) that this tile allows, in its colour family. */
export type ModuleMenuGroup = {
  label: string;
  family: string;
  items: readonly ModuleMenuItem[];
};

/**
 * The module kinds a tile of kind `host` allows, grouped by what each does (`moduleGroups`, in
 * its order, catalog order within a group), each with what it can generate there. Groups with no
 * kind are left out.
 */
export function moduleMenuGroups(
  kinds: readonly StudioComponentKind[],
  host: StudioKind,
): ModuleMenuGroup[] {
  return moduleGroups.flatMap((group) => {
    const items = group.kinds
      .filter((kind) => kinds.includes(kind))
      .map((kind): ModuleMenuItem => {
        const { name, description } = studioComponentDefinitions[kind];
        return {
          kind,
          name,
          description,
          generation: moduleGeneration(kind, host),
          icon: studioComponentVisuals[kind].icon,
        };
      });
    return items.length ? [{ label: group.label, family: group.family, items }] : [];
  });
}

/**
 * Who writes a module's code, as a dot (D6): full for Generated, the left half for Building block,
 * empty for You write it. Its title is the word.
 */
export function GenerationDot({ generation }: { generation: Generation }) {
  return (
    <span
      className="lane-generation-dot"
      data-generation={generation}
      title={generationWords[generation].word}
      aria-hidden
    />
  );
}

/**
 * Adds a module of `kind` to `host`, named and given its ID on the latest design (`addModule`, one
 * batch and one undo step), and resolves to its ID, or undefined when it wasn't saved.
 */
export async function addModule(
  projectId: string,
  host: string,
  kind: StudioComponentKind,
): Promise<string | undefined> {
  let created: string | undefined;
  const ok = await commitAction(projectId, (latest) => {
    const fresh = newModuleIdentity(latest, host, kind);
    created = fresh.id;
    return buildStudioCommand(latest, { type: "addModule", host, kind, ...fresh }).ops;
  });
  return ok ? created : undefined;
}

/** What adding a module needs: a tile's menu (none when it can't take modules) and the pick. */
export type ModuleAdding = {
  groups: (tile: string) => readonly ModuleMenuGroup[] | undefined;
  add: (tile: string, kind: StudioComponentKind) => void;
};
/**
 * The live canvas's module adding (Pointer mode only), and its selected tile, whose Simple face
 * shows the `+`.
 */
export const BoardModuleAdding = createContext<(ModuleAdding & { selected?: string }) | undefined>(
  undefined,
);

/** Room between the menu and the tile or rail it sits beside, and the window's edges. */
const GAP = 12;

/**
 * The `+` that toggles a tile's module menu. `placement` says where the menu opens: beside the
 * tile the `+` is drawn in (the board), or left of the rail it is in (the inspector).
 */
export function ModuleAddButton({
  tile,
  name,
  groups,
  onAdd,
  placement,
  className,
}: {
  tile: string;
  /** The tile's name, for the menu's title. */
  name: string;
  groups: readonly ModuleMenuGroup[];
  onAdd: (tile: string, kind: StudioComponentKind) => void;
  placement: "board" | "rail";
  className?: string;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<{ focus: boolean } | null>(null);
  const menuId = useId();
  const toggle = (event: MouseEvent) => {
    event.stopPropagation();
    // A click by keyboard (no pointer) moves focus into the menu.
    setOpen((current) => (current ? null : { focus: event.detail === 0 }));
  };
  return (
    <>
      <button
        ref={button}
        type="button"
        className={`lane-module-add nopan nodrag${className ? ` ${className}` : ""}`}
        aria-label="Add module"
        aria-haspopup="menu"
        aria-expanded={open !== null}
        aria-controls={open ? menuId : undefined}
        title={`Add module to ${name}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={toggle}
      >
        <IconPlus size={18} stroke={2.6} aria-hidden />
      </button>
      {open ? (
        <ModuleMenu
          id={menuId}
          name={name}
          groups={groups}
          anchor={button}
          placement={placement}
          focus={open.focus}
          onClose={(refocus) => {
            setOpen(null);
            if (refocus) button.current?.focus();
          }}
          onPick={(kind) => {
            setOpen(null);
            onAdd(tile, kind);
          }}
        />
      ) : null}
    </>
  );
}

/** Where the menu goes, on screen, for its anchor `+` (`ModuleAddButton`'s rules). */
function menuPlace(
  anchor: HTMLElement,
  size: { w: number; h: number },
  placement: "board" | "rail",
): Point {
  const window_ = {
    x: 0,
    y: 0,
    w: document.documentElement.clientWidth,
    h: document.documentElement.clientHeight,
  };
  const rect = (element: Element | null | undefined): ScreenBox | undefined => {
    const box = element?.getBoundingClientRect();
    return box && { x: box.left, y: box.top, w: box.width, h: box.height };
  };
  const plus = rect(anchor) as ScreenBox;
  if (placement === "rail") {
    const rail = rect(anchor.closest(".studio-rail")) ?? plus;
    return placeBeside(size, rail, window_, {
      sides: ["left"],
      gap: GAP,
      align: { x: plus.x, y: plus.y + size.h / 2 },
    });
  }
  const tile = rect(anchor.closest(".board-tile")) ?? plus;
  const board = rect(anchor.closest(".board"));
  const beside = (bounds: ScreenBox) => {
    const at = placeBeside(size, tile, bounds, {
      sides: ["below", "right", "left", "above"],
      gap: GAP,
      align: { x: plus.x + plus.w / 2, y: plus.y + plus.h / 2 },
    });
    const w = Math.min(at.x + size.w, tile.x + tile.w) - Math.max(at.x, tile.x);
    const h = Math.min(at.y + size.h, tile.y + tile.h) - Math.max(at.y, tile.y);
    return { at, covers: Math.max(0, w) * Math.max(0, h) };
  };
  // On the canvas when it has room beside the tile; else over a rail, beside the tile in the
  // window; else wherever covers least of the tile.
  const onBoard =
    board && size.w <= board.w - 32 && size.h <= board.h - 32 ? beside(board) : undefined;
  if (onBoard && onBoard.covers === 0) return onBoard.at;
  const inWindow = beside(window_);
  return onBoard && onBoard.covers <= inWindow.covers ? onBoard.at : inWindow.at;
}

/**
 * The menu itself: a title, then each group under its name, its cards two to a row, then the
 * legend of the dots.
 */
function ModuleMenu({
  id,
  name,
  groups,
  anchor,
  placement,
  focus,
  onClose,
  onPick,
}: {
  id: string;
  name: string;
  groups: readonly ModuleMenuGroup[];
  anchor: { current: HTMLButtonElement | null };
  placement: "board" | "rail";
  /** Move focus to its first item (it opened by keyboard). */
  focus: boolean;
  /** Closes it; `refocus` returns focus to the `+` (Escape inside the menu). */
  onClose: (refocus: boolean) => void;
  onPick: (kind: StudioComponentKind) => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<Point>();
  const ids = useId();
  const close = useRef(onClose);
  close.current = onClose;

  // Measured once it is drawn (unseen), then placed.
  useLayoutEffect(() => {
    const element = menu.current;
    const plus = anchor.current;
    if (!element || !plus) return;
    const box = element.getBoundingClientRect();
    setAt(menuPlace(plus, { w: box.width, h: box.height }, placement));
    if (focus) element.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
  }, [anchor, placement, focus]);

  useEffect(() => {
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (menu.current?.contains(target) || anchor.current?.contains(target));
    const away = (event: Event) => {
      if (!inside(event.target)) close.current(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close.current(menu.current?.contains(document.activeElement) ?? false);
    };
    const resize = () => close.current(false);
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("wheel", away, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("wheel", away, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", resize);
    };
  }, [anchor]);

  return createPortal(
    <div
      ref={menu}
      id={id}
      className="lane-module-menu"
      data-placement={placement}
      role="menu"
      aria-label={`Add module to ${name}`}
      style={at ? { left: at.x, top: at.y } : { left: 0, top: 0, visibility: "hidden" }}
    >
      <p className="lane-module-menu-title" aria-hidden>
        Add module to <strong>{name}</strong>
      </p>
      {groups.map((group) => (
        <fieldset key={group.label} className="lane-module-menu-group" data-family={group.family}>
          <legend className="lane-module-menu-heading">{group.label}</legend>
          <div className="lane-module-menu-items">
            {group.items.map((item) => {
              const { word } = generationWords[item.generation];
              return (
                <button
                  key={item.kind}
                  type="button"
                  role="menuitem"
                  className="lane-module-menu-item"
                  data-kind={item.kind}
                  data-family={group.family}
                  aria-label={item.name}
                  aria-describedby={`${ids}-${item.kind}`}
                  title={`${item.name} · ${word}\n${item.description}`}
                  onClick={() => onPick(item.kind)}
                >
                  <span className="lane-module-top">
                    <strong>{item.name}</strong>
                    <GenerationDot generation={item.generation} />
                  </span>
                  <span className="lane-module-line">
                    <span className="lane-module-menu-icon">
                      <StudioIcon name={item.icon} size={15} />
                    </span>
                    <span id={`${ids}-${item.kind}`} className="lane-module-menu-description">
                      <span className="lane-module-menu-status">{word}. </span>
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <ul className="lane-module-menu-legend">
        {moduleGenerationOrder.map((generation) => (
          <li key={generation}>
            <GenerationDot generation={generation} />
            <span>
              <b>{generationWords[generation].word}.</b> {generationWords[generation].meaning}
            </span>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}
