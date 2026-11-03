import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { discourseFixtures } from "../../../benchmarks/discourse-core/v1/fixtures.ts";
import { parseBenchmarkLedger } from "./benchmark.ts";
import {
  backendAcceptanceCatalog,
  backendBehaviorRequirements,
  benchmarkFixtureUnavailable,
  parseBenchmarkFixture,
} from "./benchmark-fixtures.ts";
import {
  DISCOURSE_FIXTURE_COOKIE,
  discourseFixtureContract,
  discourseHookContracts,
  discourseHookSchemas,
  discourseOpenApi,
  discourseOperationPolicies,
} from "./discourse-benchmark.ts";

const read = (file: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../benchmarks/discourse-core/v1/${file}`, import.meta.url), "utf8"),
  );
const ledger = () =>
  parseBenchmarkLedger(read("manifest.json"), read("requirements.json"), read("integrity.json"));
const pack = () => read("fixtures.json");

describe("Discourse independent acceptance data (application absent)", () => {
  it("resolves all 20 rows / 66 observations through five ordered scenarios", async () => {
    const fixture = await discourseFixtures(await ledger());
    expect(fixture.observations).toHaveLength(66);
    expect(new Set(fixture.observations.map((o) => o.caseId)).size).toBe(20);
    expect(fixture.scenarios.map((s) => s.id)).toEqual([
      "D-create",
      "D-revoke",
      "D-edit",
      "D-failure",
      "D-moderate",
    ]);
    const identities = backendBehaviorRequirements(backendAcceptanceCatalog(fixture));
    expect(identities).toHaveLength(discourseFixtureContract.operations.length);
    expect(
      identities.every(
        (i) => i.id.startsWith("backend:discourse-core:v1:") && i.acceptance.length > 0,
      ),
    ).toBe(true);
    for (const status of ["not-run", "blocked"] as const) {
      const absence = benchmarkFixtureUnavailable(
        fixture,
        status,
        "Discourse application and hooks absent; no runner executed",
      );
      expect(absence.observations).toHaveLength(66);
      expect(absence.observations.every((o) => o.status === status)).toBe(true);
      expect(absence).not.toHaveProperty("points");
    }
  });

  it("keeps the OpenAPI and pure hook snapshots equal to independent strict schemas", () => {
    // JSON syntax is valid YAML 1.2; no parser dependency or runtime schema export.
    expect(read("contracts.openapi.yaml")).toEqual(discourseOpenApi());
    expect(read("hooks.contracts.json")).toEqual(discourseHookSchemas());
    expect(DISCOURSE_FIXTURE_COOKIE).toBe("jeeves_session_ab8d833d23266de108e6deb84bbba24f");
    expect(Object.keys(discourseHookContracts)).toHaveLength(8);
    expect(Object.keys(discourseOperationPolicies).sort()).toEqual(
      discourseFixtureContract.operations.map((o) => o.id).sort(),
    );
    const document = discourseOpenApi();
    for (const path of Object.keys(document.paths))
      expect(path).not.toMatch(/fixture|inspect|fault|drain|restart/);
    for (const operation of discourseFixtureContract.operations) {
      if (operation.authentication === "session" && operation.method !== "GET")
        expect(operation.idempotency).toBe("required");
      for (const part of ["params", "query", "body"] as const) {
        const sample = pack().requests.find(
          (r: { operationId: string; validInput: boolean }) =>
            r.operationId === operation.id && r.validInput,
        );
        expect(sample, operation.id).toBeDefined();
        if (sample.input[part] !== null)
          expect(
            operation.input[part].safeParse({ ...sample.input[part], injectedAuthority: true })
              .success,
            `${operation.id}:${part}`,
          ).toBe(false);
      }
    }
  });

  it("fixes creation, edit, worker and removal invariants independently", () => {
    const fixture = pack();
    const steps = fixture.scenarios.flatMap((s: { steps: unknown[] }) => s.steps);
    const inspections = steps.filter((s: { controlId?: string }) => s.controlId === "inspect");
    const inspect = (selector: string) =>
      inspections.find((s: { input: { selector: string } }) => s.input.selector === selector)
        ?.expected;
    expect(inspect("command-key:create-private")).toEqual({
      topics: 1,
      posts: 1,
      receipts: 1,
      intents: 1,
      versions: [1, 1],
    });
    expect(inspect("edited-post")).toEqual({
      mutationWinners: 1,
      versionConflicts: 1,
      revisions: 3,
      versions: [4],
      receipts: 1,
    });
    expect(inspect("removed-post")).toEqual({
      audits: 2,
      versions: [5],
      forbiddenTextOccurrences: 0,
    });
    expect(
      inspections
        .filter((s: { input: { selector: string } }) => s.input.selector === "event-recipient")
        .map((s: { expected: unknown }) => s.expected),
    ).toEqual([
      { inbox: 1, inboxReceipts: 1, intents: 1 },
      { inbox: 1, inboxReceipts: 1, deliveries: 0 },
    ]);
    const bytes = readFileSync(
      new URL("../../../benchmarks/discourse-core/v1/hello.txt", import.meta.url),
    );
    expect(bytes.toString()).toBe("hello\n");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03",
    );
  });

  it("validates all fixed pure hook examples and rejects added authority/output", () => {
    const examples = read("hooks.examples.json") as {
      hookId: keyof typeof discourseHookContracts;
      input: Record<string, unknown>;
      result: Record<string, unknown>;
    }[];
    expect(examples.map((e) => e.hookId).sort()).toEqual(
      Object.keys(discourseHookContracts).sort(),
    );
    for (const example of examples) {
      const contract = discourseHookContracts[example.hookId];
      expect(contract.input.safeParse(example.input).success, example.hookId).toBe(true);
      expect(contract.result.safeParse(example.result).success, example.hookId).toBe(true);
      expect(contract.input.safeParse({ ...example.input, bypassAuthority: true }).success).toBe(
        false,
      );
      expect(
        contract.result.safeParse({ ...example.result, grantAdministrator: true }).success,
      ).toBe(false);
    }
  });

  it("fixes revocation redaction on every promised path including an old cursor and receipt", () => {
    const fixture = pack();
    const ids = [
      "revoked-detail",
      "revoked-posts",
      "revoked-history",
      "revoked-list",
      "revoked-cursor",
      "revoked-search",
      "revoked-byte-url",
      "revoked-replay",
      "revoked-inbox",
    ];
    for (const id of ids) {
      const request = fixture.requests.find((r: { id: string }) => r.id === id);
      expect(request, id).toBeDefined();
      const body = JSON.stringify(request.expected.body);
      expect(body).not.toMatch(
        /confidential|hidden needle|first confidential|privateTitle|snippetCount|total/,
      );
    }
    expect(
      fixture.requests
        .find((r: { id: string }) => r.id === "revoked-list")
        .expected.body.items.map((r: { title: string }) => r.title),
    ).toEqual(["public needle alpha", "public needle omega"]);
  });

  it("uses unique session tokens and renews sessions after the trust-window clock advance", () => {
    const fixture = pack();
    const cookies = fixture.requests
      .filter(
        (r: { operationId: string; expected: { status: number } }) =>
          ["register", "login"].includes(r.operationId) && r.expected.status < 300,
      )
      .map(
        (r: { expected: { headers: Record<string, string> } }) => r.expected.headers["set-cookie"],
      );
    expect(new Set(cookies).size).toBe(cookies.length);
    const steps = fixture.scenarios.find((s: { id: string }) => s.id === "D-create").steps as {
      kind: string;
      requestId?: string;
      controlId?: string;
      input?: { now?: string };
    }[];
    const jump = steps.findIndex(
      (s) => s.controlId === "clock" && s.input?.now === "2026-12-01T12:00:00Z",
    );
    expect(steps[jump + 1]?.requestId).toBe("login-admin-after-expiry");
    const renewedAlice = steps.findIndex((s) => s.requestId === "login-alice-after-expiry");
    expect(renewedAlice).toBeGreaterThan(jump);
    expect(steps.findIndex((s) => s.requestId === "render-safe")).toBeGreaterThan(renewedAlice);
    const clocks = steps.filter((s) => s.controlId === "clock").map((s) => s.input?.now);
    expect(clocks).toEqual([...clocks].sort());
  });

  it("gives every hook a complete reference path and a zero-write unavailable path", () => {
    const fixture = pack();
    const requests = fixture.requests;
    for (const caseId of ["D13", "D14", "D15", "D16", "D17", "D18", "D19", "D20"]) {
      const operations = fixture.observations
        .filter((o: { caseId: string }) => o.caseId === caseId)
        .flatMap((o: { operationIds: string[] }) => o.operationIds);
      expect(
        requests.some(
          (r: { operationId: string; expected: { status: number } }) =>
            operations.includes(r.operationId) &&
            r.expected.status >= 200 &&
            r.expected.status < 300,
        ),
      ).toBe(true);
      expect(
        requests.some(
          (r: { operationId: string; expected: { status: number; body?: { code: string } } }) =>
            operations.includes(r.operationId) &&
            r.expected.status === 503 &&
            r.expected.body?.code === "HOOK_UNAVAILABLE",
        ),
      ).toBe(true);
    }
    const zeroWrites = fixture.scenarios
      .flatMap(
        (s: { steps: { controlId?: string; expected?: { hookWrites?: number } }[] }) => s.steps,
      )
      .filter((s: { expected?: { hookWrites?: number } }) => s.expected?.hookWrites === 0);
    expect(zeroWrites.length).toBeGreaterThanOrEqual(8);
  });

  it.each([
    "missing-observation",
    "foreign-operation",
    "runtime-extra",
    "changed-literal",
    "wrong-pin",
    "bad-seed",
    "unsafe-error",
  ])("rejects corrupted %s", async (kind) => {
    const fixture = pack();
    if (kind === "missing-observation") fixture.observations.pop();
    if (kind === "foreign-operation") fixture.observations[0].operationIds = ["vendureCheckout"];
    if (kind === "runtime-extra") fixture.requests[0].input.body.role = "administrator";
    if (kind === "changed-literal")
      fixture.scenarios[0].steps[0].assertions[0].value = { runtimeDerived: true };
    if (kind === "wrong-pin") fixture.ledgerHashes.manifest = "0".repeat(64);
    if (kind === "bad-seed")
      fixture.datasets.find((d: { id: string }) => d.id === "posts").rows[0].authorId =
        "not-a-uuid";
    if (kind === "unsafe-error")
      fixture.requests.find(
        (r: { expected: { status: number } }) => r.expected.status === 404,
      ).expected.body.privateTitle = "secret";
    await expect(
      parseBenchmarkFixture(fixture, discourseFixtureContract, await ledger()),
    ).rejects.toThrow();
  });
});
