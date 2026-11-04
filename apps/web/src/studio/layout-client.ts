import type { StudioLayout, StudioLayoutInput } from "./layout.ts";

const cache = new Map<string, StudioLayout>();
type Job = { promise: Promise<StudioLayout>; cancel: () => void; users: number };
const running = new Map<string, Job>();

/** Exact scope/topology/sizing/order keys coalesce work; zoom and selection never enter here. */
export async function layoutStudioInWorker(input: StudioLayoutInput, signal: AbortSignal) {
  signal.throwIfAborted();
  const key = JSON.stringify(input);
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return Promise.resolve(cached);
  }
  let job = running.get(key);
  if (!job) {
    const worker = new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" });
    let cancel = () => {};
    const promise = new Promise<StudioLayout>((resolve, reject) => {
      const fail = (message: string) => reject(new Error(message));
      cancel = () => reject(new DOMException("Studio layout superseded.", "AbortError"));
      worker.addEventListener("error", () => fail("Diagram layout could not run."));
      worker.addEventListener("messageerror", () =>
        fail("Diagram layout returned unreadable data."),
      );
      worker.addEventListener(
        "message",
        ({ data }: MessageEvent<{ layout?: StudioLayout; error?: string }>) => {
          if (data.error || !data.layout) fail("Diagram layout could not finish.");
          else resolve(data.layout);
        },
      );
      worker.postMessage(input);
    });
    const timer = setTimeout(cancel, 15_000);
    const entry: Job = {
      promise: promise
        .then((geometry) => {
          cache.set(key, geometry);
          if (cache.size > 16) cache.delete(cache.keys().next().value as string);
          return geometry;
        })
        .finally(() => {
          clearTimeout(timer);
          worker.terminate();
          if (running.get(key) === entry) running.delete(key);
        }),
      cancel,
      users: 0,
    };
    job = entry;
    running.set(key, entry);
  }
  const active = job;
  active.users++;
  return new Promise<StudioLayout>((resolve, reject) => {
    let finished = false;
    const finish = () => {
      if (finished) return false;
      finished = true;
      signal.removeEventListener("abort", abort);
      if (--active.users === 0 && running.get(key) === active) {
        running.delete(key);
        active.cancel();
      }
      return true;
    };
    const abort = () => {
      if (finish()) reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    active.promise.then(
      (geometry) => {
        if (finish()) resolve(geometry);
      },
      (error: unknown) => {
        if (finish()) reject(error);
      },
    );
  });
}
