import { z } from "zod";
import {
  type Annotation,
  annotationSchema,
  capabilityEndpoint,
  type DesignDocument,
  designIds,
  type Element,
  upgradeDesign,
} from "./design.ts";
import { type Finding, finding, isStructural } from "./findings.ts";
import type { TemplateLookup } from "./manifest.ts";
import { type Operation, type OperationInput, operationSchema } from "./operations.ts";
import { sameSubtype, subtypeDiscards } from "./subtype.ts";
import { validateDesign } from "./validate.ts";

export interface ApplyOptions {
  /** Revision the caller based its edits on. A mismatch is a `REVISION_CONFLICT`. */
  baseRevision?: number;
  allowSubtypeConfirmation?: boolean;
}

export type ApplyResult =
  | { ok: true; design: DesignDocument; findings: Finding[] }
  | { ok: false; errors: Finding[] };

class OpError extends Error {
  constructor(readonly finding: Finding) {
    super(finding.message);
  }
}

/**
 * Applies a batch of operations all-or-nothing and returns the new design (revision + 1) with its
 * findings. The batch is rejected if any operation is malformed or refers to something missing,
 * or if the result has a structural problem the input didn't already have. Readiness findings
 * never reject a batch. The input design is not modified.
 */
export function applyOperations(
  design: DesignDocument,
  ops: readonly OperationInput[],
  lookup: TemplateLookup,
  options: ApplyOptions = {},
): ApplyResult {
  if (options.baseRevision !== undefined && options.baseRevision !== design.revision) {
    return {
      ok: false,
      errors: [
        finding(
          "REVISION_CONFLICT",
          `The design changed (now revision ${design.revision}, edits were based on ${options.baseRevision}). Reload and try again.`,
        ),
      ],
    };
  }

  const parsed = z.array(operationSchema).min(1).safeParse(ops);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const [index, ...path] = issue.path;
        return finding(
          "INVALID_OPERATION",
          `${path.length > 0 ? `${path.join(".")}: ` : ""}${issue.message}`,
          typeof index === "number" ? { op: index } : {},
        );
      }),
    };
  }

  const draft = upgradeDesign(design);
  try {
    parsed.data.forEach((op, index) => {
      applyOne(draft, op, index, options);
    });
  } catch (error) {
    if (error instanceof OpError) return { ok: false, errors: [error.finding] };
    throw error;
  }

  const before = new Set(validateDesign(design, lookup).filter(isStructural).map(findingKey));
  const findings = validateDesign(draft, lookup);
  const introduced = findings.filter((f) => isStructural(f) && !before.has(findingKey(f)));
  if (introduced.length > 0) return { ok: false, errors: introduced };

  draft.revision = design.revision + 1;
  return { ok: true, design: draft, findings };
}

function findingKey(f: Finding): string {
  return `${f.code} ${JSON.stringify(f.target)}`;
}

function applyOne(
  design: DesignDocument,
  op: Operation,
  index: number,
  options: ApplyOptions,
): void {
  const missing = (what: string, id: string) =>
    new OpError(finding("UNKNOWN_REFERENCE", `There is no ${what} "${id}".`, { op: index }));
  const ensureFree = (id: string) => {
    for (const entry of designIds(design)) {
      if (entry.id === id) {
        throw new OpError(
          finding("DUPLICATE_ID", `ID "${id}" is already used by a ${entry.type}.`, { op: index }),
        );
      }
    }
  };
  const findElement = (id: string) => {
    const element = design.elements.find((e) => e.id === id);
    if (!element) throw missing("element", id);
    return element;
  };
  const findAttachment = (id: string) => {
    for (const element of design.elements) {
      const attachment = element.attachments.find((a) => a.id === id);
      if (attachment) return { element, attachment };
    }
    throw missing("attachment", id);
  };

  switch (op.op) {
    case "addElement": {
      ensureFree(op.element.id);
      for (const attachment of op.element.attachments) ensureFree(attachment.id);
      design.elements.push(op.element);
      return;
    }
    case "updateElement": {
      const element = findElement(op.id);
      if (
        op.template !== undefined &&
        !sameSubtype(element.template, op.template) &&
        subtypeDiscards(design, element).length
      ) {
        throw new OpError(
          finding(
            "INVALID_OPERATION",
            "Use changeSubtype to review discarded configuration, components and connections.",
            { op: index },
          ),
        );
      }
      if (op.name !== undefined) element.name = op.name;
      if (op.template !== undefined) element.template = op.template;
      if (op.config !== undefined) element.config = op.config;
      return;
    }
    case "changeSubtype": {
      const element = findElement(op.id);
      if (sameSubtype(element.template, op.template)) return;
      const discarded = subtypeDiscards(design, element);
      if (
        discarded.length &&
        (options.allowSubtypeConfirmation === false ||
          op.confirmation?.revision !== design.revision ||
          JSON.stringify(op.confirmation.discarded) !== JSON.stringify(discarded))
      ) {
        throw new OpError(
          finding(
            "INVALID_OPERATION",
            `Subtype change requires confirmation at revision ${design.revision}. Discarded: ${discarded.join("; ")}. Review and confirm this change in the editor.`,
            { op: index },
          ),
        );
      }
      unbindArrows(
        design,
        element.attachments.map((a) => a.id),
      );
      element.template = op.template;
      element.config = {};
      element.attachments = [];
      design.connections = design.connections.filter(
        (c) => c.from.element !== element.id && c.to.element !== element.id,
      );
      return;
    }
    case "removeElement": {
      const element = findElement(op.id);
      design.elements = design.elements.filter((e) => e !== element);
      design.connections = design.connections.filter(
        (c) => c.from.element !== op.id && c.to.element !== op.id,
      );
      unbindArrows(design, [element.id, ...element.attachments.map((a) => a.id)]);
      return;
    }
    case "addAttachment": {
      const element = findElement(op.element);
      ensureFree(op.attachment.id);
      element.attachments.push(op.attachment);
      return;
    }
    case "updateAttachment": {
      const { attachment } = findAttachment(op.id);
      if (op.template !== undefined) attachment.template = op.template;
      if (op.config !== undefined) attachment.config = op.config;
      return;
    }
    case "removeAttachment": {
      const { element } = findAttachment(op.id);
      element.attachments = element.attachments.filter((a) => a.id !== op.id);
      design.connections = design.connections.filter(
        (c) =>
          capabilityEndpoint(c, "from").attachment !== op.id &&
          capabilityEndpoint(c, "to").attachment !== op.id,
      );
      unbindArrows(design, [op.id]);
      return;
    }
    case "connect": {
      ensureFree(op.connection.id);
      design.connections.push(
        upgradeDesign({ ...design, schemaVersion: 1, connections: [op.connection] })
          .connections[0] as typeof op.connection,
      );
      return;
    }
    case "disconnect": {
      if (!design.connections.some((c) => c.id === op.id)) throw missing("connection", op.id);
      design.connections = design.connections.filter((c) => c.id !== op.id);
      return;
    }
    case "setNotes": {
      const owner: Element | { notes: string } | undefined =
        design.elements.find((e) => e.id === op.id) ??
        design.elements.flatMap((e) => e.attachments).find((a) => a.id === op.id);
      if (!owner) throw missing("element or attachment", op.id);
      owner.notes = op.notes;
      return;
    }
    case "addAnnotation": {
      ensureFree(op.annotation.id);
      design.annotations.push(op.annotation);
      return;
    }
    case "updateAnnotation": {
      const position = design.annotations.findIndex((a) => a.id === op.id);
      const current = design.annotations[position];
      if (!current) throw missing("annotation", op.id);
      const { op: _op, id: _id, ...changes } = op;
      const merged: Record<string, unknown> = { ...current };
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) delete merged[key];
        else if (value !== undefined) merged[key] = value;
      }
      const result = annotationSchema.safeParse(merged);
      if (!result.success) {
        throw new OpError(
          finding(
            "INVALID_OPERATION",
            `A ${current.kind} annotation can't take ${Object.keys(changes).join(", ")}: ${result.error.issues[0]?.message}`,
            { op: index, annotation: op.id },
          ),
        );
      }
      design.annotations[position] = result.data;
      return;
    }
    case "removeAnnotation": {
      if (!design.annotations.some((a) => a.id === op.id)) throw missing("annotation", op.id);
      design.annotations = design.annotations.filter((a) => a.id !== op.id);
      unbindArrows(design, [op.id]);
      return;
    }
  }
}

function unbindArrows(design: DesignDocument, ids: readonly string[]): void {
  design.annotations = design.annotations.map((annotation): Annotation => {
    if (annotation.kind !== "arrow") return annotation;
    const next = { ...annotation };
    if (next.from !== undefined && ids.includes(next.from)) delete next.from;
    if (next.to !== undefined && ids.includes(next.to)) delete next.to;
    return next;
  });
}
