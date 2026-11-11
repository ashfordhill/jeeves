/**
 * The sign-in stack (V3-06, v3 contract section 2): one Identity, Sign-in, verified by two Auth
 * guards. Watch API's Viewer check is Optional, beside a Custom stub that sees the caller. Upload
 * API's Creator check is Required, beside Multipart uploads, whose asset lifecycle runs in Video
 * lifecycle. Upload API has five links, the cap. Built by commands from a blank design; module
 * IDs are their names' slugs. Runnable processes on.
 */
import { type DesignDocument, emptyDesign } from "../design.ts";
import type { StudioComponentKind, StudioModuleSlotId } from "../studio-components.ts";
import type { StudioKind } from "../studio-model.ts";
import type { StudioCommand } from "../studio-operations.ts";
import { runStudioCommands } from "./v2-modules.ts";

const tile = (from: string, id: string, name: string, kind: StudioKind): StudioCommand => ({
  type: "addTile",
  from:
    from === "lane:download" || from === "lane:upload"
      ? { lane: from === "lane:download" ? "download" : "upload" }
      : { tile: from },
  side: "after",
  tile: { id, name, kind },
  linkId: `${from.replace("lane:", "")}-${id}`,
});
const link = (from: string, to: string): StudioCommand => ({
  type: "linkTiles",
  from: { tile: from },
  to,
  linkId: `${from}-${to}`,
});
const module = (host: string, id: string, name: string, kind: StudioComponentKind) =>
  ({ type: "addModule", host, kind, id, name }) satisfies StudioCommand;
const connect = (
  id: string,
  slot: StudioModuleSlotId,
  target: { tile: string } | { module: string },
): StudioCommand => ({ type: "connectModule", module: id, slot, target });

export const signInStackCommands: readonly StudioCommand[] = [
  { type: "addAction", lane: "download", name: "Watch", system: { name: "Sign-in stack" } },
  { type: "addAction", lane: "upload", name: "Publish" },
  tile("lane:download", "watch-api", "Watch API", "service"),
  tile("lane:upload", "sign-in", "Sign-in", "identity"),
  link("watch-api", "sign-in"),
  tile("lane:upload", "upload-api", "Upload API", "uploads"),
  link("upload-api", "sign-in"),
  tile("upload-api", "metadata", "Metadata", "database"),
  tile("upload-api", "originals", "Original videos", "object-store"),
  tile("upload-api", "upload-jobs", "Upload jobs", "queue"),
  tile("upload-api", "processing-events", "Processing events", "queue"),
  tile("processing-events", "video-lifecycle", "Video lifecycle", "worker"),
  link("video-lifecycle", "metadata"),
  module("watch-api", "viewer-check", "Viewer check", "auth-guard"),
  module("watch-api", "hello", "Hello", "custom"),
  connect("viewer-check", "identity", { tile: "sign-in" }),
  module("upload-api", "creator-check", "Creator check", "auth-guard"),
  module("upload-api", "multipart-uploads", "Multipart uploads", "multipart-uploads"),
  module("upload-api", "job-outbox", "Job outbox publisher", "event-publisher"),
  module("upload-api", "upload-state", "Upload state writer", "data-access"),
  connect("creator-check", "identity", { tile: "sign-in" }),
  connect("multipart-uploads", "objects", { tile: "originals" }),
  connect("job-outbox", "channel", { tile: "upload-jobs" }),
  connect("job-outbox", "outbox", { tile: "metadata" }),
  connect("upload-state", "database", { tile: "metadata" }),
  module("video-lifecycle", "processing-consumer", "Processing consumer", "event-consumer"),
  module("video-lifecycle", "lifecycle-writer", "Lifecycle writer", "lifecycle-writer"),
  connect("processing-consumer", "channel", { tile: "processing-events" }),
  connect("lifecycle-writer", "state", { tile: "metadata" }),
];

/** A guard's settings with Sign-in set: what the module page's select sends. */
export function signIn(
  design: DesignDocument,
  guard: string,
  value: "required" | "optional",
): StudioCommand {
  const settings = design.architecture?.studio?.components?.find(
    (item) => item.id === guard,
  )?.settings;
  if (settings?.kind !== "auth-guard") throw new Error(`${guard} is not an Auth guard`);
  return { type: "editComponent", component: guard, settings: { ...settings, signIn: value } };
}

/** The sign-in stack: Viewer check Optional, Creator check Required, Runnable processes on. */
export function signInStackDesign(): DesignDocument {
  const built = runStudioCommands(emptyDesign(), signInStackCommands);
  return runStudioCommands(built, [
    signIn(built, "viewer-check", "optional"),
    { type: "setRunnableProcesses", on: true },
  ]);
}
