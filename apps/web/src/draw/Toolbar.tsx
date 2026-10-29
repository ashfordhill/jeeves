/**
 * Excalidraw-style floating toolbar. Every tool works by click (pick the tool, then click the
 * board or a card) and the placing tools also work by dragging the button onto the board.
 * Letter shortcuts are optional extras shown in the tooltips.
 */
import type { TemplateDescription } from "@jeeves/registry";
import { Popover, Tooltip } from "@mantine/core";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowUpRight,
  IconBoxMultiple,
  IconFrame,
  IconHandStop,
  IconNote,
  IconPlug,
  IconPointer,
  IconTextSize,
  IconTrash,
} from "@tabler/icons-react";
import { type DragEvent, type ReactNode, useState } from "react";
import { templateKey } from "./flow.ts";
import { canRedo, canUndo, type Tool, useDraw } from "./store.ts";
import { TemplateIcon } from "./TemplateIcon.tsx";

export const TOOL_MIME = "application/x-jeeves-tool";

export function readDraggedTool(event: DragEvent): Tool | undefined {
  const raw = event.dataTransfer.getData(TOOL_MIME);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Tool;
  } catch {
    return undefined;
  }
}

function dragTool(tool: Tool) {
  return (event: DragEvent) => {
    event.dataTransfer.setData(TOOL_MIME, JSON.stringify(tool));
    event.dataTransfer.effectAllowed = "copy";
  };
}

function sameTool(a: Tool, b: Tool): boolean {
  if (a.kind !== b.kind) return false;
  if (
    (a.kind === "element" || a.kind === "attachment") &&
    (b.kind === "element" || b.kind === "attachment")
  ) {
    return templateKey(a.template) === templateKey(b.template);
  }
  return true;
}

function ToolButton({
  label,
  hint,
  tool,
  icon,
  draggable,
}: {
  label: string;
  hint: string;
  tool: Tool;
  icon: ReactNode;
  draggable?: boolean;
}) {
  const active = useDraw((s) => sameTool(s.tool, tool));
  const setTool = useDraw((s) => s.setTool);
  return (
    <Tooltip label={hint} openDelay={400}>
      <button
        type="button"
        className={`tool-btn${active ? " is-on" : ""}`}
        aria-label={label}
        aria-pressed={active}
        draggable={draggable}
        onDragStart={draggable ? dragTool(tool) : undefined}
        onClick={() => setTool(active && tool.kind !== "select" ? { kind: "select" } : tool)}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

function PaletteItem({
  template,
  kind,
  onDragging,
  onPicked,
}: {
  template: TemplateDescription;
  kind: "element" | "attachment";
  onDragging: (dragging: boolean) => void;
  onPicked: () => void;
}) {
  const setTool = useDraw((s) => s.setTool);
  const tool: Tool = { kind, template: { id: template.id, version: template.version } };
  return (
    <button
      type="button"
      className="palette-item"
      draggable
      onDragStart={(event) => {
        dragTool(tool)(event);
        onDragging(true);
      }}
      onDragEnd={() => {
        onDragging(false);
        onPicked();
      }}
      onClick={() => {
        setTool(tool);
        onPicked();
      }}
    >
      <TemplateIcon name={template.card.icon} size={20} />
      <span className="palette-item-text">
        <span className="palette-item-name">{template.displayName}</span>
        <span className="palette-item-description">{template.description}</span>
      </span>
    </button>
  );
}

function PaletteMenu({
  label,
  icon,
  kind,
  groups,
}: {
  label: string;
  icon: ReactNode;
  kind: "element" | "attachment";
  groups: { group: string; templates: TemplateDescription[] }[];
}) {
  const [open, setOpen] = useState(false);
  // While dragging, the open palette turns see-through so it never hides the drop target.
  const [dragging, setDragging] = useState(false);
  const active = useDraw((s) => s.tool.kind === kind);
  return (
    <Popover
      opened={open}
      onChange={setOpen}
      position="bottom"
      shadow="md"
      width={320}
      withinPortal
    >
      <Popover.Target>
        <button
          type="button"
          className={`tool-btn${active ? " is-on" : ""}`}
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((o) => !o)}
        >
          {icon}
        </button>
      </Popover.Target>
      <Popover.Dropdown
        className="palette"
        aria-label={label}
        data-dragging={dragging || undefined}
      >
        <p className="palette-hint">
          {kind === "attachment"
            ? "Click one, then click an element card. Or drag it onto the card."
            : "Click one, then click the board. Or drag it onto the board."}
        </p>
        {groups.map(({ group, templates }) => (
          <section key={group} className="palette-group" aria-label={group}>
            <h3 className="palette-group-title">{group}</h3>
            {templates.map((template) => (
              <PaletteItem
                key={templateKey(template)}
                template={template}
                kind={kind}
                onDragging={setDragging}
                onPicked={() => setOpen(false)}
              />
            ))}
          </section>
        ))}
      </Popover.Dropdown>
    </Popover>
  );
}

function HistoryButtons() {
  const undoable = useDraw(canUndo);
  const redoable = useDraw(canRedo);
  const undo = useDraw((s) => s.undo);
  const redo = useDraw((s) => s.redo);
  return (
    <>
      <Tooltip label="Undo (Ctrl+Z)" openDelay={400}>
        <button
          type="button"
          className="tool-btn"
          aria-label="Undo"
          disabled={!undoable}
          onClick={() => void undo()}
        >
          <IconArrowBackUp size={18} />
        </button>
      </Tooltip>
      <Tooltip label="Redo (Ctrl+Shift+Z)" openDelay={400}>
        <button
          type="button"
          className="tool-btn"
          aria-label="Redo"
          disabled={!redoable}
          onClick={() => void redo()}
        >
          <IconArrowForwardUp size={18} />
        </button>
      </Tooltip>
    </>
  );
}

export function Toolbar({ onDelete, canDelete }: { onDelete: () => void; canDelete: boolean }) {
  const catalog = useDraw((s) => s.loaded?.catalog);
  const templates = useDraw((s) => s.loaded?.templates);
  if (!catalog || !templates) return null;

  const elementGroups = catalog.palette.map(({ group, templates: refs }) => ({
    group,
    templates: refs.flatMap((ref) => templates.get(templateKey(ref)) ?? []),
  }));
  const latestAttachments = new Map<string, TemplateDescription>();
  for (const template of catalog.templates) {
    if (template.kind === "attachment") latestAttachments.set(template.id, template);
  }
  const attachmentGroups = [{ group: "Attachments", templates: [...latestAttachments.values()] }];

  return (
    <div className="draw-toolbar" role="toolbar" aria-label="Drawing tools">
      <ToolButton
        label="Select"
        hint="Select and move (V)"
        tool={{ kind: "select" }}
        icon={<IconPointer size={18} />}
      />
      <ToolButton
        label="Hand"
        hint="Pan the board (H)"
        tool={{ kind: "hand" }}
        icon={<IconHandStop size={18} />}
      />
      <span className="tool-divider" aria-hidden />
      <PaletteMenu
        label="Elements"
        icon={<IconBoxMultiple size={18} />}
        kind="element"
        groups={elementGroups}
      />
      <PaletteMenu
        label="Attachments"
        icon={<IconPlug size={18} />}
        kind="attachment"
        groups={attachmentGroups}
      />
      <ToolButton
        label="Connector"
        hint="Connect: click one item, then another (C)"
        tool={{ kind: "connect" }}
        icon={<IconArrowUpRight size={18} />}
      />
      <span className="tool-divider" aria-hidden />
      <ToolButton
        label="Text"
        hint="Text (T)"
        tool={{ kind: "text" }}
        icon={<IconTextSize size={18} />}
        draggable
      />
      <ToolButton
        label="Sticky note"
        hint="Sticky note (N)"
        tool={{ kind: "note" }}
        icon={<IconNote size={18} />}
        draggable
      />
      <ToolButton
        label="Frame"
        hint="Frame (F)"
        tool={{ kind: "frame" }}
        icon={<IconFrame size={18} />}
        draggable
      />
      <span className="tool-divider" aria-hidden />
      <Tooltip label="Delete selection (Delete)" openDelay={400}>
        <button
          type="button"
          className="tool-btn"
          aria-label="Delete selection"
          disabled={!canDelete}
          onClick={onDelete}
        >
          <IconTrash size={18} />
        </button>
      </Tooltip>
      <span className="tool-divider" aria-hidden />
      <HistoryButtons />
    </div>
  );
}
