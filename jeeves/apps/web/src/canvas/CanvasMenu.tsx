// The lane canvas's right-click menu: a tile's, a line's or a loader arrow's, at the pointer
// (`Workspace.tsx` builds its title and items). A Mantine `Menu`, always open, anchored on a 1px
// fixed element at the pointer, as automation-pitch's `PathContextMenu` is. The title is a
// `Menu.Label`; each item removes or disconnects something, so it has the trash icon and the
// removal colours (`--off-ink` on `--off-bg`, canvas.css). A pick, a press anywhere else or Escape
// closes it.
import { Menu } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";

export type CanvasMenuItem = { label: string; onPick: () => void };

export function CanvasMenu({
  at,
  title,
  items,
  onClose,
}: {
  /** The pointer, in client pixels. */
  at: { x: number; y: number };
  title: string;
  items: readonly CanvasMenuItem[];
  onClose: () => void;
}) {
  return (
    <Menu
      opened
      onChange={(open) => {
        if (!open) onClose();
      }}
      position="bottom-start"
      offset={6}
      withinPortal
      zIndex={4000}
    >
      <Menu.Target>
        <div
          aria-hidden
          tabIndex={-1}
          className="canvas-menu-anchor"
          style={{ position: "fixed", left: at.x, top: at.y, width: 1, height: 1 }}
        />
      </Menu.Target>
      <Menu.Dropdown className="canvas-menu">
        <Menu.Label className="canvas-menu-title">{title}</Menu.Label>
        {items.map((item) => (
          <Menu.Item
            key={item.label}
            className="canvas-menu-item"
            leftSection={<IconTrash size={16} stroke={2.2} aria-hidden />}
            onClick={item.onPick}
          >
            {item.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
