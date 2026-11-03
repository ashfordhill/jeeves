import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { zammadFixtures } from "../../../benchmarks/zammad-core/v1/fixtures.ts";
import { parseBenchmarkLedger } from "./benchmark.ts";
import {
  backendAcceptanceCatalog,
  backendBehaviorRequirements,
  benchmarkFixtureUnavailable,
  parseBenchmarkFixture,
} from "./benchmark-fixtures.ts";
import {
  ZAMMAD_FIXTURE_COOKIE,
  zammadFixtureContract,
  zammadHookContracts,
  zammadHookSchemas,
  zammadOpenApi,
  zammadOperationPolicies,
} from "./zammad-benchmark.ts";

const root = new URL("../../../benchmarks/zammad-core/v1/", import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const pack = () => read("fixtures.json");
const ledger = () =>
  parseBenchmarkLedger(read("manifest.json"), read("requirements.json"), read("integrity.json"));
const request = (name: string) => pack().requests.find((r: { id: string }) => r.id === name);
const id = (n: number) => `a3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const inspections = () =>
  pack()
    .scenarios.flatMap((s: { steps: { controlId?: string }[] }) => s.steps)
    .filter((s: { controlId?: string }) => s.controlId === "inspect");
const inspect = (selector: string) =>
  inspections().find((s: { input: { selector: string } }) => s.input.selector === selector)
    ?.expected;

describe("Zammad independent expectations (application absent)", () => {
  it("resolves 20 rows / 66 observations through exactly five scenarios, with no pass for absence", async () => {
    const fixture = await zammadFixtures(await ledger());
    expect(fixture.observations).toHaveLength(66);
    expect(fixture.datasets.map((d) => d.id).sort()).toEqual(
      Object.keys(zammadFixtureContract.datasets).sort(),
    );
    const additional = fixture.datasets.find((d) => d.id === "additionalClocks");
    expect(additional?.rows).toHaveLength(1);
    expect(additional?.rows[0]).toMatchObject({
      ticketId: id(106),
      durationBusinessMinutes: 240,
      elapsedBusinessMinutes: 0,
      generation: 1,
      state: "running",
    });
    expect(new Set(fixture.observations.map((o) => o.caseId)).size).toBe(20);
    expect(fixture.scenarios.map((s) => s.id)).toEqual([
      "Z-create",
      "Z-private",
      "Z-clock",
      "Z-race",
      "Z-recover",
    ]);
    const requirements = backendBehaviorRequirements(backendAcceptanceCatalog(fixture));
    expect(requirements).toHaveLength(zammadFixtureContract.operations.length);
    expect(
      requirements.every(
        (r) => r.id.startsWith("backend:zammad-core:v1:") && r.acceptance.length > 0,
      ),
    ).toBe(true);
    for (const state of ["not-run", "blocked"] as const) {
      const result = benchmarkFixtureUnavailable(
        fixture,
        state,
        "Application and hooks absent; no runner executed",
      );
      expect(result.observations).toHaveLength(66);
      expect(result.observations.every((o) => o.status === state)).toBe(true);
      expect(result).not.toHaveProperty("points");
    }
  });

  it("exports the independent strict wire/hook schemas, separate security and no fixture routes", () => {
    expect(read("contracts.openapi.yaml")).toEqual(zammadOpenApi());
    expect(read("hooks.contracts.json")).toEqual(zammadHookSchemas());
    expect(ZAMMAD_FIXTURE_COOKIE).toBe(
      `jeeves_session_${createHash("sha256").update("http://127.0.0.1:4323").digest("hex").slice(0, 32)}`,
    );
    expect(Object.keys(zammadOperationPolicies).sort()).toEqual(
      zammadFixtureContract.operations.map((o) => o.id).sort(),
    );
    for (const path of Object.keys(zammadOpenApi().paths))
      expect(path).not.toMatch(/fixture|inspect|fault|drain|restart|claimDeadline/);
    for (const op of zammadFixtureContract.operations) {
      const sample = pack().requests.find(
        (r: { operationId: string; validInput: boolean }) =>
          r.operationId === op.id && r.validInput,
      );
      expect(sample, op.id).toBeDefined();
      for (const part of ["params", "query", "body"] as const) {
        if (sample.input[part] !== null)
          expect(
            op.input[part].safeParse({ ...sample.input[part], injectedAuthority: true }).success,
            `${op.id}:${part}`,
          ).toBe(false);
      }
      if (op.authentication === "session" && op.method !== "GET")
        expect(op.idempotency).toBe("required");
    }
  });

  it("fixes atomic creation, CAS winner, cancellation/late-response and bounded restart outcomes", () => {
    const creation = inspections()
      .filter((s: { input: { selector: string } }) => s.input.selector === "create-001")
      .map((s: { expected: unknown }) => s.expected);
    expect(creation).toEqual([
      { tickets: 0, articles: 0, deadlines: 0, receipts: 0, intents: 0, audits: 0 },
      {
        tickets: 1,
        articles: 1,
        deadlines: 1,
        receipts: 1,
        intents: 1,
        audits: 1,
        versions: [1, 1, 1],
      },
    ]);
    expect(inspect("assignment-version-8")).toEqual({
      mutationWinners: 1,
      versionConflicts: 1,
      versions: [9],
      receipts: 1,
      audits: 1,
      auditActorIds: [id(13)],
    });
    expect(inspect("response-commits-first")).toMatchObject({
      escalations: 0,
      escalationReceipts: 0,
      versions: [9, 2],
      states: ["satisfied"],
    });
    expect(inspect("escalation-commits-first")).toMatchObject({
      escalations: 1,
      escalationReceipts: 1,
      versions: [2, 3],
      states: ["escalated"],
    });
    for (const name of ["satisfied-not-escalated", "cancelled-not-escalated"])
      expect(inspect(name)).toEqual({ escalations: 0, escalationReceipts: 0 });
    expect(inspect("fenced-old-claim")).toEqual({
      escalations: 1,
      escalationReceipts: 1,
      fencedClaims: 1,
    });
    expect(inspect("worker-down")).toMatchObject({ escalations: 0, due: 9, states: ["running"] });
    expect(inspect("recovered-all-due")).toMatchObject({
      escalations: 9,
      escalationReceipts: 9,
      due: 0,
      versions: Array(9).fill(2),
    });
    expect(request("backlog-down").expected.body.due).toBe(9);
    expect(request("backlog-batch-two").expected.body.due).toBe(6);
    expect(request("backlog-cleared").expected.body.due).toBe(0);
    const drains = pack()
      .scenarios.find((s: { id: string }) => s.id === "Z-recover")
      .steps.filter(
        (s: { controlId?: string; input?: { channel?: string } }) =>
          s.controlId === "drain" && s.input?.channel === "deadlines",
      );
    expect(drains.filter((s: { input: { maxJobs: number } }) => s.input.maxJobs === 2).length).toBe(
      5,
    );
  });

  it("independently counts elapsed UTC minutes in declared local intervals for every fixed calendar vector", () => {
    // Small test-only enumerator, independent of future P87 runtime/library. Expected dueAt values are committed literals.
    const calendars = pack().datasets.find((d: { id: string }) => d.id === "calendars").rows;
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const working = (
      at: number,
      calendar: { holidays: string[]; weekly: { weekday: number; start: string; end: string }[] },
    ) => {
      const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
      const day = `${parts.year}-${parts.month}-${parts.day}`;
      const hm = `${parts.hour}:${parts.minute}`;
      return (
        !calendar.holidays.includes(day) &&
        calendar.weekly.some(
          (w) => w.weekday === days.indexOf(parts.weekday ?? "") + 1 && hm >= w.start && hm < w.end,
        )
      );
    };
    const vectors = pack().requests.filter((r: { id: string }) => r.id.startsWith("deadline-"));
    expect(vectors).toHaveLength(7);
    for (const r of vectors) {
      const cal = calendars.find((c: { id: string }) => c.id === r.input.body.calendarId);
      const start = Date.parse(r.input.body.startedAt),
        due = Date.parse(r.expected.body.dueAt);
      let actual = 0;
      for (let at = start; at < due; at += 60000) if (working(at, cal)) actual++;
      expect(actual, r.id).toBe(120);
      expect(working(due - 60000, cal), r.id).toBe(true);
    }
    expect(request("deadline-fall-repeated").expected.body.dueAt).toBe("2026-11-01T07:30:00Z");
    expect(request("deadline-spring-missing").expected.body.dueAt).toBe("2026-03-08T08:30:00Z");
    expect(request("clock-still-v1").expected.body).toMatchObject({
      calendarVersion: 1,
      slaVersion: 1,
      dueAt: "2026-11-02T16:00:00Z",
    });
    expect(request("new-policy-preview").expected.body.dueAt).toBe("2026-11-02T17:00:00Z");
    expect(request("close-unmet").expected.body.deadline).toMatchObject({
      state: "cancelled",
      satisfiedAt: null,
    });
    expect(request("reopen").expected.body.deadline.generation).toBe(1);
  });

  it("excludes internal/foreign content and identities on every customer output, moved byte reference and replay", () => {
    for (const name of [
      "internal-customer-detail",
      "customer-history",
      "customer-history-next",
      "customer-conversation-export",
      "customer-internal-getFile",
      "customer-internal-downloadFile",
      "internal-customer-search",
      "internal-customer-audit",
      "customer-internal-inbox",
      "customer-list-interleaved",
      "search-needle-interleaved",
      "moved-agent-ticket",
      "moved-agent-note",
      "moved-agent-audit",
      "moved-agent-export",
      "moved-agent-search",
      "moved-agent-cursor",
      "moved-agent-replay",
      "moved-byte-reference-getFile",
      "moved-byte-reference-downloadFile",
      "moved-agent-inbox",
      "rebuilt-internal-search",
      "privacy-export",
      "knowledge-draft",
      "knowledge-private",
      "knowledge-withdrawn-search",
    ]) {
      const serialized = JSON.stringify(request(name).expected);
      expect(serialized, name).not.toMatch(/internal vault canary|foreign private canary/);
      for (const hiddenId of [id(202), id(204), id(303), id(501), id(505)])
        expect(serialized, name).not.toContain(hiddenId);
    }
    expect(request("search-needle-interleaved").expected.body).toMatchObject({
      items: [{ ticketId: id(106) }],
      nextCursor: null,
    });
    expect(inspect("customer-internal-deliveries")).toEqual({
      inbox: 0,
      deliveries: 0,
      forbiddenTextOccurrences: 0,
    });
    expect(inspect("moved-sensitive-effects")).toMatchObject({
      deliveries: 0,
      inbox: 0,
      forbiddenTextOccurrences: 0,
    });
    expect(inspect("cleanup-keeps-live-link")).toEqual({
      links: 1,
      objects: 1,
      orphans: 0,
      versions: [3],
    });
    expect(request("assignment-replay-revoked").expected.status).toBe(404);
  });

  it("has eight typed seams with reference/rejection/recovery and zero-write missing/timeout/invalid cases", () => {
    const examples = read("hooks.examples.json");
    expect(Object.keys(examples).sort()).toEqual(Object.keys(zammadHookContracts).sort());
    for (const [name, contract] of Object.entries(zammadHookContracts)) {
      contract.input.parse(examples[name].input);
      contract.result.parse(examples[name].result);
      expect(
        contract.input.safeParse({ ...examples[name].input, untrustedRole: "admin" }).success,
      ).toBe(false);
      expect(
        contract.result.safeParse({ ...examples[name].result, arbitraryEffects: [] }).success,
      ).toBe(false);
      for (const mode of ["unavailable", "timeout", "invalid-result"]) {
        expect(request(`${name}-${mode}`).expected).toMatchObject({
          status: 503,
          body: { code: "HOOK_UNAVAILABLE" },
        });
        expect(inspect(`${name}-${mode}`)).toEqual({ hookWrites: 0, receipts: 0, intents: 0 });
      }
    }
    const cohort = examples["JH-reporting"].input.cohort as {
      firstResponseBusinessMinutes: number | null;
      reopenEvents: number;
    }[];
    expect(cohort).toHaveLength(13);
    expect(cohort.filter((t) => t.reopenEvents > 0)).toHaveLength(1);
    expect(cohort.filter((t) => t.firstResponseBusinessMinutes !== null)).toHaveLength(3);
    expect(cohort.reduce((s, t) => s + (t.firstResponseBusinessMinutes ?? 0), 0)).toBe(150);
    const privacy = examples["JH-customer-privacy"];
    expect(
      privacy.result.exportArticleIds.every(
        (a: string) =>
          privacy.input.publicOwnedArticleIds.includes(a) &&
          !privacy.input.internalArticleIds.includes(a),
      ),
    ).toBe(true);
    expect(examples["JH-conversation"].result.articleIds).toEqual([id(202)]);
    expect(examples["JH-sla-extension"].result).toMatchObject({
      elapsedBusinessMinutes: 135,
      deadlineGeneration: 3,
      dueAt: "2026-11-03T19:00:00Z",
    });
  });

  it("pins bytes and verifies source signatures against original payloads and time, without a provider call", () => {
    const sources = read("sources.examples.json") as {
      fixtureOnlySecret: string;
      timestamp: string;
      rawBodyBase64: string;
      sha256: string;
      signature: string;
    }[];
    for (const source of sources) {
      const bytes = Buffer.from(source.rawBodyBase64, "base64");
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
      const sign = (b: Uint8Array) =>
        createHmac("sha256", source.fixtureOnlySecret)
          .update(`${source.timestamp}.`)
          .update(b)
          .digest("hex");
      expect(sign(bytes)).toBe(source.signature);
      expect(sign(Buffer.concat([bytes, Buffer.from(" ")]))).not.toBe(source.signature);
      expect(Number(source.timestamp) * 1000).toBe(Date.parse("2026-10-30T21:00:00Z"));
    }
    const bytes = readFileSync(new URL("private.txt", root));
    expect(bytes.toString()).toBe("private fixture\n");
    expect(bytes.byteLength).toBe(16);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      request("agent-file-bytes").expected.body.sha256,
    );
    const mail = readFileSync(new URL("inbound.eml", root));
    expect(mail).toEqual(Buffer.from(request("mail-ingest").input.body.rawBase64, "base64"));
    expect(createHash("sha256").update(mail).digest("hex")).toBe(
      read("hooks.examples.json")["JH-inbound-email"].input.verifiedBodySha256,
    );
  });

  it.each([
    "missing-observation",
    "foreign-operation",
    "stale-pin",
    "privileged-field",
    "bad-seed",
    "contradiction",
    "orphan",
    "duplicate-route",
    "unsafe-error",
  ])("rejects corrupt %s", async (kind) => {
    const f = pack();
    const contract = {
      ...zammadFixtureContract,
      operations: [...zammadFixtureContract.operations],
    };
    if (kind === "missing-observation") f.observations.pop();
    if (kind === "foreign-operation") f.observations[0].operationIds = ["checkout"];
    if (kind === "stale-pin") f.ledgerHashes.requirements = "0".repeat(64);
    if (kind === "privileged-field") f.requests[0].input.body.role = "administrator";
    if (kind === "bad-seed")
      f.datasets.find((d: { id: string }) => d.id === "deadlines").rows[0].calendarVersion = 0;
    if (kind === "contradiction")
      f.scenarios[0].steps[0].assertions[0].value = { runtimeDerived: true };
    if (kind === "orphan") f.requests.push({ ...f.requests[0], id: "orphan" });
    if (kind === "duplicate-route" && contract.operations[0])
      contract.operations.push({ ...contract.operations[0], id: "aliased" });
    if (kind === "unsafe-error")
      f.requests.find(
        (r: { expected: { status?: number } }) => r.expected.status === 404,
      ).expected.body.privateNote = "secret";
    await expect(parseBenchmarkFixture(f, contract, await ledger())).rejects.toThrow();
  });
});
