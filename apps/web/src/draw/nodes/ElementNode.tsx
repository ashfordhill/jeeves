/**
 * Element card: template icon, name, template label, key config chips, and one mini-box per
 * attachment, plus a findings badge. The card and each mini-box have their own in (left) and out (right) handles.
 * Card shape follows automation-pitch's step tile (3px line, rounded, cream fill).
 */
import type { TemplateDescription } from "@jeeves/registry";
import type { ConfigValues } from "@jeeves/spec";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { type ElementNode as ElementNodeType, handleId } from "../flow.ts";
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

/** `compact` drops the labels, for the narrow attachment mini-boxes. */
function Chips({ chips, compact }: { chips: Chip[]; compact?: boolean }) {
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
          {compact ? null : <span className="card-chip-label">{chip.label} </span>}
          {chip.value}
        </span>
      ))}
    </span>
  );
}

export function ElementNode({ id, data, selected }: NodeProps<ElementNodeType>) {
  const { element, template, attachments } = data;
  const pending = useDraw((s) => s.pendingEnd);
  const edit = useDraw((s) => s.edit);
  const findings = useDraw((s) => s.loaded?.findingIndex.byNode.get(id));
  const pendingHere = pending && "element" in pending && pending.element === id;
  const label = template?.displayName ?? "Needs a template";

  return (
    <article
      className={`element-card${selected ? " is-selected" : ""}${pendingHere && !pending.attachment ? " is-pending" : ""}`}
      data-element-id={id}
      aria-label={`${element.name}, ${label}`}
    >
      <Handle type="target" position={Position.Left} id={handleId("in")} className="card-handle" />
      <div className="element-card-head">
        <span className="element-card-icon">
          <TemplateIcon name={template?.card.icon} size={22} />
        </span>
        <span className="element-card-titles">
          <span className="element-card-name">{element.name}</span>
          <span className="element-card-template">{label}</span>
        </span>
        {findings?.length ? (
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
      <Chips chips={cardChips(template, element.config)} />
      {attachments.length > 0 ? (
        <ul className="attachment-list" aria-label={`Attachments of ${element.name}`}>
          {attachments.map(({ attachment, template: attachmentTemplate }) => (
            <li
              key={attachment.id}
              className={`attachment-box${pendingHere && pending.attachment === attachment.id ? " is-pending" : ""}`}
              data-attachment-id={attachment.id}
              aria-label={attachmentTemplate?.displayName ?? attachment.template.id}
            >
              <Handle
                type="target"
                position={Position.Left}
                id={handleId("in", attachment.id)}
                className="card-handle"
              />
              <TemplateIcon name={attachmentTemplate?.card.icon} size={16} />
              <span className="attachment-box-name">
                {attachmentTemplate?.displayName ?? attachment.template.id}
              </span>
              <Chips chips={cardChips(attachmentTemplate, attachment.config).slice(0, 1)} compact />
              {selected ? (
                <button
                  type="button"
                  className="attachment-remove nodrag"
                  aria-label={`Remove ${attachmentTemplate?.displayName ?? attachment.template.id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void edit([{ op: "removeAttachment", id: attachment.id }]);
                  }}
                >
                  <IconX size={12} aria-hidden />
                </button>
              ) : null}
              <Handle
                type="source"
                position={Position.Right}
                id={handleId("out", attachment.id)}
                className="card-handle"
              />
            </li>
          ))}
        </ul>
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
