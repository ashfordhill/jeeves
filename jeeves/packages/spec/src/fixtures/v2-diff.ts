/**
 * The YouTube v2 rebuild's diff against the frozen v2 (module authoring plan, MA09), on the
 * generic design diff (`design-diff.ts`, V3-10): by tile, link and module name, with v2's module
 * renames and the contract's intended differences, each with its reason. Any other row is
 * unexpected. The frozen v2 is the reference; the rebuild is the candidate.
 */
import type { DesignDocument } from "../design.ts";
import type { GenerationInstalledSupport } from "../generation-support.ts";
import {
  type DesignDiffRow,
  designDiff,
  designDiffReport,
  type IntendedDifference,
} from "./design-diff.ts";

export type V2DiffRow = DesignDiffRow;
export type V2IntendedDifference = IntendedDifference;

/** The plan's names for v2's modules where they differ (Owner decision 7): frozen → rebuild. */
export const v2ModuleRenames: Readonly<Record<string, string>> = {
  "Details cache": "Video details cache",
  "Details reader": "Video details reader",
  "Publication outbox publisher": "Video publication publisher",
  "Publication consumer": "Video publication consumer",
};

const any = /.*/;
/** The contract's intended differences (module authoring contract, section 3, and question 2). */
export const v2IntendedDifferences: readonly V2IntendedDifference[] = [
  {
    area: "system",
    key: "description",
    only: "reference",
    reason: "Descriptions: the rebuild types none for the system.",
  },
  {
    area: "tile description",
    key: any,
    only: "reference",
    reason: "Descriptions: the plan rewrites module text only; new tiles have none.",
  },
  {
    area: "link label",
    key: any,
    reason: "Descriptions: a new link takes its pair's default label.",
  },
  { area: "module name", key: any, reason: "Names: the plan's naming rule (Owner decision 7)." },
  {
    area: "module description",
    key: any,
    reason: "Descriptions: the plan's table (Owner decision 8).",
  },
  {
    area: "module kind",
    key: /^(View counter \/ Receipt and increment|Search API \/ Video search|Upload API \/ Multipart uploads|Transcoder \/ (Segmenter and encoder|Packager|Thumbnailer)|Video lifecycle worker \/ Lifecycle writer|Search indexer \/ Index writer)$/,
    reason:
      "Contract section 3: the kind changes in bold (each template's lead, the packager and thumbnailer).",
  },
  {
    area: "link",
    key: "Upload API → Identity",
    only: "candidate",
    reason: "Contract question 2: the Creator check's connection is drawn.",
  },
  {
    area: "module link",
    key: "Creator check → Identity",
    only: "candidate",
    reason: "Contract question 2: the Creator check's connection is drawn.",
  },
  {
    area: "module link",
    key: "Video details cache → Video details reader",
    only: "candidate",
    reason: "Contract section 4: the Cache reader's loader, the one drawn in-process link.",
  },
  {
    area: "tile setting",
    key: /\.(minReplicas|maxReplicas|readReplicas|eviction|topology)$/,
    only: "reference",
    reason: "Contract section 3: fixed values v2 declares and new tiles leave to the descriptor.",
  },
  {
    area: "tile setting",
    key: /^Local video edge\.(provider|origin|imageResizing)$/,
    reason: "Contract section 3: CDN settings no template reads.",
  },
  {
    area: "module setting",
    key: /^View count reader\.(poolSize|statementTimeoutMs)$/,
    only: "reference",
    reason: "A stub shows no settings (contract section 2): View count reader is one.",
  },
  {
    area: "module setting",
    key: /\.(l2TtlSeconds|batchSize|lingerMs|concurrency|retryLimit)$/,
    only: "reference",
    reason:
      "Contract section 3: module mirror and fixed values no form shows; the resolved inputs agree (the cache's TTL and the Worker's concurrency are the tiles').",
  },
  {
    area: "module setting",
    key: "Lifecycle writer.readRouting",
    only: "reference",
    reason: "Contract section 3: a Lifecycle writer has no read routing.",
  },
  ...["selection", "selection input", "selection resource"].map(
    (area): V2IntendedDifference => ({
      area,
      key: /^youtube-(upload|watch|search) in /,
      only: "reference",
      reason: "Contract section 3: the youtube-* product templates are not offered.",
    }),
  ),
  {
    area: "selection",
    key: /^module-stub: (View count reader|View publisher)$/,
    only: "candidate",
    reason: "Contract section 3: the two stubs youtube-watch's modules become.",
  },
  ...["selection", "selection input"].map(
    (area): V2IntendedDifference => ({
      area,
      key: /^verified-identity in Upload API($|\.)/,
      only: "candidate",
      reason:
        "v3 contract section 2 and question 4 (V3-06): the Creator check leads its own sign-in template.",
    }),
  ),
  {
    area: "module setting",
    key: "Creator check.signIn",
    only: "candidate",
    reason:
      "v3 contract section 2 (V3-06): the sign-in template writes its initial Sign-in, Required.",
  },
  {
    area: "selection input",
    key: /\.(host\.minReplicas|host\.maxReplicas|cache\.eviction|cache\.topology|source\.readReplicas|state\.readReplicas|state\.readRouting)$/,
    only: "reference",
    reason:
      "Contract section 3: fixed values v2 declares, left to the descriptor (MA08's equivalence test).",
  },
  {
    area: "generation",
    key: "preset",
    only: "reference",
    reason: "Contract section 3: no preset.",
  },
  {
    area: "owner",
    key: any,
    reason: "Contract section 5: owner IDs and names are derived; members match.",
  },
  {
    area: "grant",
    key: "Watch API → View counts",
    only: "reference",
    reason: "Contract section 3: the read grant only youtube-watch needed goes.",
  },
  {
    area: "dependency",
    key: "Watch API → View counts",
    only: "reference",
    reason: "Contract section 3: the dependency only youtube-watch needed goes.",
  },
];

/** Every difference between the frozen v2 and a rebuild, by area and name. */
export function v2Diff(
  frozen: DesignDocument,
  rebuilt: DesignDocument,
  installed?: GenerationInstalledSupport,
): V2DiffRow[] {
  return designDiff(frozen, rebuilt, { installed, moduleRenames: v2ModuleRenames });
}

/**
 * The diff sorted against the intended differences: `unexpected` rows no rule covers (each one a
 * failure), and `unused` rules no row needed (the rebuild no longer differs there).
 */
export function v2DiffReport(
  rows: readonly V2DiffRow[],
  intended: readonly V2IntendedDifference[] = v2IntendedDifferences,
) {
  return designDiffReport(rows, intended);
}
