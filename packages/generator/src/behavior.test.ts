import { describe, expect, it } from "vitest";
import { qrwtyAcceptance } from "../../../fixtures/acceptance/qrwty/manifest.ts";
import { fixedSuiteGate } from "./baseline/behavior.ts";

const core = qrwtyAcceptance.find((suite) => suite.id === "core")!;

describe("fixed acceptance scheduling", () => {
  it("skips a partially required multi-operation suite instead of failing it", () => {
    const gate = fixedSuiteGate(core, { qrwty: ["downloadQr"] }, "extensions");
    expect(gate.run).toBe(false);
    expect(gate.check).toMatchObject({
      subject: "qrwty",
      id: "core",
      status: "skipped",
      acceptanceIds: ["QR-01"],
      reason: "Waiting for operations followQr, qrActivity before running this suite.",
    });
  });

  it("runs the suite once every operation is required", () => {
    expect(
      fixedSuiteGate(core, { qrwty: ["downloadQr", "followQr", "qrActivity"] }, "extensions"),
    ).toEqual({ run: true });
  });

  it("waits quietly until the first of its operations is due", () => {
    expect(fixedSuiteGate(core, {}, "extensions")).toEqual({ run: false });
    expect(fixedSuiteGate(core, { qrwty: [] }, "extensions")).toEqual({ run: false });
  });

  it("keeps the visible frontend-phase skip", () => {
    const browser = qrwtyAcceptance.find((suite) => suite.id === "browser")!;
    expect(fixedSuiteGate(browser, {}, "extensions")).toMatchObject({
      run: false,
      check: {
        status: "skipped",
        acceptanceIds: ["QR-09"],
        reason: "Waiting for the frontend task before running this browser journey.",
      },
    });
    expect(
      fixedSuiteGate(browser, { qrwty: ["downloadQr", "followQr", "qrActivity"] }, "frontend"),
    ).toEqual({ run: true });
  });
});
