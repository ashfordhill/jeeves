import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { workloadDesign } from "../rg-workload/design.ts";

/** New request-scoped browser-to-generated-operation proof; no product route policy. */
export function sessionForwardingDesign() {
  return runStudioCommands(workloadDesign(), [
    { type: "addModule", host: "callee", kind: "auth-guard", id: "callee-auth" },
    { type: "connectModule", module: "callee-auth", slot: "identity", target: { tile: "issuer" } },
    { type: "addModule", host: "caller", kind: "browser-session", id: "browser-session" },
    {
      type: "connectModule",
      module: "browser-session",
      slot: "identity",
      target: { tile: "issuer" },
    },
    {
      type: "addTile",
      from: { tile: "caller" },
      side: "after",
      tile: { id: "sessions", name: "Sessions", kind: "database" },
      linkId: "caller-sessions",
    },
    {
      type: "connectModule",
      module: "browser-session",
      slot: "state",
      target: { tile: "sessions" },
    },
  ]);
}

/** Workload-only Worker compiles private forwarding assets even without any HTTP process. */
export function workloadWorkerDesign() {
  return runStudioCommands(workloadDesign(), [
    { type: "removeTile", tile: "callee" },
    { type: "removeModule", module: "send" },
    {
      type: "addTile",
      from: { tile: "caller" },
      side: "after",
      tile: { id: "jobs", name: "Jobs", kind: "queue" },
      linkId: "caller-jobs",
    },
    {
      type: "addTile",
      from: { tile: "jobs" },
      side: "after",
      tile: { id: "worker", name: "Worker", kind: "worker" },
      linkId: "jobs-worker",
    },
    { type: "addModule", host: "worker", id: "task", kind: "custom" },
    { type: "linkTiles", from: { tile: "worker" }, to: "issuer", linkId: "worker-issuer" },
    { type: "connectModule", module: "task", slot: "workload", target: { tile: "issuer" } },
  ]);
}
