/**
 * Scripted models for the design evals (V3-10, V3-19): canned responses that exercise the
 * production chat loop offline and prove the scorers discriminate. They are not model-quality
 * evidence. Their commands are chat's own form (V3-19), as a model reading the tool schema sends.
 *
 * - **good:** builds v3 with the six curated patterns given the brief's names, then fixes what
 *   they leave against the brief (one more entry, View publisher as a Custom module, the module
 *   names and descriptions, the values, Runnable processes); builds a product brief with the
 *   patterns and their neutral names, then turns Runnable processes on; reviews by calling
 *   reviewDesign, fixing the defect and naming it.
 * - **patterns:** the builds only: the six patterns (with the spec's names on the spec build,
 *   their own placeholders on a product brief) and nothing else.
 * - **bad:** builds a small generic video site with no modules; answers a review with "looks
 *   fine" and changes nothing.
 */
import {
  createFakeProvider,
  type ScriptStep,
  toOpenAIInput,
  toOpenAITool,
} from "@jeeves/providers";
import {
  buildModulePattern,
  type DesignDocument,
  emptyDesign,
  type ModulePattern,
  type StudioCommand,
  type StudioComponent,
} from "@jeeves/spec";
import {
  V3_MODULES,
  V3_PATTERN_STEPS,
  V3_VALUES,
} from "../../../../packages/spec/src/fixtures/v3-modules.ts";
import { type ChatCommand, toChatCommands } from "../chat/commands.ts";
import { installedGenerationSupport } from "../generation/support.ts";
import { type DesignCase, type ReviewCase, reviewCases, run } from "./design-cases.ts";

export const scriptedArms = ["good", "patterns", "bad"] as const;
export type ScriptedArm = (typeof scriptedArms)[number];

/**
 * The six patterns for a product brief with their own neutral placeholders: only the arguments a
 * pattern needs (the protected tile, the optional topic and CDN, favorites' items).
 */
const productPatterns = (system: string): ModulePattern[] => [
  { id: "cache-read", system },
  { id: "counting" },
  { id: "upload-pipeline", publication: "Publications", delivery: "Delivery" },
  { id: "search" },
  { id: "sign-in", tile: "Read API", signIn: "optional" },
  { id: "favorites", items: "Records" },
];
const composed = () =>
  V3_PATTERN_STEPS.reduce(
    (current, step) => buildModulePattern(current, step, installedGenerationSupport()).design,
    emptyDesign(),
  );

/**
 * Studio commands in chat's own form, each converted on the design the ones before it leave, as
 * the tools state a fix (`toChatCommands`).
 */
export function chatForm(
  design: DesignDocument,
  commands: readonly StudioCommand[],
): ChatCommand[] {
  let current = design;
  return commands.flatMap((command) => {
    const converted = toChatCommands(current, command);
    current = run(current, [command]);
    return converted;
  });
}

const tileId = (design: DesignDocument, name: string) => {
  const found = design.elements.find((item) => item.name === name);
  if (!found) throw new Error(`No tile ${name}`);
  return found.id;
};
const moduleIn = (design: DesignDocument, host: string, name: string): StudioComponent => {
  const tile = tileId(design, host);
  const found = design.architecture?.studio?.components?.find(
    (item) => item.host === tile && item.name === name,
  );
  if (!found) throw new Error(`No module ${name} in ${host}`);
  return found;
};

/**
 * What the good build fixes after the patterns, as one batch: each command is computed on the
 * design the previous ones leave, as a careful model reading the results would send it.
 */
export function goodBuildFixes(): ChatCommand[] {
  let design = composed();
  const commands: ChatCommand[] = [];
  const send = (command: StudioCommand) => {
    commands.push(...toChatCommands(design, command));
    design = run(design, [command]);
  };
  // Sign-in is also an entry of Publish.
  send({
    type: "linkTiles",
    from: { lane: "upload" },
    to: tileId(design, "Sign-in"),
    linkId: "upload-sign-in",
  });
  // View publisher is a Custom module that uses View events and Metadata.
  const publisher = moduleIn(design, "Watch API", "View publisher");
  send({ type: "removeModule", module: publisher.id });
  const custom = V3_MODULES["Watch API"]?.find((item) => item.name === "View publisher");
  send({
    type: "addModule",
    host: tileId(design, "Watch API"),
    kind: "custom",
    id: publisher.id,
    name: "View publisher",
    ...(custom && { description: custom.description }),
  });
  for (const target of ["View events", "Metadata"])
    send({
      type: "connectModule",
      module: publisher.id,
      slot: "uses",
      target: { tile: tileId(design, target) },
    });
  // The brief's module names and descriptions.
  for (const [host, modules] of Object.entries(V3_MODULES))
    for (const item of modules) {
      const found =
        design.architecture?.studio?.components?.find(
          (other) => other.host === tileId(design, host) && other.name === item.name,
        ) ??
        design.architecture?.studio?.components?.find(
          (other) =>
            other.host === tileId(design, host) &&
            other.settings.kind === item.kind &&
            !modules.some((named) => named.name === other.name),
        );
      if (!found) throw new Error(`The patterns made no ${item.name} in ${host}`);
      if (found.name === item.name && found.description === item.description) continue;
      send({
        type: "editComponent",
        component: found.id,
        ...(found.name !== item.name && { name: item.name }),
        description: item.description,
      });
    }
  // The values, then Runnable processes.
  for (const value of V3_VALUES) {
    if (value.module) {
      const target = moduleIn(design, value.tile, value.module);
      if ((target.settings as Record<string, unknown>)[value.key] === value.value) continue;
      send({
        type: "editComponent",
        component: target.id,
        settings: { ...target.settings, [value.key]: value.value } as StudioComponent["settings"],
      });
      continue;
    }
    const element = tileId(design, value.tile);
    const row = design.architecture?.studio?.elements.find((item) => item.element === element);
    if (!row) throw new Error(`No settings for ${value.tile}`);
    send({
      type: "edit",
      element,
      settings: { ...row.settings, [value.key]: value.value } as typeof row.settings,
    });
  }
  send({ type: "setRunnableProcesses", on: true });
  return commands;
}

/** The bad build: a small generic video site, no modules. */
const badBuild: StudioCommand[] = [
  {
    type: "addTile",
    from: { lane: "download" },
    side: "after",
    tile: { id: "video-service", name: "Video service", kind: "service" },
    linkId: "download-video-service",
    system: { name: "Video site" },
  },
  {
    type: "addTile",
    from: { tile: "video-service" },
    side: "after",
    tile: { id: "video-database", name: "Video database", kind: "database" },
    linkId: "video-service-video-database",
  },
  {
    type: "addTile",
    from: { lane: "upload" },
    side: "after",
    tile: { id: "upload-service", name: "Upload service", kind: "uploads" },
    linkId: "upload-upload-service",
  },
  {
    type: "addTile",
    from: { tile: "upload-service" },
    side: "after",
    tile: { id: "video-files", name: "Video files", kind: "object-store" },
    linkId: "upload-service-video-files",
  },
  {
    type: "linkTiles",
    from: { tile: "upload-service" },
    to: "video-database",
    linkId: "upload-service-video-database",
  },
];

/** The good review's change for each seed (studio commands), and the reply that names it. */
export function goodReview(test: ReviewCase): { commands: StudioCommand[]; reply: string } {
  const seed = test.seed();
  const component = (id: string) => {
    const found = seed.architecture?.studio?.components?.find((item) => item.id === id);
    if (!found) throw new Error(`No module ${id} in ${test.id}`);
    return found;
  };
  switch (test.check) {
    case "module-status": {
      const guard = component("account-api-account-check");
      return {
        commands: [
          {
            type: "editComponent",
            component: guard.id,
            settings: { ...guard.settings, signIn: "required" } as StudioComponent["settings"],
          },
        ],
        reply:
          "Found: Favorite videos in Account API was a Stub, because Account check let anonymous callers in (Optional). Set Account check to Required, so Favorite videos is a template.",
      };
    }
    case "unconnected-slot":
      return {
        commands: [
          {
            type: "connectModule",
            module: "shop-api-price-reader",
            slot: "database",
            target: { tile: "catalog" },
          },
        ],
        reply:
          "Found: Price reader in Shop API had nothing in its database slot. Connected it to Catalog, the database Shop API already reads.",
      };
    case "generation": {
      if (test.id === "review-out-of-range") {
        const row = seed.architecture?.studio?.elements.find(
          (item) => item.element === "orders-api",
        );
        if (!row) throw new Error("No Orders API");
        const { requestTimeoutMs: _bad, ...settings } = row.settings as Record<string, unknown>;
        return {
          commands: [{ type: "edit", element: "orders-api", settings: settings as never }],
          reply:
            "Found: Orders API's Request timeout was saved as 99999999 ms, past the 300000 its process allows. Cleared it, so the process runs its initial 1000 ms.",
        };
      }
      const link = seed.architecture?.studio?.componentConnections?.find(
        (item) => item.from === "account-api-account-check",
      );
      if (!link) throw new Error("Account check is connected to Sign-in");
      return {
        commands: [
          { type: "disconnectModule", link: link.id },
          {
            type: "connectModule",
            module: "account-api-account-check",
            slot: "identity",
            target: { tile: "sign-in" },
          },
        ],
        reply:
          "Found: Account check's Sign-in template was pinned to version 0.0.1, which is not installed. Connecting Account check to Sign-in again derived the installed version.",
      };
    }
    case "store-without-writer":
      return {
        commands: [{ type: "edit", element: "records", owner: { kind: "element", id: "api" } }],
        reply:
          "Found: Records had no owner, so nothing wrote it. Made API, its only user, its owner and writer.",
      };
    case "unrelated-store":
      return {
        commands: [
          { type: "removeModule", module: "processor-metadata-writer" },
          {
            type: "addTile",
            from: { tile: "processor" },
            side: "after",
            tile: { id: "completions", name: "Completions", kind: "queue" },
            linkId: "processor-completions",
          },
          {
            type: "addTile",
            from: { tile: "completions" },
            side: "after",
            tile: { id: "recorder", name: "Recorder", kind: "worker" },
            linkId: "completions-recorder",
          },
          {
            type: "linkTiles",
            from: { tile: "recorder" },
            to: "metadata",
            linkId: "recorder-metadata",
          },
          { type: "edit", element: "metadata", owner: { kind: "element", id: "recorder" } },
          { type: "removeLink", link: "processor-metadata" },
          {
            type: "addModule",
            host: "processor",
            kind: "event-publisher",
            id: "processor-completion-publisher",
            name: "Completion publisher",
          },
          {
            type: "connectModule",
            module: "processor-completion-publisher",
            slot: "channel",
            target: { tile: "completions" },
          },
          {
            type: "addModule",
            host: "recorder",
            kind: "event-consumer",
            id: "recorder-completion-consumer",
            name: "Completion consumer",
          },
          {
            type: "connectModule",
            module: "recorder-completion-consumer",
            slot: "channel",
            target: { tile: "completions" },
          },
          {
            type: "addModule",
            host: "recorder",
            kind: "data-access",
            id: "recorder-metadata-writer",
            name: "Metadata writer",
          },
          {
            type: "connectModule",
            module: "recorder-metadata-writer",
            slot: "database",
            target: { tile: "metadata" },
          },
        ],
        reply:
          "Found: the Processor worker writes both Outputs and Metadata, two concerns. It now writes only Outputs and publishes on a Completions topic; a Recorder worker after it owns and writes Metadata.",
      };
    case "user-reaches-store":
      return {
        commands: [{ type: "removeLink", link: "download-files" }],
        reply:
          "Found: the user reached Files directly from the action. Removed that entry; API, a service, already reaches Files.",
      };
    case "long-line":
      return {
        commands: [],
        reply:
          "Found one thing to check: Upload API's line to Metadata is long, because Video lifecycle at the end of the pipeline uses Metadata too. Upload API does write Metadata directly, so I changed nothing; a tile only to shorten the line would be wrong.",
      };
    case "line-style":
      return {
        commands: [
          { type: "removeLink", link: "shop-api-catalog" },
          {
            type: "linkTiles",
            from: { tile: "shop-api" },
            to: "catalog",
            linkId: "shop-api-catalog-2",
          },
          {
            type: "connectModule",
            module: "shop-api-catalog-reader",
            slot: "database",
            target: { tile: "catalog" },
          },
        ],
        reply:
          "Found: Shop API's line to Catalog was dashed (async), but reading a database is a direct call. Drew it again solid and reconnected Catalog reader.",
      };
    case "warning":
      return {
        commands: [
          {
            type: "addTile",
            from: { tile: "upload-api" },
            side: "after",
            tile: { id: "original-files", name: "Original files", kind: "object-store" },
            linkId: "upload-api-original-files",
          },
        ],
        reply:
          "Found: Upload API, an Uploads tile, had no storage. Added Original files, object storage it writes the uploads to.",
      };
  }
}

/** A step per round: the scripted model's tool calls, then its reply. */
function steps(test: DesignCase, arm: ScriptedArm): ScriptStep[] {
  const usage = null;
  if (test.kind === "build") {
    if (arm === "bad")
      return [
        {
          toolCalls: [
            {
              name: "applyStudioCommands",
              arguments: { commands: chatForm(emptyDesign(), badBuild) },
            },
          ],
          usage,
        },
        {
          text: "Built a simple video site: a video service with its database and an upload service with file storage.",
          usage,
        },
      ];
    const spec = test.scoring === "reference";
    const good = arm === "good";
    const apply = (
      spec ? V3_PATTERN_STEPS : productPatterns(test.id === "podcast-build" ? "Podcasts" : "Videos")
    ).map((pattern) => ({ name: "applyPattern", arguments: { pattern } }));
    const fixes: ChatCommand[] = spec
      ? goodBuildFixes()
      : [{ type: "setRunnableProcesses", on: true }];
    return [
      { toolCalls: [{ name: "listStudioPatterns", arguments: {} }], usage },
      { toolCalls: apply, usage },
      ...(good
        ? [{ toolCalls: [{ name: "applyStudioCommands", arguments: { commands: fixes } }], usage }]
        : []),
      {
        text: good
          ? spec
            ? "Built YouTube v3 from the patterns, then made View publisher a Custom module, added Sign-in under Publish, set the names, descriptions and values, and turned on Runnable processes."
            : "Built it from the patterns (uploads, processing, a cached read path with optional sign-in, counting, search and favorites), then turned on Runnable processes."
          : "Built the upload pipeline, the cached read path, counting, search, sign-in and favorites from the patterns.",
        usage,
      },
    ];
  }
  if (arm === "bad")
    return [{ text: "I looked over the design and it looks fine; nothing to change.", usage }];
  const { commands, reply } = goodReview(test);
  return [
    { toolCalls: [{ name: "reviewDesign", arguments: {} }], usage },
    ...(commands.length
      ? [
          {
            toolCalls: [
              {
                name: "applyStudioCommands",
                arguments: { commands: chatForm(test.seed(), commands) },
              },
            ],
            usage,
          },
        ]
      : []),
    { text: reply, usage },
  ];
}

/**
 * The scripted model for a case. After its last step it repeats its reply (the service's
 * pre-save review asks once more). Each request also passes the OpenAI wire conversion.
 */
export function scriptedProvider(test: DesignCase, arm: ScriptedArm) {
  const script = steps(test, arm);
  return createFakeProvider((request, call) => {
    for (const tool of request.tools) toOpenAITool(tool);
    toOpenAIInput(request.items, request.tools);
    return script[call] ?? script.at(-1) ?? { text: "", usage: null };
  });
}

/** The cases an arm runs: the patterns arm builds only. */
export const armCases = (arm: ScriptedArm, cases: readonly DesignCase[]) =>
  arm === "patterns" ? cases.filter((item) => item.kind === "build") : cases;

export { reviewCases };
