import type { CheckResult, TestPack, TestPackContext } from "./contract.ts";

/**
 * Runs a pack's checks in order. A failed check doesn't stop the run: later checks still report,
 * so one broken invariant doesn't hide the others.
 */
export async function runTestPack(
  pack: TestPack,
  ctx: TestPackContext,
  onResult?: (result: CheckResult) => void,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of pack.checks) {
    const started = performance.now();
    let result: CheckResult;
    try {
      await check.run(ctx);
      result = { id: check.id, title: check.title, status: "passed", durationMs: 0 };
    } catch (error) {
      result = {
        id: check.id,
        title: check.title,
        status: "failed",
        durationMs: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    result.durationMs = Math.round(performance.now() - started);
    results.push(result);
    onResult?.(result);
  }
  return results;
}
