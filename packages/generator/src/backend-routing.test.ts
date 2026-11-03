import { expect, it, vi } from "vitest";
import { backendCompileFixture } from "./backend-compile-fixture.ts";
import { generateProject } from "./generate.ts";
import { readLock } from "./lock.ts";
import { GenerationError } from "./plan.ts";

vi.mock("./lock.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lock.ts")>()),
  readLock: vi.fn(() => {
    throw new Error("Backend writer touched the filesystem boundary");
  }),
}));

it("rejects every versioned backend input before reading output locks or invoking emitters/vendors", async () => {
  const { design } = backendCompileFixture();
  const vendor = vi.fn();
  await expect(
    generateProject({
      design,
      dir: "/unused-backend-output",
      projectName: "Pure plan only",
      vendor,
    }),
  ).rejects.toThrow(GenerationError);
  expect(readLock).not.toHaveBeenCalled();
  expect(vendor).not.toHaveBeenCalled();
});
