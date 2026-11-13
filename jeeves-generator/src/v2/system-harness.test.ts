import { afterEach, expect, test, vi } from "vitest";
import { until } from "../../integration/harness/faults.ts";
import { poll } from "../../integration/harness/process.ts";
import { missingSuites } from "../../integration/harness/suites.ts";

// A WSL2 host was observed stepping its wall clock forward 3.58 s every 32 s (GS07/GS09).
const step = 3580;
let offset = 0;
const wall = Date.now.bind(Date);
const stepWallClock = () => {
  vi.spyOn(Date, "now").mockImplementation(() => wall() + offset);
};
afterEach(() => {
  offset = 0;
  vi.restoreAllMocks();
});

test("a poll keeps its full monotonic deadline when the wall clock steps forward", async () => {
  stepWallClock();
  const started = performance.now();
  let observations = 0;
  const value = await poll(
    "condition that holds after 400 ms",
    async () => {
      observations++;
      if (observations === 1) offset += step;
      return performance.now() - started;
    },
    (elapsed) => elapsed >= 400,
    1500,
  );
  expect(value).toBeGreaterThanOrEqual(400);
  expect(observations).toBeGreaterThan(1);
});

test("a poll still times out on its monotonic deadline, keeping the last observation", async () => {
  stepWallClock();
  const started = performance.now();
  await expect(
    poll(
      "never",
      async () => "seen",
      () => false,
      300,
    ),
  ).rejects.toThrow('Timed out waiting for never; last observation: "seen"');
  expect(performance.now() - started).toBeGreaterThanOrEqual(295);
});

test("until waits for a monotonic instant whatever the wall clock does", async () => {
  stepWallClock();
  const started = performance.now();
  offset += step;
  await until(started + 300);
  expect(performance.now() - started).toBeGreaterThanOrEqual(295);
});

test("every selected suite must contribute a scenario file, so `all` cannot pass short", () => {
  const files = [
    "/repo/jeeves-generator/integration/scenarios/core.system.test.ts",
    "/repo/jeeves-generator/integration/scenarios/core-delivery.system.test.ts",
    "/repo/jeeves-generator/integration/scenarios/faults-media.system.test.ts",
  ];
  // Vitest selects `<suite>*.system.test.ts`, so faults-media belongs to faults, not media.
  expect(missingSuites(["core", "faults"], files)).toEqual([]);
  expect(missingSuites(["core", "media", "wiring"], files)).toEqual(["media", "wiring"]);
  expect(missingSuites(["core"], [])).toEqual(["core"]);
});
