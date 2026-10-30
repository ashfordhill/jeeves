import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBaseline, stepTimeoutMs } from "./baseline/index.ts";
import { fixtureDesign } from "./test-support.ts";

const design = fixtureDesign("link-shortener");
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  delete process.env.JEEVES_PNPM;
  delete process.env.JEEVES_CHECK_TIMEOUT_MIN;
});

function project(script: string): string {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-baseline-"));
  dirs.push(dir);
  writeFileSync(join(dir, "package.json"), '{"name":"fixture","private":true}\n');
  const pnpm = join(dir, "fake-pnpm");
  writeFileSync(pnpm, script);
  chmodSync(pnpm, 0o755);
  process.env.JEEVES_PNPM = pnpm;
  return dir;
}

describe("baseline step limits and feedback", () => {
  it("scales the per-step limits from one multiplier", () => {
    expect(stepTimeoutMs("install", {})).toBe(15 * 60_000);
    expect(stepTimeoutMs("typecheck", { JEEVES_CHECK_TIMEOUT_MIN: "0.5" })).toBe(5 * 60_000);
    expect(stepTimeoutMs("test-packs", { JEEVES_CHECK_TIMEOUT_MIN: "nonsense" })).toBe(20 * 60_000);
  });

  it("fails a timed-out step with the step and its limit", async () => {
    const dir = project("#!/bin/sh\nsleep 60\n");
    process.env.JEEVES_CHECK_TIMEOUT_MIN = String(1 / 900);
    const result = await runBaseline({ dir, design, subjects: [] });
    expect(result.ok).toBe(false);
    expect(result.steps[0]).toMatchObject({
      step: "install",
      status: "failed",
      message: expect.stringMatching(/^install exceeded [\d.]+ min$/),
    });
  });

  it("keeps a failing test package's own output in the failed step message", async () => {
    const dir = project(
      [
        "#!/bin/sh",
        'case "$*" in',
        "  *test*)",
        '    echo "services/links test: AssertionError: expected 1 to be 2";',
        '    echo "# fail 1";',
        "    exit 1 ;;",
        "  *) exit 0 ;;",
        "esac",
        "",
      ].join("\n"),
    );
    const result = await runBaseline({ dir, design, subjects: [], unitTests: true });
    expect(result.ok).toBe(false);
    const unit = result.steps.find((step) => step.step === "unit-tests");
    expect(unit).toMatchObject({ status: "failed" });
    expect(unit?.message).toContain("AssertionError: expected 1 to be 2");
    expect(unit?.message).toContain("$ pnpm -r --no-bail test");
  });
});
