/** Typed acceptance inputs only. Validation requires the frozen ledger; never evaluates an app. */
import type { BenchmarkLedger } from "../../../packages/spec/src/benchmark.ts";
import {
  type BenchmarkFixture,
  parseBenchmarkFixture,
} from "../../../packages/spec/src/benchmark-fixtures.ts";
import { discourseFixtureContract } from "../../../packages/spec/src/discourse-benchmark.ts";
import input from "./fixtures.json" with { type: "json" };

export function discourseFixtures(ledger: BenchmarkLedger): Promise<BenchmarkFixture> {
  return parseBenchmarkFixture(input, discourseFixtureContract, ledger);
}
