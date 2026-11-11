/**
 * Scores for the chat design evals (V3-10), from the saved design only; the proposing model
 * never grades itself.
 *
 * **Build.** The saved design against the reference, with the generic design diff
 * (`fixtures/design-diff.ts`): the candidate's tiles and modules are first matched to the
 * reference's, then compared under the reference's names. Five areas, each 0 to 100:
 *
 * - **tiles:** per reference tile, 1 when a candidate tile has its name and kind, ½ when it has
 *   its name but another kind, or is the only tile of that kind left on both sides;
 * - **links:** the lines Simple draws: per user link 1 (the lane's action, same name) or ½ (another
 *   name); per entry 1 (same lane) or ½ (other lane); per tile link 1 (same style, solid or dashed)
 *   or ½ (the other style);
 * - **modules:** per reference module in the matched tile, 1 for its name and kind, ½ for its name
 *   with another kind, or for the only module of its kind left in that tile on both sides;
 * - **module links:** per reference module link, 1 when the matched module links to the matched
 *   target (tile, or module in-process);
 * - **templates:** per reference selection, 1 when the candidate resolves the same template in the
 *   matched tile (a stub for the matched module); per useful value, 1 when it is set the same.
 *
 * An area's score is 100 × credit ÷ the larger of the reference's count and the candidate's, so
 * extra tiles, lines, modules, links or selections cost as much as missing ones. The total is the
 * mean of the five areas. Names match case-insensitively, punctuation and spacing aside, and a
 * trailing kind word of the tile's own kind is ignored ("Metadata database" is "Metadata",
 * "Video lifecycle worker" is "Video lifecycle"), as the v3 contract's naming rule allows.
 *
 * **Review.** Per seeded defect: **named** 1 when the model's own text names where it is and what
 * is wrong (a subject and a term), ½ for the subject alone; **fixed** 1 when the saved design's
 * review no longer reports it there, with no new finding to fix and no seed tile lost (½ when it
 * is gone at such a cost); for advice the right change is none: 1 when no tile was added or
 * removed and no new finding to fix appeared. The case scores 50 × named + 50 × fixed.
 */
import {
  type DesignDocument,
  type DesignReviewFinding,
  designReview,
  type GenerationInstalledSupport,
  laneGraph,
  type StudioKind,
  studioActions,
} from "@jeeves/spec";
import {
  type DesignDiffRow,
  type DesignFacts,
  designFacts,
  factsDiff,
} from "../../../../packages/spec/src/fixtures/design-diff.ts";
import type { V3Value } from "../../../../packages/spec/src/fixtures/v3-modules.ts";
import type { ReviewCase } from "./design-cases.ts";

export const designAreas = ["tiles", "links", "modules", "moduleLinks", "templates"] as const;
export type DesignArea = (typeof designAreas)[number];
export type ScoreItem = { key: string; credit: number; note?: string };
export type AreaScore = {
  score: number;
  credit: number;
  reference: number;
  candidate: number;
  items: ScoreItem[];
};
export type BuildScore = {
  total: number;
  areas: Record<DesignArea, AreaScore>;
  /** Reference tile name → the candidate tile it matched, by name. */
  tiles: Record<string, string | null>;
  /** The diff's rows in the scored areas, under the matched names. */
  rows: DesignDiffRow[];
};

/** Kind words a name may end with, longest first; the tile's kind label already shows them. */
const kindWords: Partial<Record<StudioKind, readonly string[]>> = {
  service: ["microservice", "service"],
  worker: ["worker service", "worker"],
  database: ["database", "db"],
  cache: ["cache"],
  queue: ["message channel", "channel", "queue", "topic"],
  "object-store": ["object storage", "object store", "storage", "bucket"],
  search: ["search index", "index"],
  cdn: ["cdn"],
  identity: ["identity provider", "identity"],
  uploads: ["uploads"],
  "external-api": ["external api"],
};
const words = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/** A name as matching compares it: lower case, words only, without a trailing kind word. */
export function nameKey(name: string, kind?: StudioKind): string {
  const key = words(name);
  for (const word of (kind && kindWords[kind]) || [])
    if (key.endsWith(` ${word}`)) return key.slice(0, -word.length - 1).trim();
  return key;
}

type Tile = { id: string; name: string; kind: StudioKind | undefined };
const tilesOf = (design: DesignDocument): Tile[] => {
  const kinds = new Map(
    design.architecture?.studio?.elements.map((item) => [item.element, item.settings.kind]),
  );
  return design.elements.map((item) => ({
    id: item.id,
    name: item.name,
    kind: kinds.get(item.id),
  }));
};
type Match = { id: string; credit: number; note?: string };

/** Pairs reference items with candidate items: by name first, then the one left of a kind. */
function pair<T extends { id: string; kind: string | undefined }>(
  reference: readonly T[],
  candidate: readonly T[],
  same: (a: T, b: T) => boolean,
): Map<string, Match> {
  const out = new Map<string, Match>();
  const used = new Set<string>();
  for (const item of reference) {
    const named = candidate.filter((other) => !used.has(other.id) && same(item, other));
    const best = named.find((other) => other.kind === item.kind) ?? named[0];
    if (!best) continue;
    used.add(best.id);
    out.set(
      item.id,
      best.kind === item.kind
        ? { id: best.id, credit: 1 }
        : { id: best.id, credit: 0.5, note: `kind ${best.kind}, not ${item.kind}` },
    );
  }
  const kinds = new Set(reference.map((item) => item.kind));
  for (const kind of kinds) {
    const left = reference.filter((item) => item.kind === kind && !out.has(item.id));
    const others = candidate.filter((item) => item.kind === kind && !used.has(item.id));
    const [only] = left;
    const [other] = others;
    if (left.length !== 1 || others.length !== 1 || !only || !other) continue;
    used.add(other.id);
    out.set(only.id, { id: other.id, credit: 0.5, note: "another name; the only one of its kind" });
  }
  return out;
}

/** The candidate's tiles matched to the reference's (reference ID → candidate). */
export function matchTiles(reference: DesignDocument, candidate: DesignDocument) {
  return pair(
    tilesOf(reference),
    tilesOf(candidate),
    (a, b) =>
      nameKey(a.name, a.kind) === nameKey(b.name, b.kind) ||
      nameKey(a.name, a.kind) === nameKey(b.name, a.kind),
  );
}

type Module = { id: string; name: string; kind: string; host: string };
const modulesOf = (design: DesignDocument): Module[] =>
  (design.architecture?.studio?.components ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    kind: item.settings.kind,
    host: item.host,
  }));

/** The candidate's modules matched to the reference's within matched tiles. */
export function matchModules(
  reference: DesignDocument,
  candidate: DesignDocument,
  tiles: ReadonlyMap<string, Match>,
) {
  const out = new Map<string, Match>();
  const theirs = modulesOf(candidate);
  for (const [host, match] of tiles) {
    const mine = modulesOf(reference).filter((item) => item.host === host);
    const there = theirs.filter((item) => item.host === match.id);
    for (const [id, found] of pair(mine, there, (a, b) => words(a.name) === words(b.name)))
      out.set(id, found);
  }
  return out;
}

const area = (items: ScoreItem[], reference: number, candidate: number): AreaScore => {
  const credit = items.reduce((sum, item) => sum + item.credit, 0);
  const denominator = Math.max(reference, candidate);
  return {
    score: denominator ? round((100 * credit) / denominator) : 100,
    credit,
    reference,
    candidate,
    items,
  };
};
const round = (value: number) => Math.round(value * 10) / 10;
const get = (facts: DesignFacts, area: string, key: string) => facts.get(area)?.get(key);
const rows = (facts: DesignFacts, area: string) => facts.get(area) ?? new Map<string, unknown>();
const count = (facts: DesignFacts, area: string) => facts.get(area)?.size ?? 0;
const scoredAreas = new Set([
  "action",
  "entry",
  "tile",
  "link",
  "module kind",
  "module link",
  "selection",
  "tile setting",
  "module setting",
]);

/** The build score of `candidate` against `reference` (see the module comment for the rules). */
export function scoreBuild(
  reference: DesignDocument,
  candidate: DesignDocument,
  installed: GenerationInstalledSupport,
  values: readonly V3Value[] = [],
): BuildScore {
  const tiles = matchTiles(reference, candidate);
  const modules = matchModules(reference, candidate, tiles);
  const referenceTiles = new Map(reference.elements.map((item) => [item.id, item.name]));
  const referenceModules = new Map(
    (reference.architecture?.studio?.components ?? []).map((item) => [item.id, item.name]),
  );
  // Matched candidates take the reference's names; any other that shares one is set apart.
  const names = { tiles: {} as Record<string, string>, modules: {} as Record<string, string> };
  for (const [id, match] of tiles) names.tiles[match.id] = referenceTiles.get(id) ?? id;
  for (const [id, match] of modules) names.modules[match.id] = referenceModules.get(id) ?? id;
  const taken = (name: string, list: Iterable<string>) =>
    [...list].some((other) => words(other) === words(name));
  for (const item of candidate.elements)
    if (!names.tiles[item.id] && taken(item.name, referenceTiles.values()))
      names.tiles[item.id] = `${item.name} (unmatched)`;
  for (const item of modulesOf(candidate))
    if (!names.modules[item.id] && taken(item.name, referenceModules.values()))
      names.modules[item.id] = `${item.name} (unmatched)`;
  const mine = designFacts(reference, { installed });
  const theirs = designFacts(candidate, { installed, names });

  // Tiles.
  const tileItems = [...referenceTiles].map(([id, name]): ScoreItem => {
    const match = tiles.get(id);
    return {
      key: name,
      credit: match?.credit ?? 0,
      ...(match?.note ? { note: match.note } : !match && { note: "missing" }),
    };
  });

  // Links: the user's lines to the actions, the entries and the tile links.
  const linkItems: ScoreItem[] = [];
  const actions = (design: DesignDocument) =>
    new Map(studioActions(design.architecture?.studio).map((item) => [item.lane, item.name]));
  const theirActions = actions(candidate);
  for (const [lane, name] of actions(reference)) {
    const other = theirActions.get(lane);
    linkItems.push({
      key: `user → ${name}`,
      credit: other === undefined ? 0 : words(other) === words(name) ? 1 : 0.5,
      ...(other === undefined
        ? { note: "missing" }
        : words(other) !== words(name) && { note: `named ${other}` }),
    });
  }
  for (const [key, lane] of rows(mine, "entry")) {
    const other = get(theirs, "entry", key);
    linkItems.push({
      key: `${lane} entry → ${key}`,
      credit: other === lane ? 1 : other ? 0.5 : 0,
      ...(other === undefined ? { note: "missing" } : other !== lane && { note: `in ${other}` }),
    });
  }
  // A line's style: dashed (async) or solid (the caller waits), as the canvas draws it.
  const style = (link: unknown) =>
    (link as { interaction?: string }).interaction === "Asynchronous" ? "dashed" : "solid";
  for (const [key, value] of rows(mine, "link")) {
    const other = get(theirs, "link", key);
    linkItems.push({
      key,
      credit: !other ? 0 : style(other) === style(value) ? 1 : 0.5,
      ...(!other
        ? { note: "missing" }
        : style(other) !== style(value) && { note: `${style(other)}, not ${style(value)}` }),
    });
  }

  // Modules.
  const moduleItems = (reference.architecture?.studio?.components ?? []).map((item): ScoreItem => {
    const match = modules.get(item.id);
    return {
      key: `${referenceTiles.get(item.host)} / ${item.name}`,
      credit: match?.credit ?? 0,
      ...(match?.note ? { note: match.note } : !match && { note: "missing" }),
    };
  });

  // Module links.
  const moduleLinkItems = [...rows(mine, "module link").keys()].map(
    (key): ScoreItem =>
      get(theirs, "module link", key) === undefined
        ? { key, credit: 0, note: "missing" }
        : { key, credit: 1 },
  );

  // Templates and the useful values.
  const templateItems = [...rows(mine, "selection").keys()].map(
    (key): ScoreItem =>
      get(theirs, "selection", key) === undefined
        ? { key, credit: 0, note: "not resolved" }
        : { key, credit: 1 },
  );
  for (const value of values) {
    const key = value.module ? `${value.module}.${value.key}` : `${value.tile}.${value.key}`;
    const where = value.module ? "module setting" : "tile setting";
    const expected = get(mine, where, key);
    const actual = get(theirs, where, key);
    templateItems.push({
      key: `${value.module ? `${value.tile} / ` : ""}${key} = ${String(expected)}`,
      credit: actual === expected ? 1 : 0,
      ...(actual !== expected && {
        note: actual === undefined ? "not set" : `is ${String(actual)}`,
      }),
    });
  }

  const areas: Record<DesignArea, AreaScore> = {
    tiles: area(tileItems, reference.elements.length, candidate.elements.length),
    links: area(linkItems, laneGraph(reference).edges.length, laneGraph(candidate).edges.length),
    modules: area(moduleItems, modulesOf(reference).length, modulesOf(candidate).length),
    moduleLinks: area(moduleLinkItems, count(mine, "module link"), count(theirs, "module link")),
    templates: area(
      templateItems,
      count(mine, "selection") + values.length,
      count(theirs, "selection") + values.length,
    ),
  };
  const total = round(
    designAreas.reduce((sum, key) => sum + areas[key].score, 0) / designAreas.length,
  );
  return {
    total,
    areas,
    tiles: Object.fromEntries(
      [...referenceTiles].map(([id, name]) => {
        const match = tiles.get(id);
        return [
          name,
          match ? (candidate.elements.find((item) => item.id === match.id)?.name ?? null) : null,
        ];
      }),
    ),
    rows: factsDiff(mine, theirs).filter((row) => scoredAreas.has(row.area)),
  };
}

export type ReviewScore = {
  score: number;
  named: number;
  fixed: number;
  notes: string[];
  /** The review's findings before and after, as `check · where (severity)`. */
  before: string[];
  after: string[];
};

/** A finding as `check · tile / module (severity)`, by name. */
function describe(design: DesignDocument, finding: DesignReviewFinding) {
  const tile = design.elements.find((item) => item.id === finding.tile)?.name;
  const module = design.architecture?.studio?.components?.find(
    (item) => item.id === finding.module,
  )?.name;
  return {
    tile,
    module,
    text: `${finding.check} · ${[tile, module].filter(Boolean).join(" / ") || "design"} (${finding.severity})`,
  };
}

/** The review score of one seeded defect (see the module comment for the rules). */
export function scoreReview(
  test: ReviewCase,
  seed: DesignDocument,
  saved: DesignDocument,
  modelText: string,
  installed: GenerationInstalledSupport,
): ReviewScore {
  const findings = (design: DesignDocument) =>
    designReview(design, installed).findings.map((item) => ({
      ...describe(design, item),
      check: item.check,
      severity: item.severity,
    }));
  const before = findings(seed);
  const after = findings(saved);
  const notes: string[] = [];
  const same = (a: string | undefined, b: string | undefined) =>
    b === undefined || (a !== undefined && words(a) === words(b));
  const here = (item: (typeof after)[number]) =>
    item.check === test.check && same(item.tile, test.at.tile) && same(item.module, test.at.module);
  if (!before.some(here)) throw new Error(`Seed ${test.id} lacks its ${test.check} finding`);

  const text = modelText.toLowerCase();
  const subject = test.subjects.some((item) => text.includes(item.toLowerCase()));
  const term = test.terms.some((item) => text.includes(item.toLowerCase()));
  const named = subject && term ? 1 : subject ? 0.5 : 0;
  if (named < 1) notes.push(subject ? "named where, not what" : "not named");

  const tiles = (design: DesignDocument) =>
    new Set(design.elements.map((item) => words(item.name)));
  const [seedTiles, savedTiles] = [tiles(seed), tiles(saved)];
  const lost = [...seedTiles].filter((item) => !savedTiles.has(item));
  const added = [...savedTiles].filter((item) => !seedTiles.has(item));
  const known = new Set(before.map((item) => item.text));
  const fresh = after.filter((item) => item.severity === "fix" && !known.has(item.text));
  if (lost.length) notes.push(`tiles lost: ${lost.join(", ")}`);
  if (fresh.length) notes.push(`new to fix: ${fresh.map((item) => item.text).join("; ")}`);
  let fixed: number;
  if (test.expect === "keep") {
    fixed = !lost.length && !added.length && !fresh.length ? 1 : 0;
    if (added.length) notes.push(`tiles added: ${added.join(", ")}`);
  } else {
    const gone = !after.some(here);
    fixed = !gone ? 0 : !lost.length && !fresh.length ? 1 : 0.5;
    if (!gone) notes.push("still reported");
  }
  return {
    score: round(50 * named + 50 * fixed),
    named,
    fixed,
    notes,
    before: before.map((item) => item.text),
    after: after.map((item) => item.text),
  };
}
