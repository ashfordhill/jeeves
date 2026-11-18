import { test } from "vitest";
import { foundationScenario } from "../harness/foundation-scenario.ts";

test("RG14: foundations enforce the contract across independent native process copies", () =>
  foundationScenario());
