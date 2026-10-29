/**
 * Presentation-only items: free text, sticky notes, and frames. Double-click edits the text in
 * place; the change is saved as one `updateAnnotation` operation when the field loses focus.
 */
import type { Annotation } from "@jeeves/spec";
import { Handle, type NodeProps, NodeResizer, Position } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { type AnnotationNode, handleId } from "../flow.ts";
import { useDraw } from "../store.ts";

type Editable = Extract<Annotation, { kind: "text" | "note" | "frame" }>;

function currentText(annotation: Editable): string {
  return annotation.kind === "frame" ? annotation.title : annotation.text;
}

function InlineText({ annotation, placeholder }: { annotation: Editable; placeholder: string }) {
  const editing = useDraw((s) => s.editing === annotation.id);
  const setEditing = useDraw((s) => s.setEditing);
  const edit = useDraw((s) => s.edit);
  const value = currentText(annotation);
  const [draft, setDraft] = useState(value);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    setDraft(value);
    const el = field.current;
    el?.focus();
    el?.setSelectionRange(value.length, value.length);
  }, [editing, value]);

  const commit = () => {
    setEditing(undefined);
    if (draft === value) return;
    const change = annotation.kind === "frame" ? { title: draft } : { text: draft };
    void edit([{ op: "updateAnnotation", id: annotation.id, ...change }]);
  };

  if (editing) {
    return (
      <textarea
        ref={field}
        className="annotation-editor nodrag nopan nowheel"
        aria-label={`Edit ${annotation.kind}`}
        value={draft}
        rows={annotation.kind === "frame" ? 1 : 3}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(undefined);
          } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey || annotation.kind === "frame")) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    );
  }
  return (
    <span className="annotation-text" data-empty={value ? undefined : true}>
      {value || placeholder}
    </span>
  );
}

function Handles() {
  return (
    <>
      <Handle type="target" position={Position.Left} id={handleId("in")} className="card-handle" />
      <Handle
        type="source"
        position={Position.Right}
        id={handleId("out")}
        className="card-handle"
      />
    </>
  );
}

function useResize(id: string) {
  const setLayoutItems = useDraw((s) => s.setLayoutItems);
  const layoutItem = useDraw((s) => s.loaded?.layout.items[id]);
  return (_: unknown, size: { x: number; y: number; width: number; height: number }) =>
    setLayoutItems({ [id]: { ...layoutItem, ...size } }, { undoable: true });
}

export function TextNode({ data, selected }: NodeProps<AnnotationNode>) {
  const annotation = data.annotation as Editable;
  return (
    <article className={`text-annotation${selected ? " is-selected" : ""}`} aria-label="Text">
      <Handles />
      <InlineText annotation={annotation} placeholder="Double-click to write" />
    </article>
  );
}

export function NoteNode({ id, data, selected }: NodeProps<AnnotationNode>) {
  const annotation = data.annotation as Editable;
  const onResizeEnd = useResize(id);
  const color = annotation.kind === "note" ? (annotation.color ?? "yellow") : "yellow";
  return (
    <article
      className={`note-annotation${selected ? " is-selected" : ""}`}
      data-color={color}
      aria-label="Sticky note"
    >
      <NodeResizer isVisible={!!selected} minWidth={120} minHeight={80} onResizeEnd={onResizeEnd} />
      <Handles />
      <InlineText annotation={annotation} placeholder="Double-click to write" />
    </article>
  );
}

export function FrameNode({ id, data, selected }: NodeProps<AnnotationNode>) {
  const annotation = data.annotation as Editable;
  const onResizeEnd = useResize(id);
  return (
    <article className={`frame-annotation${selected ? " is-selected" : ""}`} aria-label="Frame">
      <NodeResizer
        isVisible={!!selected}
        minWidth={160}
        minHeight={120}
        onResizeEnd={onResizeEnd}
      />
      <Handles />
      <div className="frame-title">
        <InlineText annotation={annotation} placeholder="Frame" />
      </div>
    </article>
  );
}
