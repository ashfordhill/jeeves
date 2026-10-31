/**
 * The inspector (PLAN §5): edits whatever is selected on the board. An element shows its name,
 * a schema-driven config form, implementation notes, attachments (each with its own config and
 * notes), connections, and findings. Connections, annotations, and multi-selections get smaller
 * panels; with nothing selected it shows a short summary of the design.
 */
import type {
  Annotation,
  Attachment,
  Connection,
  DesignDocument,
  Element,
  Endpoint,
  Finding,
  OperationInput,
} from "@jeeves/spec";
import { Button, Menu } from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconFocusCentered,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { connectionLabels } from "../connect.ts";
import { templateKey } from "../flow.ts";
import { attach, deleteOps } from "../ops.ts";
import { registry } from "../registry.ts";
import { SubtypeControl } from "../SubtypeControl.tsx";
import { type Selection, useDraw } from "../store.ts";
import { TemplateIcon } from "../TemplateIcon.tsx";
import { ConfigForm } from "./ConfigForm.tsx";
import { DeliveryConfiguration } from "./DeliveryEditor.tsx";
import { DraftTextarea, DraftTextInput } from "./fields.tsx";
import { LocalExecutionConfiguration } from "./LocalExecutionEditor.tsx";
import { LocalHttpPoolConfiguration } from "./LocalHttpPoolEditor.tsx";
import { ResourceConfiguration } from "./ResourceEditor.tsx";
import { WorkspaceConfiguration } from "./WorkspaceEditor.tsx";

const NOTE_COLORS = ["yellow", "blue", "green", "pink", "gray"] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="inspector-section" aria-label={title}>
      <h3 className="inspector-section-title">{title}</h3>
      {children}
    </section>
  );
}

export function FindingList({
  findings,
  subject,
  onSelect,
}: {
  findings: readonly Finding[];
  subject?: (f: Finding) => string;
  onSelect?: (f: Finding) => void;
}) {
  return (
    <ul className="finding-list">
      {findings.map((f) => {
        const body = (
          <>
            <IconAlertTriangle size={16} aria-hidden className="finding-icon" />
            <span className="finding-text">
              {subject ? <span className="finding-subject">{subject(f)}</span> : null}
              <span className="finding-message">{f.message}</span>
            </span>
          </>
        );
        return (
          <li
            key={`${f.code} ${JSON.stringify(f.target)} ${f.message}`}
            className="finding-row"
            data-severity={f.severity}
          >
            {onSelect ? (
              <button type="button" className="finding-btn" onClick={() => onSelect(f)}>
                {body}
              </button>
            ) : (
              <div className="finding-btn">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function useInspector() {
  const loaded = useDraw((s) => s.loaded);
  const edit = useDraw((s) => s.edit);
  const focus = useDraw((s) => s.focus);
  return { loaded, edit, focus };
}

const templateName = (ref: { id: string; version: string } | null | undefined) =>
  ref ? (useDraw.getState().loaded?.templates.get(templateKey(ref))?.displayName ?? ref.id) : "";

function endpointName(design: DesignDocument, end: Endpoint): string {
  const element = design.elements.find((e) => e.id === end.element);
  if (!element) return end.element;
  if (!end.attachment) return element.name;
  const attachment = element.attachments.find((a) => a.id === end.attachment);
  return `${element.name} · ${attachment ? templateName(attachment.template) : end.attachment}`;
}

function NotesField({ id, notes, label }: { id: string; notes: string; label: string }) {
  const edit = useDraw((s) => s.edit);
  return (
    <DraftTextarea
      label={label}
      description="Markdown. Coding agents implement from these notes."
      placeholder="What should this do? Endpoints, rules, edge cases…"
      minRows={4}
      value={notes}
      onCommit={(text) => void edit([{ op: "setNotes", id, notes: text }])}
    />
  );
}

function AttachmentPanel({
  element,
  attachment,
  findings,
}: {
  element: Element;
  attachment: Attachment;
  findings: readonly Finding[];
}) {
  const { edit } = useInspector();
  const template = useDraw((s) => s.loaded?.templates.get(templateKey(attachment.template)));
  const name = template?.displayName ?? attachment.template.id;
  const own = findings.filter((f) => f.target.attachment === attachment.id);
  return (
    <li className="inspector-attachment" aria-label={`${name} attachment of ${element.name}`}>
      <div className="inspector-attachment-head">
        <TemplateIcon name={template?.card.icon} size={16} />
        <span className="inspector-attachment-name">{name}</span>
        <button
          type="button"
          className="inspector-icon-btn"
          aria-label={`Remove ${name}`}
          onClick={() => void edit([{ op: "removeAttachment", id: attachment.id }])}
        >
          <IconX size={14} aria-hidden />
        </button>
      </div>
      {own.some((f) => !f.target.path) ? (
        <FindingList findings={own.filter((f) => !f.target.path)} />
      ) : null}
      {attachment.template.id === "resource-workspace" ? (
        <WorkspaceConfiguration element={element} attachment={attachment} />
      ) : attachment.template.id === "local-http-pool" ? (
        <LocalHttpPoolConfiguration element={element} attachment={attachment} />
      ) : attachment.template.id === "local-execution" ? (
        <LocalExecutionConfiguration attachment={attachment} />
      ) : attachment.template.id === "durable-events" ? (
        <DeliveryConfiguration attachment={attachment} />
      ) : attachment.template.id === "rest-api-server" && template ? (
        <>
          <ResourceConfiguration element={element} attachment={attachment} />
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: 12 }}>
              Advanced API configuration
            </summary>
            <p className="inspector-empty">
              Raw contract configuration. Changes to versioned recipe definitions can prevent
              generation; the structured editor preserves them.
            </p>
            <ConfigForm
              schema={template.configJsonSchema}
              manifest={registry.get(attachment.template)}
              config={attachment.config}
              findings={own}
              onCommit={(config) =>
                void edit([{ op: "updateAttachment", id: attachment.id, config }])
              }
            />
          </details>
        </>
      ) : template ? (
        <ConfigForm
          schema={template.configJsonSchema}
          manifest={registry.get(attachment.template)}
          config={attachment.config}
          findings={own}
          onCommit={(config) => void edit([{ op: "updateAttachment", id: attachment.id, config }])}
        />
      ) : null}
      {!["local-execution", "local-http-pool"].includes(attachment.template.id) ? (
        <NotesField id={attachment.id} notes={attachment.notes} label={`${name} notes`} />
      ) : null}
    </li>
  );
}

function ConnectionRow({ connection, elementId }: { connection: Connection; elementId: string }) {
  const { loaded, edit, focus } = useInspector();
  if (!loaded) return null;
  const outgoing = connection.from.element === elementId;
  const other = outgoing ? connection.to : connection.from;
  const otherName = endpointName(loaded.design, other);
  const kind = connectionLabels[connection.kind];
  return (
    <li className="inspector-connection">
      <span className="inspector-connection-kind">{outgoing ? kind : `${kind} ←`}</span>
      <button
        type="button"
        className="inspector-link"
        onClick={() => focus({ nodes: [other.element] }, { zoom: true })}
      >
        {outgoing ? <IconArrowRight size={14} aria-hidden /> : null}
        {otherName}
      </button>
      <button
        type="button"
        className="inspector-icon-btn"
        aria-label={`Remove connection: ${kind} ${otherName}`}
        onClick={() => void edit([{ op: "disconnect", id: connection.id }])}
      >
        <IconX size={14} aria-hidden />
      </button>
    </li>
  );
}

function AddAttachmentMenu({ element }: { element: Element }) {
  const { loaded, edit } = useInspector();
  const setNotice = useDraw((s) => s.setNotice);
  if (!loaded || !element.template) return null;
  const options = registry.attachmentsFor(element.template);
  if (options.length === 0) return null;
  return (
    <Menu position="bottom-start" shadow="md">
      <Menu.Target>
        <Button size="xs" variant="default" leftSection={<IconPlus size={14} />}>
          Add attachment
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {options.map((manifest) => (
          <Menu.Item
            key={manifest.id}
            leftSection={<TemplateIcon name={manifest.card.icon} size={16} />}
            onClick={() => {
              const plan = attach(loaded.design, registry, element.id, {
                id: manifest.id,
                version: manifest.version,
              });
              if (plan.ok) void edit(plan.ops);
              else setNotice({ tone: "error", message: plan.reason });
            }}
          >
            {manifest.displayName}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

function DeleteButton({ label, ops }: { label: string; ops: OperationInput[] }) {
  const edit = useDraw((s) => s.edit);
  return (
    <Button
      variant="default"
      color="red"
      size="xs"
      leftSection={<IconTrash size={14} />}
      className="inspector-delete"
      onClick={() => void edit(ops)}
    >
      {label}
    </Button>
  );
}

function ElementInspector({ element }: { element: Element }) {
  const { loaded, edit } = useInspector();
  if (!loaded) return null;
  const template = element.template
    ? loaded.templates.get(templateKey(element.template))
    : undefined;
  const findings = loaded.findingIndex.byNode.get(element.id) ?? [];
  const elementFindings = findings.filter((f) => !f.target.attachment);
  const connections = loaded.design.connections.filter(
    (c) => c.from.element === element.id || c.to.element === element.id,
  );

  return (
    <section className="inspector-body" aria-label={`Inspector: ${element.name}`}>
      <header className="inspector-head">
        <span className="element-card-icon">
          <TemplateIcon name={template?.card.icon} size={22} />
        </span>
        <span className="inspector-head-titles">
          <span className="inspector-kicker">{template?.displayName ?? "Needs a template"}</span>
          {template ? <span className="inspector-head-sub">{template.description}</span> : null}
        </span>
      </header>

      <DraftTextInput
        label="Name"
        value={element.name}
        onCommit={(name) => {
          if (name.trim()) void edit([{ op: "updateElement", id: element.id, name: name.trim() }]);
        }}
      />

      {template?.elementKind !== "database" ? <SubtypeControl element={element} /> : null}

      {elementFindings.some((f) => !f.target.path) ? (
        <Section title="Findings">
          <FindingList findings={elementFindings.filter((f) => !f.target.path)} />
        </Section>
      ) : null}

      {template ? (
        <Section title="Configuration">
          <ConfigForm
            schema={template.configJsonSchema}
            manifest={element.template ? registry.get(element.template) : undefined}
            config={element.config}
            findings={elementFindings}
            onCommit={(config) => void edit([{ op: "updateElement", id: element.id, config }])}
          />
        </Section>
      ) : null}

      <Section title="Implementation notes">
        <NotesField id={element.id} notes={element.notes} label="Notes" />
      </Section>

      <Section title="Attachments">
        {element.attachments.length > 0 ? (
          <ul className="inspector-attachments">
            {element.attachments.map((attachment) => (
              <AttachmentPanel
                key={attachment.id}
                element={element}
                attachment={attachment}
                findings={findings}
              />
            ))}
          </ul>
        ) : (
          <p className="inspector-empty">No attachments.</p>
        )}
        <AddAttachmentMenu element={element} />
      </Section>

      <Section title="Connections">
        {connections.length > 0 ? (
          <ul className="inspector-connections">
            {connections.map((c) => (
              <ConnectionRow key={c.id} connection={c} elementId={element.id} />
            ))}
          </ul>
        ) : (
          <p className="inspector-empty">
            Not connected. Use the Connector tool, or drag from a card's edge handle.
          </p>
        )}
      </Section>

      <DeleteButton label="Delete element" ops={[{ op: "removeElement", id: element.id }]} />
    </section>
  );
}

function ConnectionInspector({ connection }: { connection: Connection }) {
  const { loaded, focus } = useInspector();
  if (!loaded) return null;
  const findings = loaded.findingIndex.byEdge.get(connection.id) ?? [];
  const end = (label: string, endpoint: Endpoint) => (
    <div className="inspector-endpoint">
      <span className="inspector-kicker">{label}</span>
      <button
        type="button"
        className="inspector-link"
        onClick={() => focus({ nodes: [endpoint.element] }, { zoom: true })}
      >
        {endpointName(loaded.design, endpoint)}
      </button>
    </div>
  );
  return (
    <section className="inspector-body" aria-label="Inspector: connection">
      <header className="inspector-head">
        <span className="inspector-head-titles">
          <span className="inspector-kicker">Connection</span>
          <span className="inspector-title">{connectionLabels[connection.kind]}</span>
        </span>
      </header>
      {end("From", connection.from)}
      {end("To", connection.to)}
      {findings.length > 0 ? (
        <Section title="Findings">
          <FindingList findings={findings} />
        </Section>
      ) : null}
      <DeleteButton label="Delete connection" ops={[{ op: "disconnect", id: connection.id }]} />
    </section>
  );
}

const ANNOTATION_TITLES: Record<Annotation["kind"], string> = {
  text: "Text",
  note: "Sticky note",
  frame: "Frame",
  arrow: "Arrow",
};

function AnnotationInspector({ annotation }: { annotation: Annotation }) {
  const { edit } = useInspector();
  const update = (change: Record<string, string>) =>
    void edit([{ op: "updateAnnotation", id: annotation.id, ...change }]);
  return (
    <section
      className="inspector-body"
      aria-label={`Inspector: ${ANNOTATION_TITLES[annotation.kind]}`}
    >
      <header className="inspector-head">
        <span className="inspector-head-titles">
          <span className="inspector-kicker">Annotation</span>
          <span className="inspector-title">{ANNOTATION_TITLES[annotation.kind]}</span>
          <span className="inspector-head-sub">Presentation only; never affects generation.</span>
        </span>
      </header>
      {annotation.kind === "text" || annotation.kind === "note" ? (
        <DraftTextarea label="Text" value={annotation.text} onCommit={(text) => update({ text })} />
      ) : null}
      {annotation.kind === "note" ? (
        <fieldset className="inspector-colors">
          <legend>Color</legend>
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="inspector-color"
              data-color={color}
              aria-label={color}
              aria-pressed={(annotation.color ?? "yellow") === color}
              onClick={() => update({ color })}
            />
          ))}
        </fieldset>
      ) : null}
      {annotation.kind === "frame" ? (
        <DraftTextInput
          label="Title"
          value={annotation.title}
          onCommit={(title) => update({ title })}
        />
      ) : null}
      {annotation.kind === "arrow" ? (
        <DraftTextInput
          label="Label"
          value={annotation.label ?? ""}
          onCommit={(label) => update({ label })}
        />
      ) : null}
      <DeleteButton
        label={`Delete ${ANNOTATION_TITLES[annotation.kind].toLowerCase()}`}
        ops={[{ op: "removeAnnotation", id: annotation.id }]}
      />
    </section>
  );
}

function MultiInspector({ selection }: { selection: Selection }) {
  const { loaded, edit, focus } = useInspector();
  if (!loaded) return null;
  const count = selection.nodes.length + selection.edges.length;
  const ops = deleteOps(loaded.design, selection.nodes, selection.edges);
  return (
    <section className="inspector-body" aria-label="Inspector: selection">
      <header className="inspector-head">
        <span className="inspector-head-titles">
          <span className="inspector-kicker">Selection</span>
          <span className="inspector-title">{count} items selected</span>
        </span>
      </header>
      <div className="inspector-actions">
        <Button
          size="xs"
          variant="default"
          leftSection={<IconFocusCentered size={14} />}
          onClick={() => focus(selection, { zoom: true })}
        >
          Zoom to selection
        </Button>
        <Button
          size="xs"
          variant="default"
          color="red"
          leftSection={<IconTrash size={14} />}
          disabled={ops.length === 0}
          onClick={() => void edit(ops)}
        >
          Delete {count} items
        </Button>
      </div>
    </section>
  );
}

function Overview() {
  const loaded = useDraw((s) => s.loaded);
  const setRailTab = useDraw((s) => s.setRailTab);
  if (!loaded) return null;
  const { design, findings } = loaded;
  return (
    <section className="inspector-body" aria-label="Inspector: design">
      <header className="inspector-head">
        <span className="inspector-head-titles">
          <span className="inspector-kicker">Design</span>
          <span className="inspector-title">{loaded.project.name}</span>
        </span>
      </header>
      <p className="inspector-empty">
        {design.elements.length} elements · {design.connections.length} connections ·{" "}
        {design.annotations.length} annotations
      </p>
      <p className="inspector-empty">Select an item on the board to edit it here.</p>
      {findings.length > 0 ? (
        <Button size="xs" variant="default" onClick={() => setRailTab("findings")}>
          Show {findings.length} {findings.length === 1 ? "finding" : "findings"}
        </Button>
      ) : null}
    </section>
  );
}

export function Inspector() {
  const loaded = useDraw((s) => s.loaded);
  const selection = useDraw((s) => s.selection);
  if (!loaded) return null;
  const { design } = loaded;
  // Ignore IDs that an edit just removed, before React Flow reports the new selection.
  const nodes = selection.nodes.filter(
    (id) => design.elements.some((e) => e.id === id) || design.annotations.some((a) => a.id === id),
  );
  const edges = selection.edges.filter(
    (id) =>
      design.connections.some((c) => c.id === id) || design.annotations.some((a) => a.id === id),
  );
  if (nodes.length + edges.length > 1) return <MultiInspector selection={{ nodes, edges }} />;
  const id = nodes[0] ?? edges[0];
  const element = design.elements.find((e) => e.id === id);
  if (element) return <ElementInspector key={element.id} element={element} />;
  const connection = design.connections.find((c) => c.id === id);
  if (connection) return <ConnectionInspector key={connection.id} connection={connection} />;
  const annotation = design.annotations.find((a) => a.id === id);
  if (annotation) return <AnnotationInspector key={annotation.id} annotation={annotation} />;
  return <Overview />;
}
