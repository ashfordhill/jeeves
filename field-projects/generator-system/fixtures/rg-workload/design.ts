import { type DesignDocument, emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

/** Explicit migration of the active stub-stack test input; processes-off source stays intact. */
export function withStubWorkloads(design: DesignDocument): DesignDocument {
  return runStudioCommands(design, [
    {
      type: "addTile",
      from: { tile: "stats-api" },
      side: "after",
      tile: { id: "workload-issuer", name: "Workload issuer", kind: "identity" },
      linkId: "stats-workload",
    },
    {
      type: "linkTiles",
      from: { tile: "links-api" },
      to: "workload-issuer",
      linkId: "links-workload",
    },
    {
      type: "connectModule",
      module: "stats-search",
      slot: "workload",
      target: { tile: "workload-issuer" },
    },
    {
      type: "connectModule",
      module: "stats-caller",
      slot: "workload",
      target: { tile: "workload-issuer" },
    },
  ]);
}

export function workloadDesign(user = false): DesignDocument {
  const design = runStudioCommands(emptyDesign(), [
    { type: "addAction", lane: "download", name: "Read", system: { name: "Workload fixture" } },
    {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: { id: "caller", name: "Caller", kind: "service" },
      linkId: "read-caller",
    },
    {
      type: "addTile",
      from: { tile: "caller" },
      side: "after",
      tile: { id: "callee", name: "Callee", kind: "service" },
      linkId: "caller-callee",
    },
    {
      type: "addTile",
      from: { tile: "callee" },
      side: "after",
      tile: { id: "issuer", name: "Issuer", kind: "identity" },
      linkId: "callee-issuer",
    },
    { type: "linkTiles", from: { tile: "caller" }, to: "issuer", linkId: "caller-issuer" },
    { type: "addModule", host: "caller", id: "send", name: "Send", kind: "custom" },
    { type: "addModule", host: "callee", id: "receive", name: "Receive", kind: "custom" },
    { type: "connectModule", module: "send", slot: "uses", target: { tile: "callee" } },
    { type: "connectModule", module: "send", slot: "workload", target: { tile: "issuer" } },
    { type: "connectModule", module: "receive", slot: "workload", target: { tile: "issuer" } },
    { type: "setRunnableProcesses", on: true },
  ]);
  return user
    ? runStudioCommands(design, [
        {
          type: "addModule",
          host: "caller",
          id: "caller-auth",
          name: "Caller auth",
          kind: "auth-guard",
        },
        {
          type: "connectModule",
          module: "caller-auth",
          slot: "identity",
          target: { tile: "issuer" },
        },
        {
          type: "addModule",
          host: "callee",
          id: "callee-auth",
          name: "Callee auth",
          kind: "auth-guard",
        },
        {
          type: "connectModule",
          module: "callee-auth",
          slot: "identity",
          target: { tile: "issuer" },
        },
      ])
    : design;
}
