/** Typed independent data; frozen ledger validation only, without application evaluation. */
import type { BenchmarkLedger } from "../../../packages/spec/src/benchmark.ts";
import {
  type BenchmarkFixture,
  parseBenchmarkFixture,
} from "../../../packages/spec/src/benchmark-fixtures.ts";
import { zammadFixtureContract } from "../../../packages/spec/src/zammad-benchmark.ts";
import input from "./fixtures.json" with { type: "json" };

export function zammadFixtures(ledger: BenchmarkLedger): Promise<BenchmarkFixture> {
  return parseBenchmarkFixture(input, zammadFixtureContract, ledger);
}
