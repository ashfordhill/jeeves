/**
 * The chat design evals (V3-10): build YouTube v3 from a plain-prose brief, and review designs
 * seeded with one known defect each, one per review finding class (V3-09). Seeds are built with
 * the commands the mouse sends; a defect the commands refuse is a direct document edit, as an old
 * or hand-made design could have.
 */
import { readFileSync } from "node:fs";
import {
  applyOperations,
  buildModulePattern,
  buildSupportedAuthoringCommand,
  type DesignDocument,
  type DesignReviewCheck,
  emptyDesign,
  type GenerationInstalledSupport,
  type ModulePattern,
  type StudioCommand,
} from "@jeeves/spec";
import {
  V3_VALUES,
  type V3Value,
  v3ModuleDesign,
} from "../../../../packages/spec/src/fixtures/v3-modules.ts";
import { installedGenerationSupport } from "../generation/support.ts";

/** 1.0.0 (V3-10): the v3 build and nine review seeds. */
export const DESIGN_EVAL_VERSION = "1.0.0";
/** The same bounds as RF06, with more time: a build is one long turn. */
export const DESIGN_LIMITS = { rounds: 16, maxOutputTokens: 4096, caseTimeoutMs: 300_000 };

/** The v3 brief: contract section 5 in an owner's words, with no IDs or command syntax. */
export const V3_BRIEF = readFileSync(new URL("./fixtures/v3-brief.md", import.meta.url), "utf8");
/** One owner prompt for every review case. */
export const REVIEW_PROMPT =
  "Review this design and fix what is wrong. Tell me what you found and what you changed.";

export type BuildCase = {
  id: string;
  kind: "build";
  prompt: string;
  seed: () => DesignDocument;
  reference: (installed: GenerationInstalledSupport) => DesignDocument;
  /** The brief's useful values, scored with the templates. */
  values: readonly V3Value[];
};
export type ReviewCase = {
  id: string;
  kind: "review";
  check: DesignReviewCheck;
  /** What is seeded, for the report. */
  defect: string;
  prompt: string;
  seed: () => DesignDocument;
  /** Where the review reports it, by name: the finding is gone when none of its class is here. */
  at: { tile?: string; module?: string };
  /** Names that place it in a reply; any one counts. */
  subjects: readonly string[];
  /** Words that say what is wrong; any one counts. */
  terms: readonly string[];
  /** `fix`: the design must lose the finding. `keep`: advice; the right change is none. */
  expect: "fix" | "keep";
  /**
   * `legacy`: the lane rules refuse saving this defect today, so the seed is stored as a design
   * saved before them would be (a direct revision), not through an edit.
   */
  stored?: "legacy";
};
export type DesignCase = BuildCase | ReviewCase;

export const buildCase: BuildCase = {
  id: "v3-build",
  kind: "build",
  prompt: V3_BRIEF,
  seed: emptyDesign,
  reference: (installed) => v3ModuleDesign(installed),
  values: V3_VALUES,
};

const installed = () => installedGenerationSupport();
/** Runs commands with the supported builder, as the mouse and chat send them. */
export function run(design: DesignDocument, commands: readonly StudioCommand[]): DesignDocument {
  return commands.reduce((current, command) => {
    const batch = buildSupportedAuthoringCommand(current, command, installed());
    const result = applyOperations(current, batch.ops);
    if (!result.ok) throw new Error(`Invalid seed command: ${JSON.stringify(result.errors)}`);
    return result.design;
  }, design);
}
const pattern = (design: DesignDocument, ...steps: ModulePattern[]) =>
  steps.reduce((current, step) => buildModulePattern(current, step, installed()).design, design);
/** A direct document edit, as an old or hand-made design could have. */
function edited(design: DesignDocument, change: (draft: DesignDocument) => void) {
  const draft = structuredClone(design);
  change(draft);
  return draft;
}
const settingsOf = (design: DesignDocument, element: string) => {
  const row = design.architecture?.studio?.elements.find((item) => item.element === element);
  if (!row) throw new Error(`No tile ${element}`);
  return row;
};
const tile = (
  from: { lane: "download" | "upload" } | { tile: string },
  id: string,
  name: string,
  kind: "service" | "uploads" | "worker" | "database" | "queue" | "object-store",
  system?: string,
): StudioCommand => ({
  type: "addTile",
  from,
  side: "after",
  tile: { id, name, kind },
  linkId: `${"lane" in from ? from.lane : from.tile}-${id}`,
  ...(system && { system: { name: system } }),
});
const addModule = (host: string, id: string, kind: string, name: string) =>
  ({ type: "addModule", host, id, kind, name }) as StudioCommand;
const connect = (module: string, slot: string, target: { tile: string } | { module: string }) =>
  ({ type: "connectModule", module, slot, target }) as StudioCommand;

/** A shop whose Catalog API writes Catalog and whose Shop API reads it (both stubs). */
const shop = () =>
  pattern(emptyDesign(), { id: "owned-store", system: "Shop", readers: ["Shop API"] });

export const reviewCases: readonly ReviewCase[] = [
  {
    id: "review-module-status",
    kind: "review",
    check: "module-status",
    defect:
      "Favorite videos is a Stub: Account API's Auth guard is Optional, and Favorites needs it Required.",
    prompt: REVIEW_PROMPT,
    seed: () =>
      run(
        pattern(emptyDesign(), {
          id: "sign-in",
          tile: "Account API",
          signIn: "optional",
          guard: "Account check",
          system: "Accounts",
        }),
        [
          tile({ tile: "account-api" }, "favorites", "Favorites", "database"),
          addModule("account-api", "account-api-favorite-videos", "favorites", "Favorite videos"),
          connect("account-api-favorite-videos", "state", { tile: "favorites" }),
        ],
      ),
    at: { module: "Favorite videos" },
    subjects: ["Favorite videos", "Account check"],
    terms: ["stub", "required", "optional", "anonymous"],
    expect: "fix",
  },
  {
    id: "review-unconnected-slot",
    kind: "review",
    check: "unconnected-slot",
    defect: "Price reader, a Data access in Shop API, has nothing in its database slot.",
    prompt: REVIEW_PROMPT,
    seed: () =>
      run(shop(), [addModule("shop-api", "shop-api-price-reader", "data-access", "Price reader")]),
    at: { module: "Price reader" },
    subjects: ["Price reader"],
    terms: ["slot", "connect", "unconnected", "nothing", "database"],
    expect: "fix",
  },
  {
    id: "review-generation",
    kind: "review",
    check: "generation",
    defect:
      "Account check's Sign-in selection is pinned to template version 0.0.1, which is not installed (an older saved design).",
    prompt: REVIEW_PROMPT,
    seed: () =>
      edited(pattern(emptyDesign(), { id: "favorites", system: "Accounts" }), (draft) => {
        const selection = draft.schemaVersion === 3 ? draft.generation?.selections[0] : undefined;
        if (selection?.template.id !== "verified-identity")
          throw new Error("The favorites pattern's first selection is its Sign-in");
        selection.template.version = "0.0.1";
      }),
    at: { module: "Account check" },
    subjects: ["Account check", "Sign-in"],
    terms: ["installed", "version", "template", "0.0.1"],
    expect: "fix",
  },
  {
    id: "review-store-without-writer",
    kind: "review",
    check: "store-without-writer",
    defect: "Records has no owner, so nothing writes it.",
    prompt: REVIEW_PROMPT,
    seed: () =>
      edited(
        run(emptyDesign(), [
          tile({ lane: "download" }, "api", "API", "service", "Store"),
          tile({ tile: "api" }, "records", "Records", "database"),
        ]),
        (draft) => {
          delete settingsOf(draft, "records").owner;
        },
      ),
    at: { tile: "Records" },
    subjects: ["Records"],
    terms: ["writer", "owner", "writes"],
    expect: "fix",
  },
  {
    id: "review-unrelated-store",
    kind: "review",
    check: "unrelated-store",
    defect: "The Processor worker writes Outputs and Metadata, two concerns.",
    prompt: REVIEW_PROMPT,
    seed: () =>
      run(emptyDesign(), [
        tile({ lane: "upload" }, "api", "API", "service", "Media"),
        tile({ tile: "api" }, "jobs", "Jobs", "queue"),
        tile({ tile: "jobs" }, "processor", "Processor", "worker"),
        tile({ tile: "processor" }, "outputs", "Outputs", "database"),
        tile({ tile: "processor" }, "metadata", "Metadata", "database"),
        tile({ lane: "download" }, "viewer-api", "Viewer API", "service"),
        {
          type: "linkTiles",
          from: { tile: "viewer-api" },
          to: "outputs",
          linkId: "viewer-api-outputs",
        },
        {
          type: "linkTiles",
          from: { tile: "viewer-api" },
          to: "metadata",
          linkId: "viewer-api-metadata",
        },
        addModule("api", "api-job-publisher", "event-publisher", "Job publisher"),
        connect("api-job-publisher", "channel", { tile: "jobs" }),
        addModule("processor", "processor-jobs", "event-consumer", "Job consumer"),
        connect("processor-jobs", "channel", { tile: "jobs" }),
        addModule("processor", "processor-output-writer", "data-access", "Output writer"),
        connect("processor-output-writer", "database", { tile: "outputs" }),
        addModule("processor", "processor-metadata-writer", "data-access", "Metadata writer"),
        connect("processor-metadata-writer", "database", { tile: "metadata" }),
        addModule("viewer-api", "viewer-api-output-reader", "data-access", "Output reader"),
        connect("viewer-api-output-reader", "database", { tile: "outputs" }),
        addModule("viewer-api", "viewer-api-metadata-reader", "data-access", "Metadata reader"),
        connect("viewer-api-metadata-reader", "database", { tile: "metadata" }),
      ]),
    at: { tile: "Processor" },
    subjects: ["Processor"],
    terms: ["writes", "concern", "more than one", "two stores", "both"],
    expect: "fix",
  },
  {
    id: "review-user-reaches-store",
    kind: "review",
    check: "user-reaches-store",
    defect: "The download action reaches the Files object storage directly.",
    prompt: REVIEW_PROMPT,
    seed: () =>
      edited(
        run(emptyDesign(), [
          tile({ lane: "download" }, "api", "API", "service", "Files"),
          tile({ tile: "api" }, "files", "Files", "object-store"),
        ]),
        (draft) => {
          draft.architecture?.studio?.entries?.push({
            id: "download-files",
            lane: "download",
            element: "files",
          });
        },
      ),
    at: { tile: "Files" },
    subjects: ["Files"],
    terms: ["directly", "user", "action", "entry", "service"],
    expect: "fix",
    stored: "legacy",
  },
  {
    id: "review-long-line",
    kind: "review",
    check: "long-line",
    defect:
      "Upload API's line to Metadata crosses the board (advice): the right change is none, and never a tile to shorten it.",
    prompt: REVIEW_PROMPT,
    seed: () =>
      pattern(emptyDesign(), {
        id: "upload-pipeline",
        delivery: "Video delivery",
        system: "Videos",
      }),
    at: { tile: "Metadata" },
    subjects: ["Metadata", "Upload API"],
    terms: ["long", "crosses", "line", "far"],
    expect: "keep",
  },
  {
    id: "review-line-style",
    kind: "review",
    check: "line-style",
    defect:
      "Shop API's line to the Catalog database is dashed (async), but a database read is a direct call.",
    prompt: REVIEW_PROMPT,
    seed: () =>
      edited(shop(), (draft) => {
        const link = draft.connections.find((item) => item.id === "shop-api-catalog");
        if (!link) throw new Error("The shop's reader links to Catalog");
        link.planned.interaction = "Asynchronous";
      }),
    at: { tile: "Shop API" },
    subjects: ["Shop API", "Catalog"],
    terms: ["dashed", "solid", "async", "style", "direct"],
    expect: "fix",
    stored: "legacy",
  },
  {
    id: "review-warning",
    kind: "review",
    check: "warning",
    defect: "Upload API, an Uploads tile, has no storage relationship.",
    prompt: REVIEW_PROMPT,
    seed: () =>
      run(emptyDesign(), [
        tile({ lane: "upload" }, "upload-api", "Upload API", "uploads", "Uploads"),
      ]),
    at: { tile: "Upload API" },
    subjects: ["Upload API"],
    terms: ["storage", "object", "files"],
    expect: "fix",
  },
];

export const designCases: readonly DesignCase[] = [buildCase, ...reviewCases];
