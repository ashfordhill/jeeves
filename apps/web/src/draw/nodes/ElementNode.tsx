/**
 * Element card: template icon, name, template label, key config chips, and one mini-box per
 * attachment, plus a findings badge. Only the outer card has connection handles.
 * Card shape follows automation-pitch's step tile (3px line, rounded, cream fill).
 */
import type { TemplateDescription } from "@jeeves/registry";
import {
  type ConfigValues,
  containerClassification,
  containerDescription,
  containerTechnology,
  plannedCapability,
} from "@jeeves/spec";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import {
  Handle,
  type NodeProps,
  NodeResizer,
  Position,
  useStore,
  useViewport,
} from "@xyflow/react";
import { useCallback } from "react";
import { elementFamily, templateFamily, typeStyles } from "../../architecture/type-style.tsx";
import { type ElementNode as ElementNodeType, handleId } from "../flow.ts";
import { attach } from "../ops.ts";
import { registry } from "../registry.ts";
import { SubtypeControl } from "../SubtypeControl.tsx";
import { useDraw } from "../store.ts";
import { TemplateIcon } from "../TemplateIcon.tsx";

type Chip = { key: string; label: string; value: string };

/** Card chips: the manifest's chip keys with the stored value, else the schema default. */
export function cardChips(template: TemplateDescription | undefined, config: ConfigValues): Chip[] {
  if (!template) return [];
  const properties = (template.configJsonSchema.properties ?? {}) as Record<
    string,
    { title?: string; default?: unknown }
  >;
  return template.card.chips.map((key) => {
    const value = config[key] ?? properties[key]?.default;
    return {
      key,
      label: properties[key]?.title ?? key,
      value: value === undefined || value === "" ? "not set" : String(value),
    };
  });
}

function Chips({ chips }: { chips: Chip[] }) {
  if (chips.length === 0) return null;
  return (
    <span className="card-chips">
      {chips.map((chip) => (
        <span
          key={chip.key}
          title={`${chip.label}: ${chip.value}`}
          className="card-chip"
          data-unset={chip.value === "not set" || undefined}
        >
          <span className="card-chip-label">{chip.label} </span>
          {chip.value}
        </span>
      ))}
    </span>
  );
}

export function ElementNode({ id, data, selected }: NodeProps<ElementNodeType>) {
  const { element, template, attachments } = data;
  const classification = containerClassification(element);
  const planned = plannedCapability(element.planned);
  const { zoom } = useViewport();
  const graphWidth = useStore((state) => state.width);
  const onResizeEnd = useCallback(
    (_: unknown, size: { x: number; y: number; width: number; height: number }) => {
      const layout = useDraw.getState().loaded?.layout.items[id];
      useDraw
        .getState()
        .setLayoutItems(
          { [id]: { ...layout, x: size.x, y: size.y, width: size.width, height: size.height } },
          { undoable: true },
        );
    },
    [id],
  );
  const pending = useDraw((s) => s.pendingEnd);
  const edit = useDraw((s) => s.edit);
  const editing = useDraw((s) => s.tool.kind === "select");
  const findings = useDraw((s) => s.loaded?.findingIndex.byNode.get(id));
  const pendingHere = pending && "element" in pending && pending.element === id;
  const label = planned?.name ?? template?.displayName ?? "Needs a template";

  return (
    <article
      className={`element-card${planned ? " planned-card" : ""}${classification.kind === "Data store" ? " database-card" : ""}${selected ? " is-selected" : ""}${pendingHere && !pending.attachment ? " is-pending" : ""}`}
      data-element-id={id}
      data-overview={zoom < 0.55 && graphWidth < 600}
      data-family={elementFamily(element)}
      aria-label={`${element.name}, ${label}`}
    >
      <NodeResizer
        isVisible={selected && editing}
        minWidth={260}
        minHeight={100}
        onResizeEnd={onResizeEnd}
      />
      <Handle type="target" position={Position.Left} id={handleId("in")} className="card-handle" />
      <div className="element-card-head">
        <span className="element-card-icon">
          <TemplateIcon name={typeStyles[elementFamily(element)].icon} size={22} />
        </span>
        <div className="element-card-titles">
          <span className="element-card-stereotype">
            {classification.kind === "Deployment infrastructure"
              ? "Deployment infrastructure · see deployment plans"
              : classification.kind === "External system"
                ? "External system"
                : "Container"}
          </span>
          <span className="element-card-name">{element.name}</span>
          {!planned && template?.elementKind !== "database" ? (
            <SubtypeControl element={element} disabled={!editing} cardLabel={label} />
          ) : (
            <span className="element-card-template">{label}</span>
          )}
          <span className="element-card-technology">{containerTechnology(element)}</span>
        </div>
        {!planned && findings?.length ? (
          <span
            className="card-findings"
            role="img"
            aria-label={`${findings.length} ${findings.length === 1 ? "finding" : "findings"}`}
            title={findings.map((f) => f.message).join("\n")}
          >
            <IconAlertTriangle size={13} aria-hidden />
            {findings.length}
          </span>
        ) : null}
      </div>
      <p className="container-description" title={containerDescription(element)}>
        {containerDescription(element)}
      </p>
      {element.classification ? (
        <span className="classification-summary">
          {classification.kind} · {classification.ownership} · {classification.operation}
        </span>
      ) : null}
      {planned ? <span className="capability-status">Planned</span> : null}
      <Chips chips={cardChips(template, element.config).slice(0, 2)} />
      {attachments.length > 0 ? (
        <ul className="attachment-list" aria-label={`Attachments of ${element.name}`}>
          {attachments.map(({ attachment, template: attachmentTemplate }) => (
            <li
              key={attachment.id}
              className={`attachment-box${pendingHere && pending.attachment === attachment.id ? " is-pending" : ""}`}
              data-attachment-id={attachment.id}
              data-family={templateFamily(attachment.template.id)}
              aria-label={attachmentTemplate?.displayName ?? attachment.template.id}
              title={attachmentTemplate?.displayName ?? attachment.template.id}
            >
              <TemplateIcon
                name={typeStyles[templateFamily(attachment.template.id)].icon}
                size={16}
              />
              <span className="attachment-box-name">
                {attachmentTemplate?.displayName ?? attachment.template.id}
              </span>
              <button
                type="button"
                className="attachment-remove nodrag"
                aria-label={`Remove ${attachmentTemplate?.displayName ?? attachment.template.id}`}
                style={{ visibility: selected ? "visible" : "hidden" }}
                disabled={!editing}
                onClick={(event) => {
                  event.stopPropagation();
                  void edit([{ op: "removeAttachment", id: attachment.id }]);
                }}
              >
                <IconX size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {element.template ? (
        <fieldset
          className="compatible-components nodrag nopan"
          aria-label="Compatible components"
          style={{ visibility: selected ? "visible" : "hidden" }}
          disabled={!editing}
        >
          {registry
            .attachmentsFor(element.template)
            .filter(
              (t) =>
                registry.canAttach(useDraw.getState().loaded!.design, id, {
                  id: t.id,
                  version: t.version,
                }).ok,
            )
            .map((t) => (
              <button
                type="button"
                key={t.id}
                aria-label={`Add ${t.displayName}`}
                title={`Add ${t.displayName}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const loaded = useDraw.getState().loaded;
                  if (!loaded) return;
                  const plan = attach(loaded.design, registry, id, {
                    id: t.id,
                    version: t.version,
                  });
                  if (plan.ok) void edit(plan.ops);
                }}
              >
                <TemplateIcon name={typeStyles[templateFamily(t.id)].icon} size={16} />
              </button>
            ))}
        </fieldset>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        id={handleId("out")}
        className="card-handle"
      />
    </article>
  );
}
