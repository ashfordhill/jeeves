// Ported from automation-illustrator src/board/layout/layoutEngine.ts (0803c4a).
// Layout requests to ELK: key cache, coalescing and debounce. Framework-free, so unit tests drive
// it with a fake ELK.
//
// - A cache hit resolves synchronously through `get(key)`, so nothing flashes.
// - Requests inside the debounce window replace the pending one; the replaced request rejects
//   with `LayoutSuperseded`, so callers keep their previous layout.
// - The first request (nothing cached or running) skips the debounce.
// - An empty board resolves to `emptyLayout` without calling ELK.
// - ELK errors are logged once per engine and rejected, so callers keep their previous layout.
// - Every ELK result is put on the grid (`alignLayout`) before it is cached.
// - A board with bands (`usesBands`) is laid out by `layoutBands`, which calls ELK once per band
//   and once more to route.
//
// Changes from automation-illustrator: one request channel instead of one per lane, no
// orientation, and a superseded request that was queued for the next microtask no longer runs.
import type { ElkNode } from "elkjs/lib/elk-api.js";
import { alignLayout } from "./align.ts";
import { layoutBands, usesBands } from "./bands.ts";
import { buildElkGraph, graphKey, type LayoutInput, type PositionMap } from "./elkGraph.ts";
import { type BoardLayout, emptyLayout, toBoardLayout } from "./elkLayout.ts";

/** What the engine needs from ELK: the bundled build, the worker build, or a fake. */
export type ElkLike = { layout(graph: ElkNode): Promise<ElkNode> };

export type LayoutEngine = {
  /** Cached layout for a key, or undefined. */
  get(key: string): BoardLayout | undefined;
  /** Key the engine would compute for this input. */
  keyFor(input: LayoutInput): string;
  /**
   * Resolves to the layout for this input, laid out with `previous` as stability hints. May
   * reject with `LayoutSuperseded` or an ELK error.
   */
  request(input: LayoutInput, previous?: PositionMap): Promise<BoardLayout>;
};

export class LayoutSuperseded extends Error {
  constructor(public readonly key: string) {
    super(`Layout request superseded: ${key}`);
    this.name = "LayoutSuperseded";
  }
}

type Pending = {
  key: string;
  timer: ReturnType<typeof setTimeout> | null;
  reject: (error: unknown) => void;
  promise: Promise<BoardLayout>;
};

export function createLayoutEngine(
  elk: ElkLike,
  { cacheSize = 32, debounceMs = 60 }: { cacheSize?: number; debounceMs?: number } = {},
): LayoutEngine {
  const cache = new Map<string, BoardLayout>();
  const inFlight = new Map<string, Promise<BoardLayout>>();
  let pending: Pending | null = null;
  let loggedError = false;

  function remember(layout: BoardLayout) {
    cache.delete(layout.key);
    cache.set(layout.key, layout);
    while (cache.size > cacheSize) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  function lay(key: string, input: LayoutInput, previous?: PositionMap): Promise<BoardLayout> {
    if (usesBands(input)) return layoutBands(elk, key, input, previous);
    return elk
      .layout(buildElkGraph(input, previous))
      .then((laidOut) => alignLayout(toBoardLayout(key, laidOut), input));
  }

  function run(key: string, input: LayoutInput, previous?: PositionMap): Promise<BoardLayout> {
    const existing = inFlight.get(key);
    if (existing) return existing;
    const job = lay(key, input, previous)
      .then((layout) => {
        remember(layout);
        return layout;
      })
      .catch((error: unknown) => {
        if (!loggedError) {
          loggedError = true;
          console.error("ELK layout failed", error);
        }
        throw error;
      })
      .finally(() => {
        if (inFlight.get(key) === job) inFlight.delete(key);
      });
    inFlight.set(key, job);
    return job;
  }

  return {
    get: (key) => cache.get(key),
    keyFor: graphKey,
    request(input, previous) {
      const key = graphKey(input);
      const hit = cache.get(key);
      if (hit) return Promise.resolve(hit);
      if (!input.tiles.length) {
        const empty = emptyLayout(key);
        remember(empty);
        return Promise.resolve(empty);
      }
      const running = inFlight.get(key);
      if (running) return running;

      const current = pending;
      if (current) {
        if (current.key === key) return current.promise;
        if (current.timer) clearTimeout(current.timer);
        pending = null;
        current.reject(new LayoutSuperseded(current.key));
      }

      let resolve!: (layout: BoardLayout) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<BoardLayout>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      const entry: Pending = { key, timer: null, reject, promise };
      const fire = () => {
        if (pending !== entry) return;
        pending = null;
        run(key, input, previous).then(resolve, reject);
      };
      const cold = cache.size === 0 && inFlight.size === 0;
      if (debounceMs > 0 && !cold) entry.timer = setTimeout(fire, debounceMs);
      else queueMicrotask(fire);
      pending = entry;
      return promise;
    },
  };
}
