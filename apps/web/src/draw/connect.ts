/**
 * What the connector does when a user links two items: a typed connection between elements or
 * attachments, a plain arrow when either end is an annotation, or a refusal with an explanation
 * and suggested fixes. Uses the same registry checks the server applies, so the canvas refuses
 * exactly what the API would reject.
 */
import type { Registry } from "@jeeves/registry";
import {
  type ConnectionKind,
  connectionKindSchema,
  type DesignDocument,
  type Endpoint,
  findPort,
  type OperationInput,
  resolveEndpoint,
} from "@jeeves/spec";
import { uniqueId } from "./ids.ts";

/** One end of a connector gesture: an element, one of its attachments, or an annotation. */
export type CanvasEnd = { element: string; attachment?: string } | { annotation: string };

export type ConnectAction = { label: string; ops: OperationInput[] };

export type ConnectPlan =
  | { ok: true; ops: OperationInput[] }
  /** More than one connection kind fits; the user picks one. */
  | { ok: "choose"; choices: ConnectAction[] }
  | { ok: false; reason: string; fixes: ConnectAction[] };

export const connectionLabels: Record<ConnectionKind, string> = {
  "uses-database": "uses database",
  calls: "calls",
  "depends-on": "depends on",
};

function endId(end: CanvasEnd): string {
  return "annotation" in end ? end.annotation : (end.attachment ?? end.element);
}

function sameEnd(a: CanvasEnd, b: CanvasEnd): boolean {
  return endId(a) === endId(b);
}

function connectOp(
  design: DesignDocument,
  kind: ConnectionKind,
  from: Endpoint,
  to: Endpoint,
  reserved?: ReadonlySet<string>,
): OperationInput {
  const id = uniqueId(
    design,
    `${from.attachment ?? from.element}-to-${to.attachment ?? to.element}`,
    reserved,
  );
  return {
    op: "connect",
    connection: {
      id,
      kind,
      from: { element: from.element },
      to: { element: to.element },
      ...((from.attachment || to.attachment) && {
        config: {
          ...(from.attachment && { fromCapability: from.attachment }),
          ...(to.attachment && { toCapability: to.attachment }),
        },
      }),
    },
  };
}

export function planConnect(
  design: DesignDocument,
  registry: Registry,
  from: CanvasEnd,
  to: CanvasEnd,
): ConnectPlan {
  if (sameEnd(from, to))
    return { ok: false, reason: "Pick two different items to connect.", fixes: [] };

  if ("annotation" in from || "annotation" in to) {
    const id = uniqueId(design, "arrow");
    return {
      ok: true,
      ops: [
        {
          op: "addAnnotation",
          annotation: { id, kind: "arrow", from: endId(from), to: endId(to) },
        },
      ],
    };
  }

  // A visible outer end can offer several attachment capabilities. Never guess between them.
  const candidates = (end: Endpoint): Endpoint[] =>
    end.attachment
      ? [end]
      : [
          end,
          ...(design.elements.find((e) => e.id === end.element)?.attachments ?? []).map((a) => ({
            element: end.element,
            attachment: a.id,
          })),
        ];
  const pairs = candidates(from).flatMap((f) =>
    candidates(to).flatMap((t) =>
      registry
        .connectionKinds(design, f, t)
        .filter((k) => k !== "depends-on")
        .map((kind) => ({ f, t, kind })),
    ),
  );
  if (pairs.length === 1 && pairs[0])
    return { ok: true, ops: [connectOp(design, pairs[0].kind, pairs[0].f, pairs[0].t)] };
  if (pairs.length > 1)
    return {
      ok: "choose",
      choices: pairs.map(({ f, t, kind }) => ({
        label: `${connectionLabels[kind]} · ${f.attachment ?? f.element} → ${t.attachment ?? t.element}`,
        ops: [connectOp(design, kind, f, t)],
      })),
    };
  const kinds = registry.connectionKinds(design, from, to);
  if (kinds.length === 1 && kinds[0])
    return { ok: true, ops: [connectOp(design, kinds[0], from, to)] };
  if (kinds.length > 1) {
    return {
      ok: "choose",
      choices: kinds.map((kind) => ({
        label: connectionLabels[kind],
        ops: [connectOp(design, kind, from, to)],
      })),
    };
  }

  const reverse = registry.connectionKinds(design, to, from)[0];
  if (reverse) {
    const name = (end: Endpoint) => resolveEndpoint(design, end, registry)?.label ?? end.element;
    return {
      ok: false,
      reason: `${capitalize(name(from))} can't start a "${reverse}" connection to ${name(to)}; it goes the other way.`,
      fixes: [
        {
          label: `Connect from ${name(to)} to ${name(from)} instead.`,
          ops: [connectOp(design, reverse, to, from)],
        },
      ],
    };
  }

  const kind = likelyKind(design, registry, from, to);
  const verdict = registry.canConnect(design, kind, from, to);
  if (verdict.ok) return { ok: true, ops: [connectOp(design, kind, from, to)] };
  const fixes: ConnectAction[] = [];
  for (const suggestion of verdict.suggestions) {
    if (suggestion.useEndpoint) {
      const end = suggestion.useEndpoint;
      const isFrom = end.element === from.element;
      const nextFrom = isFrom ? end : from;
      const nextTo = isFrom ? to : end;
      fixes.push({ label: suggestion.message, ops: [connectOp(design, kind, nextFrom, nextTo)] });
    } else if (suggestion.addAttachment) {
      const { element, template } = suggestion.addAttachment;
      const attachmentId = uniqueId(design, `${element}-${template.id}`);
      const reserved = new Set([attachmentId]);
      const end = { element, attachment: attachmentId };
      const isFrom = element === from.element;
      fixes.push({
        label: suggestion.message,
        ops: [
          { op: "addAttachment", element, attachment: { id: attachmentId, template } },
          connectOp(design, kind, isFrom ? end : from, isFrom ? to : end, reserved),
        ],
      });
    }
  }
  return { ok: false, reason: verdict.reason, fixes };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The connection kind the user most likely meant, so the refusal explains the right rule: one
 * the source can send, preferring one the target can also receive.
 */
function likelyKind(
  design: DesignDocument,
  registry: Registry,
  from: Endpoint,
  to: Endpoint,
): ConnectionKind {
  const source = resolveEndpoint(design, from, registry)?.manifest;
  const target = resolveEndpoint(design, to, registry)?.manifest;
  const kinds = connectionKindSchema.options;
  const out = kinds.filter((k) => source && findPort(source, k, "out"));
  const into = kinds.filter((k) => target && findPort(target, k, "in"));
  return (
    out.find((k) => into.includes(k)) ??
    out.find((k) => k !== "depends-on") ??
    into.find((k) => k !== "depends-on") ??
    out[0] ??
    into[0] ??
    "depends-on"
  );
}
