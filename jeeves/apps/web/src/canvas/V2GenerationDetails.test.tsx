// Generate project's v2 preview: each local adapter limit is one row with its own key, so a
// report naming two Identities lists both and React reports no duplicate key.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { V2GenerationPreview } from "../project/generation-api.ts";
import { V2GenerationDetails } from "./V2GenerationDetails.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ref = { id: "local-runtime", version: "0.1.0", sha256: "0".repeat(64) };
const reason = "Fixed local OIDC vendor substitution.";
const treatment = (index: number) => ({
  sourcePath: ["architecture", "studio", "elements", index, "settings", "language"],
  actual: "keycloak",
  reason,
});
const preview = (
  localAdapterTreatments: V2GenerationPreview["report"]["localAdapterTreatments"],
): V2GenerationPreview => ({
  mode: "selected-source-v2",
  status: "experimental-partial",
  selectedSource: {
    projectId: "p",
    revision: 1,
    canonicalSha256: "1".repeat(64),
    matchesFrozenProfile: false,
  },
  generator: { id: "jeeves-generator", version: "0.0.0" },
  archive: {
    filename: "p.zip",
    format: "zip-store-v1",
    bytes: 1,
    sha256: "2".repeat(64),
    manifestSha256: "3".repeat(64),
    files: 1,
    payloadBytes: 1,
  },
  runtime: ref,
  registry: { sha256: "4".repeat(64) },
  input: {
    sourceSha256: "5".repeat(64),
    sourceCanonicalSha256: "5".repeat(64),
    normalizedInputSha256: "6".repeat(64),
  },
  templates: [],
  report: {
    semanticComplete: true,
    applicationComplete: false,
    runtimeVerification: "none",
    strictReadiness: "not-assessed",
    selections: [],
    gaps: [],
    findings: [],
    settings: [],
    localAdapterTreatments,
  },
});

it("lists one row per local adapter limit, keyed uniquely", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<V2GenerationDetails data={preview([treatment(3), treatment(7)])} />);
  const limits = screen.getByText("Local adapter limits").closest("details");
  expect(limits?.querySelectorAll("li")).toHaveLength(2);
  expect(limits?.textContent).toContain(`${reason} Actual: keycloak`);
  expect(error).not.toHaveBeenCalled();
});
