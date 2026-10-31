import ELK, { type ElkNode } from "elkjs/lib/elk-api.js";
import workerUrl from "elkjs/lib/elk-worker.min.js?url";
import { type ArchitectureGeometry, architectureGeometry } from "./layout.ts";

const cache = new Map<string, ArchitectureGeometry>();
/** One worker per uncached request. Cancellation/timeout always terminate it; failures never cache. */
export async function layoutArchitecture(
  key: string,
  signal: AbortSignal,
): Promise<ArchitectureGeometry> {
  signal.throwIfAborted();
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  let worker: Worker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  try {
    const failed = new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      timer = setTimeout(
        () => reject(new Error("Architecture layout timed out. Try a smaller scope.")),
        15_000,
      );
      worker = new Worker(workerUrl);
      // Observe the failure without cancelling its native diagnostic event.
      worker.addEventListener("error", () =>
        reject(new Error("The architecture layout worker could not run.")),
      );
      worker.addEventListener("messageerror", () =>
        reject(new Error("The architecture layout worker returned unreadable data.")),
      );
    });
    if (!worker) return await failed;
    const elk = new ELK({ workerFactory: () => worker as Worker });
    const result = architectureGeometry(
      await Promise.race([elk.layout(JSON.parse(key) as ElkNode), failed]),
    );
    signal.throwIfAborted();
    cache.set(key, result);
    if (cache.size > 16) cache.delete(cache.keys().next().value as string);
    return result;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    worker?.terminate();
  }
}
