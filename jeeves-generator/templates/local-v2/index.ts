import { readdirSync } from "node:fs";
import { sameContractRef } from "@jeeves/spec";
import { jsonFile } from "../../src/json.ts";
import { createLocalAssetLifecycle } from "../../src/v2/asset-lifecycle.ts";
import { createLocalComposition } from "../../src/v2/composition.ts";
import { createLocalDurability } from "../../src/v2/durability.ts";
import { createLocalEventCounter } from "../../src/v2/event-counter.ts";
import { createLocalFoundation } from "../../src/v2/local.ts";
import { createLocalMediaWorker } from "../../src/v2/media-worker.ts";
import { createLocalModuleStubs } from "../../src/v2/module-stubs.ts";
import { createLocalMultipart } from "../../src/v2/multipart.ts";
import { createLocalPositiveCache } from "../../src/v2/positive-cache.ts";
import { createLocalRuntimePrimitives } from "../../src/v2/primitives.ts";
import { captureV2Sources, createV2Registry, type V2Emitter } from "../../src/v2/registry.ts";
import { createLocalSearch } from "../../src/v2/search.ts";
import { createLocalUploadState } from "../../src/v2/upload-state.ts";
import { createLocalAssetIdentity, createLocalVideoHls } from "../../src/v2/video-hls.ts";

const root = new URL("../../../", import.meta.url);
function sourcePaths(path: string): string[] {
  return readdirSync(new URL(`${path}/`, root), { withFileTypes: true })
    .filter((entry) => !entry.name.includes(".test.") && entry.name !== "fixtures")
    .flatMap((entry) =>
      entry.isDirectory() ? sourcePaths(`${path}/${entry.name}`) : [`${path}/${entry.name}`],
    );
}

/** Foundation and dependency libraries. Features register their own application implementation. */
export function loadLocalV2Registry(
  featureValues: readonly V2Emitter[] = [],
  options: { applications?: boolean } = {},
) {
  // Snapshot registration metadata before the foundation captures its contribution callbacks.
  const closure = [
    ...new Set([
      ...sourcePaths("jeeves-generator/src/v2"),
      ...sourcePaths("jeeves-generator/templates/local-v2"),
      ...sourcePaths("jeeves/packages/spec/src"),
    ]),
  ];
  const features = [
    ...(options.applications === false
      ? []
      : [createLocalComposition(closure), createLocalModuleStubs(closure)]),
    ...featureValues,
  ].map((feature) => ({
    ...feature,
    sourcePaths: [...feature.sourcePaths],
    provides: structuredClone(feature.provides),
    dependencies: structuredClone(feature.dependencies),
  }));
  const paths = [
    ...sourcePaths("jeeves-generator/src/v2"),
    ...sourcePaths("jeeves-generator/templates/local-v2"),
    ...sourcePaths("jeeves/packages/spec/src"),
    "jeeves-generator/src/json.ts",
    "jeeves-generator/src/files.ts",
    "jeeves-generator/src/export.ts",
    "jeeves-generator/package.json",
    "jeeves/packages/spec/package.json",
    "pnpm-lock.yaml",
    ...features.flatMap((feature) => feature.sourcePaths),
  ];
  const diagnostic: V2Emitter = {
    id: "local.diagnostic",
    version: "0.1.0-experimental.1",
    status: "diagnostic",
    description:
      "Normalized binding inventory only; implements no application behavior or setting consumer.",
    sourcePaths: [...new Set(paths)],
    render: ({ model }) => ({
      files: [
        {
          path: "diagnostics/generation.json",
          content: jsonFile(model),
          ownership: "generated-scaffold",
          sourcePaths: ["/generation"],
        },
      ],
      gaps: model.selections.some(
        (selection) =>
          !features.some((feature) =>
            feature.provides?.templates?.some((template) =>
              sameContractRef(template.ref, selection.template),
            ),
          ),
      )
        ? [
            {
              id: "application-implementations",
              status: "unfinished",
              required: true,
              description:
                "Feature implementations and required application hooks remain unfinished; selected providers alone are not a working application.",
              sourcePaths: ["/generation"],
            },
          ]
        : [],
    }),
  };
  const distinct = [...new Set(paths)];
  const multipart = createLocalMultipart(distinct);
  const mediaWorker = createLocalMediaWorker(distinct);
  const eventCounter = createLocalEventCounter(distinct);
  const search = createLocalSearch(distinct);
  return createV2Registry(captureV2Sources(root, distinct), [
    diagnostic,
    createLocalFoundation(distinct, [multipart, mediaWorker, eventCounter, search, ...features]),
    createLocalRuntimePrimitives(distinct),
    createLocalDurability(distinct),
    createLocalUploadState(distinct),
    multipart,
    createLocalAssetIdentity(distinct),
    createLocalAssetLifecycle(distinct),
    createLocalVideoHls(distinct),
    mediaWorker,
    createLocalPositiveCache(distinct),
    eventCounter,
    search,
    ...features,
  ]);
}

/** Dependency-only host for focused library consumers and custom compiled recipes. It never
 * claims installed application composition. */
export function loadLocalV2Dependencies(features: readonly V2Emitter[] = []) {
  return loadLocalV2Registry(features, { applications: false });
}
