/** Typed acceptance data; validates frozen ledger identity without evaluating an application. */
import type { BenchmarkLedger } from "../../../packages/spec/src/benchmark.ts";
import {
  type BenchmarkFixture,
  parseBenchmarkFixture,
} from "../../../packages/spec/src/benchmark-fixtures.ts";
import { vendureFixtureContract } from "../../../packages/spec/src/vendure-benchmark.ts";
import input from "./fixtures.json" with { type: "json" };

export function vendureFixtures(ledger: BenchmarkLedger): Promise<BenchmarkFixture> {
  return parseBenchmarkFixture(input, vendureFixtureContract, ledger);
}
