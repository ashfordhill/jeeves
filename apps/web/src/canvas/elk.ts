// Ported from automation-illustrator src/board/layout/elkClient.ts (0803c4a).
// The browser ELK behind the app's one layout engine. It prefers the elkjs Web Worker (served as
// a Vite `?url` asset, so the main bundle stays small) and falls back to `elk.bundled.js` on the
// main thread when Workers are unavailable (unit tests) or the worker script fails to load.
//
// Changes from automation-illustrator: no export-image engine.
import { createLayoutEngine, type ElkLike } from "@jeeves/board";
import ELK, { type ElkNode } from "elkjs/lib/elk-api.js";
import workerUrl from "elkjs/lib/elk-worker.min.js?url";

type Bundled = { new (): { layout(graph: ElkNode): Promise<ElkNode> } };

let bundled: Promise<ElkLike> | null = null;
function bundledElk(): Promise<ElkLike> {
  if (!bundled) {
    bundled = import("elkjs/lib/elk.bundled.js").then((mod: unknown) => {
      const m = mod as { default?: Bundled };
      const Ctor = m.default ?? (mod as Bundled);
      return new Ctor();
    });
  }
  return bundled;
}

function workerElk(): { elk: ElkLike; failed: Promise<never> } | null {
  if (typeof Worker === "undefined") return null;
  let rejectFailed!: (error: unknown) => void;
  const failed = new Promise<never>((_, reject) => {
    rejectFailed = reject;
  });
  failed.catch(() => {});
  try {
    const elk = new ELK({
      workerUrl,
      workerFactory: (url) => {
        const worker = new Worker(url ?? workerUrl);
        worker.onerror = (event) => {
          rejectFailed(event instanceof ErrorEvent ? (event.error ?? event.message) : event);
        };
        return worker;
      },
    });
    return { elk, failed };
  } catch {
    return null;
  }
}

/** Worker first; on failure switch permanently to the main-thread bundle. */
function resilientElk(): ElkLike {
  let worker = workerElk();
  return {
    async layout(graph) {
      if (worker) {
        try {
          return await Promise.race([worker.elk.layout(graph), worker.failed]);
        } catch (error) {
          console.warn("ELK worker unavailable; using main-thread ELK", error);
          worker = null;
        }
      }
      const elk = await bundledElk();
      return elk.layout(graph);
    },
  };
}

/** The app's one layout engine, so its cache survives re-renders and project switches. */
export const layoutEngine = createLayoutEngine(resilientElk());
