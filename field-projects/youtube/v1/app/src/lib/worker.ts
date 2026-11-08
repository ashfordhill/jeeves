import { Unimplemented } from "./env.ts";
// An unfinished entry point must refuse before opening a consumer or advertising readiness.
export async function workerShell(
  id: string,
  _queue: string,
  _concurrency: number,
  _retryLimit: number,
): Promise<never> {
  throw new Unimplemented(`${id} startup: business handler is not implemented`);
}
