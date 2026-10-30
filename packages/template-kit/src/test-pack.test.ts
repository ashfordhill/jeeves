import { describe, expect, it } from "vitest";
import { CheckSkipped, type TestPackContext } from "./contract.ts";
import { runTestPack } from "./test-pack.ts";

describe("runTestPack", () => {
  it("records inapplicable checks with their reason and does not count them as passed", async () => {
    const results = await runTestPack(
      {
        template: "t",
        checks: [
          {
            id: "skip",
            title: "Skip",
            run: async () => {
              throw new CheckSkipped("No input is applicable");
            },
          },
        ],
      },
      {} as TestPackContext,
    );
    expect(results[0]).toMatchObject({ status: "skipped", reason: "No input is applicable" });
  });
  it("runs every check in order and keeps going after a failure", async () => {
    const order: string[] = [];
    const results = await runTestPack(
      {
        template: "t",
        checks: [
          { id: "a", title: "A", run: async () => void order.push("a") },
          {
            id: "b",
            title: "B",
            run: async () => {
              order.push("b");
              throw new Error("broken");
            },
          },
          { id: "c", title: "C", run: async () => void order.push("c") },
        ],
      },
      {} as TestPackContext,
    );
    expect(order).toEqual(["a", "b", "c"]);
    expect(results.map((r) => [r.id, r.status, r.error])).toEqual([
      ["a", "passed", undefined],
      ["b", "failed", "broken"],
      ["c", "passed", undefined],
    ]);
  });
});
