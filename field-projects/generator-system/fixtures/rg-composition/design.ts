import type { DesignDocument } from "../../../../jeeves/packages/spec/src/design.ts";
import type { StudioCommand } from "../../../../jeeves/packages/spec/src/studio-operations.ts";
import { foundationsDesign } from "../rg-foundations/design.ts";
import { scheduledDesign } from "../rg-scheduled/design.ts";
import { sessionForwardingDesign } from "../rg-session-forwarding/design.ts";

export interface CompositionCase {
  id: string;
  design(): DesignDocument;
  command(design: DesignDocument): StudioCommand;
  accepted: boolean;
  reason?: string;
}

/** Independent expected outcomes, not inferred from the resolver/emitter under test. */
export const compositionCases: readonly CompositionCase[] = [
  {
    id: "versioned-in-process-read",
    design: foundationsDesign,
    command: () => ({
      type: "editComponent",
      component: "record-reader",
      settings: {
        kind: "cache-reader",
        pattern: "cache-aside",
        stampede: "single-flight",
        freshness: "versioned",
        transport: "in-process",
      },
    }),
    accepted: true,
  },
  {
    id: "immutable-is-custom-policy",
    design: foundationsDesign,
    command: () => ({
      type: "editComponent",
      component: "record-reader",
      settings: {
        kind: "cache-reader",
        pattern: "cache-aside",
        stampede: "single-flight",
        freshness: "immutable-positive",
        transport: "in-process",
      },
    }),
    accepted: true,
  },
  {
    id: "internal-http-reader",
    design: foundationsDesign,
    command: () => ({
      type: "editComponent",
      component: "record-reader",
      settings: {
        kind: "cache-reader",
        pattern: "cache-aside",
        stampede: "single-flight",
        freshness: "versioned",
        transport: "http",
      },
    }),
    accepted: false,
    reason: "workload-authenticated template adapter",
  },
  {
    id: "session-matching-user-and-workload",
    design: sessionForwardingDesign,
    command: () => ({ type: "editComponent", component: "send", name: "Renamed sender" }),
    accepted: true,
  },
  {
    id: "missing-workload",
    design: sessionForwardingDesign,
    command: (design) => {
      const link = design.architecture?.studio?.componentConnections?.find(
        (link) => link.from === "send" && link.slot === "workload",
      );
      if (!link) throw Error("Fixture workload link missing");
      return { type: "disconnectModule", link: link.id };
    },
    accepted: false,
    reason: "requires both processes",
  },
  {
    id: "missing-user-caller",
    design: sessionForwardingDesign,
    command: () => ({ type: "removeModule", module: "browser-session" }),
    accepted: false,
    reason: "requires an end-user credential",
  },
  {
    id: "incomplete-scheduled-lifecycle",
    design: scheduledDesign,
    command: () => ({ type: "setRunnableProcesses", on: false }),
    accepted: false,
    reason: "require Runnable processes",
  },
  {
    id: "unsafe-external-retry",
    design: sessionForwardingDesign,
    command: () => ({
      type: "editConnection",
      connection: "caller-callee",
      settings: { retry: { mode: "fixed", attempts: 3, delayMs: 100 } },
    }),
    accepted: false,
    reason: "no installed consumer for retry",
  },
];
