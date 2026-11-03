import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { vendureFixtures } from "../../../benchmarks/vendure-core/v1/fixtures.ts";
import { parseBenchmarkLedger } from "./benchmark.ts";
import {
  type BenchmarkFixture,
  backendAcceptanceCatalog,
  backendBehaviorRequirements,
  benchmarkFixtureUnavailable,
  parseBenchmarkFixture,
} from "./benchmark-fixtures.ts";
import {
  VENDURE_FIXTURE_COOKIE,
  vendureCallbackSchemas,
  vendureFixtureContract,
  vendureHookContracts,
  vendureHookSchemas,
  vendureMoneySchema,
  vendureOpenApi,
  vendureOperationPolicies,
  vendureProviderContracts,
  vendureProviderSchemas,
  vendureReferenceEventSchema,
  vendureStripeEventSchema,
  vendureWarehouseEventSchema,
} from "./vendure-benchmark.ts";

const read = (file: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../benchmarks/vendure-core/v1/${file}`, import.meta.url), "utf8"),
  );
const pack = (): BenchmarkFixture => read("fixtures.json");
const ledger = () =>
  parseBenchmarkLedger(read("manifest.json"), read("requirements.json"), read("integrity.json"));
const request = (id: string) => {
  const r = pack().requests.find((r) => r.id === id);
  if (!r || !("body" in r.expected)) throw new Error(`Missing fixed request ${id}`);
  return { ...r, expected: r.expected };
};
const inspect = (selector: string) => {
  const s = pack()
    .scenarios.flatMap((s) => s.steps)
    .find(
      (s) =>
        s.kind === "control" &&
        s.controlId === "inspect" &&
        (s.input as { selector: string }).selector === selector,
    );
  if (s?.kind !== "control") throw new Error(`Missing inspection ${selector}`);
  return s.expected;
};
const id = (n: number) => `e2000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("Vendure independent acceptance data (all applications absent)", () => {
  it("resolves all 20 rows / 63 observations through exactly five scenarios and 42 operations", async () => {
    const fixture = await vendureFixtures(await ledger());
    expect(fixture.observations).toHaveLength(63);
    expect(new Set(fixture.observations.map((o) => o.caseId)).size).toBe(20);
    expect(fixture.scenarios.map((s) => s.id)).toEqual([
      "V-last-item",
      "V-repeat",
      "V-unknown",
      "V-expire",
      "V-ship",
    ]);
    expect(fixture.requests).toHaveLength(195);
    expect(vendureFixtureContract.operations).toHaveLength(42);
    expect(backendBehaviorRequirements(backendAcceptanceCatalog(fixture))).toHaveLength(42);
    for (const status of ["not-run", "blocked"] as const) {
      const absence = benchmarkFixtureUnavailable(
        fixture,
        status,
        "Vendure application/hooks absent; no runner executed",
      );
      expect(absence.observations).toHaveLength(63);
      expect(absence.observations.every((o) => o.status === status)).toBe(true);
      expect(absence).not.toHaveProperty("points");
    }
  });

  it("exports exact acceptance-side snapshots with no fixture-control production routes or browser barrel import", () => {
    expect(read("contracts.openapi.yaml")).toEqual(vendureOpenApi());
    expect(read("hooks.contracts.json")).toEqual(vendureHookSchemas());
    expect(read("callbacks.contracts.json")).toEqual(vendureCallbackSchemas());
    expect(read("providers.contracts.json")).toEqual(vendureProviderSchemas());
    expect(vendureOpenApi().paths["/api/providers/reference/events"]?.post).toMatchObject({
      requestBody: {
        content: { "application/json": { schema: vendureCallbackSchemas().reference } },
        "x-fixture-raw-utf8": { type: "string" },
      },
    });
    expect(VENDURE_FIXTURE_COOKIE).toBe("jeeves_session_862891429e2ae87d2b60eaa3d9dbf112");
    expect(Object.keys(vendureOperationPolicies).sort()).toEqual(
      vendureFixtureContract.operations.map((o) => o.id).sort(),
    );
    for (const path of Object.keys(vendureOpenApi().paths))
      expect(path).not.toMatch(/fixture|fault|inspect|restart|drain/);
    expect(readFileSync(new URL("./index.ts", import.meta.url), "utf8")).not.toMatch(
      /vendure-benchmark|discourse-benchmark/,
    );
    for (const op of vendureFixtureContract.operations) {
      const sample = pack().requests.find((r) => r.operationId === op.id && r.validInput);
      expect(sample, op.id).toBeDefined();
      for (const part of ["params", "query", "body"] as const) {
        const value = sample?.input[part];
        if (value !== null && typeof value === "object" && !Array.isArray(value))
          expect(
            op.input[part].safeParse({ ...value, injectedAuthority: true }).success,
            `${op.id}:${part}`,
          ).toBe(false);
      }
    }
  });

  it("fixes exact minor-unit totals and guards at the safe-integer boundary independently", () => {
    const q = request("exact-quote").expected;
    expect("body" in q && q.body).toMatchObject({
      subtotal: { minor: 10997, currency: "USD" },
      tax: { minor: 825, currency: "USD" },
      shipping: { minor: 500, currency: "USD" },
      total: { minor: 12322, currency: "USD" },
    });
    expect(request("immutable-order").expected).toMatchObject({
      status: 200,
      body: { total: { minor: 2649 }, lines: [{ unitPrice: { minor: 1999 } }] },
    });
    expect(request("change-price").expected).toMatchObject({ body: { price: { minor: 2299 } } });
    expect(request("refresh-quote").expected).toMatchObject({
      body: {
        subtotal: { minor: 2299 },
        tax: { minor: 172 },
        shipping: { minor: 500 },
        total: { minor: 2971 },
      },
    });
    expect(
      vendureMoneySchema.safeParse({ minor: Number.MAX_SAFE_INTEGER, currency: "USD" }).success,
    ).toBe(true);
    for (const minor of [-1, 0.1, Number.MAX_SAFE_INTEGER + 1])
      expect(vendureMoneySchema.safeParse({ minor, currency: "USD" }).success).toBe(false);
    expect(request("quote-overflow").expected).toMatchObject({
      status: 422,
      body: { code: "DOMAIN_REJECTED" },
    });
    // Independent test-only BigInt arithmetic over all authored quote/order snapshots; no runtime evaluator.
    type Snapshot = {
      lines: { quantity: number; unitPrice: { minor: number; currency: string } }[];
      subtotal: { minor: number };
      tax: { minor: number };
      shipping: { minor: number };
      total: { minor: number };
    };
    for (const dataset of pack().datasets.filter((d) => ["quotes", "orders"].includes(d.id)))
      for (const row of dataset.rows as unknown as Snapshot[]) {
        const subtotal = row.lines.reduce(
          (s, l) => s + BigInt(l.quantity) * BigInt(l.unitPrice.minor),
          0n,
        );
        expect(subtotal).toBe(BigInt(row.subtotal.minor));
        expect((subtotal * 750n + 5000n) / 10000n).toBe(BigInt(row.tax.minor));
        expect(subtotal + BigInt(row.tax.minor) + 500n).toBe(BigInt(row.total.minor));
      }
  });

  it("pins checkout rollback/replay, last-item ownership and current-version shipment ceilings", () => {
    expect(inspect("last-item")).toEqual({
      orders: 1,
      orderLines: 1,
      reservations: 1,
      receipts: 1,
      available: 0,
      onHand: 1,
      held: 0,
      allocated: 0,
    });
    expect(inspect("command:checkout-rollback")).toEqual({
      orders: 0,
      orderLines: 0,
      reservations: 0,
      receipts: 0,
      intents: 0,
      audits: 0,
      versions: [3],
    });
    expect(inspect("command:checkout-repeat")).toEqual({
      orders: 1,
      orderLines: 1,
      reservations: 1,
      receipts: 1,
      intents: 1,
      audits: 1,
      versions: [4, 1],
      amounts: [1999, 150, 500, 2649],
    });
    expect(request("checkout-changed-quantity").expected).toMatchObject({
      status: 409,
      body: { code: "IDEMPOTENCY_CONFLICT" },
    });
    expect(request("checkout-follower").expected).toMatchObject({
      status: 409,
      headers: { "retry-after": "1" },
      body: { code: "COMMAND_IN_PROGRESS" },
    });
    expect(request("ship-competing-two").expected).toMatchObject({
      status: 409,
      body: { code: "VERSION_CONFLICT" },
    });
    expect(request("ship-two-over-ceiling").expected).toMatchObject({
      status: 422,
      body: { code: "DOMAIN_REJECTED" },
    });
    expect(inspect("shipment-ceiling")).toEqual({
      shipped: 3,
      allocated: 0,
      onHand: 7,
      mutationWinners: 1,
      versionConflicts: 1,
      orders: 1,
      receipts: 2,
      intents: 2,
      audits: 2,
      versions: [6],
    });
    expect(request("fulfilled-order").expected).toMatchObject({
      body: { state: "fulfilled", version: 6 },
    });
    expect(request("ship-two-replay").expected.status).toBe(201);
    expect(request("ship-two-replay").expected.body).toEqual(request("ship-two").expected.body);
  });

  it("holds uncertain stock and fixes one charge/settlement despite duplicate, stale and foreign callbacks", () => {
    expect(request("observe-unknown").expected).toMatchObject({
      body: { providerId: null, state: "unknown", version: 3 },
    });
    expect(request("stripe-observe-unknown").expected).toMatchObject({
      body: { providerId: null, state: "unknown", version: 3 },
    });
    expect(inspect("unknown-payment")).toEqual({
      paymentAttempts: 1,
      providerCalls: 1,
      providerCharges: 1,
      orders: 1,
      held: 1,
      paidTransitions: 0,
      states: ["unknown", "payment-review", "held-for-payment"],
      versions: [3, 3, 2],
      requestKeys: ["pay:801"],
    });
    expect(inspect("held-stock-unavailable")).toEqual({
      available: 0,
      held: 1,
      onHand: 1,
      orders: 1,
    });
    expect(request("checkout-held-unit").expected).toMatchObject({ status: 422 });
    expect(inspect("rejected-callbacks")).toEqual({
      eventReceipts: 0,
      paidTransitions: 0,
      providerCharges: 1,
      versions: [3, 3, 2],
    });
    expect(inspect("settled-once")).toEqual({
      paymentAttempts: 1,
      providerCharges: 1,
      eventReceipts: 2,
      paidTransitions: 1,
      held: 0,
      allocated: 1,
      versions: [4, 4, 3],
      states: ["settled", "paid", "consumed"],
      requestKeys: ["pay:801"],
    });
    expect(inspect("reconciled-once")).toEqual({
      providerCharges: 1,
      paidTransitions: 1,
      paymentAttempts: 1,
      versions: [4, 4, 3],
      requestKeys: ["pay:802"],
    });
    expect(request("older-failure").expected).toMatchObject({
      body: { state: "settled", applied: false },
    });
    for (const name of ["unknown-new-key", "cancel-unknown", "release-held"])
      expect(request(name).expected).toMatchObject({ status: 422 });
    expect(request("reconcile-pending").expected).toMatchObject({
      status: 503,
      body: { code: "DEPENDENCY_UNAVAILABLE" },
    });
  });

  it("verifies independent callback bytes/HMAC/timestamps and strict selected envelopes without executing a provider", () => {
    const examples = read("callbacks.examples.json") as {
      requestId: string;
      provider: "reference" | "stripe" | "warehouse";
      rawSha256: string;
      authentication: string;
      decodedEnvelopeValid: boolean;
    }[];
    const schemas = {
      reference: vendureReferenceEventSchema,
      stripe: vendureStripeEventSchema,
      warehouse: vendureWarehouseEventSchema,
    };
    const secrets = {
      reference: "fixture-only-reference-signing-key",
      stripe: "fixture-only-stripe-signing-key",
      warehouse: "fixture-only-warehouse-signing-key",
    };
    const fixtures = pack();
    for (const ex of examples) {
      const r = request(ex.requestId);
      const raw = r.input.body as string;
      expect(createHash("sha256").update(raw).digest("hex")).toBe(ex.rawSha256);
      expect(schemas[ex.provider].safeParse(JSON.parse(raw)).success).toBe(ex.decodedEnvelopeValid);
      const h = r.input.headers;
      const stripe = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(h["stripe-signature"] ?? "");
      const timestamp = ex.provider === "stripe" ? stripe?.[1] : h["x-provider-timestamp"];
      const signature = ex.provider === "stripe" ? stripe?.[2] : h["x-provider-signature"];
      const correct = createHmac("sha256", secrets[ex.provider])
        .update(`${timestamp}.${raw}`)
        .digest("hex");
      // Authentication time comes from the latest clock/restart/drain boundary in that scenario.
      let now = "2026-10-30T12:00:00Z";
      for (const scenario of fixtures.scenarios) {
        if (!scenario.steps.some((s) => s.kind === "request" && s.requestId === ex.requestId))
          continue;
        for (const s of scenario.steps) {
          if (s.kind === "request" && s.requestId === ex.requestId) break;
          if (s.kind === "control") {
            const input = s.input as { now?: string; clock?: string };
            now = input.now ?? input.clock ?? now;
          }
        }
      }
      expect(
        signature === correct && Math.abs(Date.parse(now) / 1000 - Number(timestamp)) <= 300,
        ex.requestId,
      ).toBe(ex.authentication === "valid");
    }
    expect(examples.some((e) => e.authentication === "reject")).toBe(true);
    expect(request("stripe-status-mismatch").expected).toMatchObject({ status: 403 });
    expect(request("stripe-amount-mismatch").expected).toMatchObject({ status: 403 });
    expect(request("stripe-foreign").expected).toMatchObject({ status: 404 });
  });

  it("keeps named Stripe wire mapping/evidence distinct from reference protocol and core money bounds", () => {
    const provider = read("providers.examples.json");
    vendureProviderContracts.referenceDispatch.parse(provider.reference.dispatch);
    vendureProviderContracts.referenceResult.parse(provider.reference.result);
    vendureProviderContracts.stripeCreate.parse(provider.stripe.dispatch);
    vendureProviderContracts.stripeResult.parse(provider.stripe.result);
    expect(provider.stripe).toMatchObject({
      apiVersion: "2025-03-31.basil",
      requestKey: "stripe:809",
      account: "acct_fixture_shop_a",
      createPath: "/v1/payment_intents",
      retrievePath: "/v1/payment_intents/pi_fixture_809",
    });
    expect(provider.reference.dispatch.requestKey).toBe("pay:801");
    expect(request("stripe-start").expected).toMatchObject({
      status: 202,
      body: { provider: "stripe-2025-03-31.basil", requestKey: "stripe:809" },
    });
    expect(request("start-unknown").expected).toMatchObject({
      status: 202,
      body: { provider: "reference-v1", requestKey: "pay:801" },
    });
    expect(inspect("stripe-settled-once")).toEqual({
      paymentAttempts: 1,
      providerCharges: 1,
      eventReceipts: 2,
      paidTransitions: 1,
      held: 0,
      versions: [4, 4, 3],
      requestKeys: ["stripe:809"],
    });
    expect(
      vendureProviderContracts.stripeCreate.safeParse({
        ...provider.stripe.dispatch,
        amount: 100000000,
      }).success,
    ).toBe(false);
  });

  it("pins expiry/payment races, monotone clocks and one materialized notification after restart", () => {
    expect(inspect("expiry-rollback")).toEqual({
      versions: [1, 1],
      states: ["awaiting-payment", "active"],
      receipts: 0,
      intents: 0,
    });
    expect(inspect("expired-once")).toEqual({
      versions: [2, 2],
      states: ["cancelled", "expired"],
      effectReceipts: 1,
      intents: 1,
      available: 15,
      providerCalls: 0,
    });
    expect(inspect("expiry-payment-races")).toEqual({
      paymentAttempts: 1,
      providerCalls: 0,
      versions: [2, 2, 2, 2],
      states: ["cancelled", "expired", "awaiting-payment", "held-for-payment"],
      held: 1,
    });
    expect(inspect("notification-after-restart")).toEqual({
      notifications: 1,
      effectReceipts: 1,
      forbiddenOccurrences: 0,
    });
    expect(inspect("revoked-pending-notification")).toEqual({
      notifications: 0,
      effectReceipts: 1,
      forbiddenOccurrences: 0,
    });
    for (const scenario of pack().scenarios) {
      const clocks = scenario.steps.flatMap((s) =>
        s.kind === "control" && ["clock", "drain", "restart", "expiryRace"].includes(s.controlId)
          ? [
              (s.input as { now?: string; clock?: string }).now ??
                (s.input as { clock?: string }).clock,
            ].filter((s): s is string => !!s)
          : [],
      );
      expect(clocks, scenario.id).toEqual([...clocks].sort());
    }
  });

  it("fixes all eight hook inputs/results, rounding, refund/payout ceilings and source revision recovery", () => {
    const examples = read("hooks.examples.json") as {
      hookId: keyof typeof vendureHookContracts;
      input: Record<string, unknown>;
      result: Record<string, unknown>;
    }[];
    expect(examples.map((e) => e.hookId).sort()).toEqual(Object.keys(vendureHookContracts).sort());
    for (const e of examples) {
      const contract = vendureHookContracts[e.hookId];
      expect(contract.input.safeParse(e.input).success, e.hookId).toBe(true);
      expect(contract.result.safeParse(e.result).success, e.hookId).toBe(true);
      expect(contract.input.safeParse({ ...e.input, bypassScope: true }).success).toBe(false);
      expect(contract.result.safeParse({ ...e.result, grantAdministrator: true }).success).toBe(
        false,
      );
    }
    expect(request("promotion-allocate").expected).toMatchObject({
      body: {
        discount: { minor: 3 },
        allocations: [
          { discount: { minor: 2 } },
          { discount: { minor: 1 } },
          { discount: { minor: 0 } },
        ],
      },
    });
    expect(request("production-tax-quote").expected).toMatchObject({
      body: {
        amount: { minor: 825 },
        inputHash: "67fdf67ad28492155d2861b9305aefcdd21c9ffc75d9a05cdacc89822d12d518",
      },
    });
    expect(request("currency-convert").expected).toMatchObject({
      body: {
        sourceMinor: 1999,
        targetMinor: 1839,
        numerator: 92,
        denominator: 100,
        rounding: "half-even",
      },
    });
    expect(request("return-one").expected).toMatchObject({ body: { amount: { minor: 2149 } } });
    expect(request("return-remainder").expected).toMatchObject({
      body: { amount: { minor: 4298 } },
    });
    expect(2149 + 4298).toBe(6447);
    expect(request("seller-plan").expected).toMatchObject({
      body: { gross: { minor: 5997 }, fee: { minor: 600 }, net: { minor: 5397 } },
    });
    expect(inspect("refund-unknown")).toMatchObject({
      refunds: 1,
      providerCalls: 1,
      states: ["unknown"],
      requestKeys: ["refund:1151"],
    });
    expect(inspect("payout-unknown")).toMatchObject({
      payouts: 1,
      providerCalls: 1,
      providerCharges: 0,
      states: ["unknown"],
    });
    expect(inspect("inventory-resumed")).toEqual({
      sourceReceipts: 3,
      reconciliations: 1,
      onHand: 31,
      held: 1,
      available: 27,
      versions: [13],
    });
    const base = examples.find((e) => e.hookId === "JH-currency");
    if (!base) throw new Error("Missing currency example");
    for (const [sourceMinor, targetMinor] of [
      [5, 2],
      [7, 4],
    ]) {
      vendureHookContracts["JH-currency"].input.parse({
        ...base.input,
        sourceMinor,
        numerator: 1,
        denominator: 2,
      });
      vendureHookContracts["JH-currency"].result.parse({
        ...base.result,
        sourceMinor,
        targetMinor,
        numerator: 1,
        denominator: 2,
      });
    }
    for (const hid of Object.keys(vendureHookContracts)) {
      const configurations = pack()
        .scenarios.flatMap((s) => s.steps)
        .filter(
          (s) =>
            s.kind === "control" &&
            s.controlId === "hook" &&
            (s.input as { hookId: string }).hookId === hid,
        );
      expect(
        configurations.map((s) => s.kind === "control" && (s.input as { mode: string }).mode),
      ).toEqual(expect.arrayContaining(["reference", "unavailable", "timeout", "invalid-result"]));
    }
  });

  it("keeps seed scope/ownership/price/quantity relationships internally consistent", () => {
    const data = Object.fromEntries(pack().datasets.map((d) => [d.id, d.rows])) as Record<
      string,
      Record<string, unknown>[]
    >;
    const rows = (key: string) => data[key] ?? [];
    const find = (key: string, identifier: unknown) => rows(key).find((r) => r.id === identifier);
    for (const v of rows("variants")) {
      const p = find("products", v.productId);
      expect(p?.scopeId).toBe(v.scopeId);
      expect(p?.variantIds).toContain(v.id);
    }
    for (const q of rows("quotes")) {
      const c = find("carts", q.cartId);
      expect(c?.scopeId).toBe(q.scopeId);
      expect(q.lines).toEqual(c?.lines);
    }
    for (const o of rows("orders")) {
      const q = find("quotes", o.quoteId);
      expect(q?.scopeId).toBe(o.scopeId);
      expect(q?.lines).toEqual(o.lines);
      expect(q?.total).toEqual(o.total);
      expect(q?.address).toEqual(o.address);
      expect(find("principals", o.ownerId)?.scopeId).toBe(o.scopeId);
    }
    for (const r of rows("reservations"))
      expect(find("orders", r.orderId)?.scopeId).toBe(r.scopeId);
    const overflow = find("carts", id(308));
    expect(overflow?.lines).toEqual([
      {
        id: id(1308),
        variantId: id(210),
        quantity: 2,
        unitPrice: { minor: 9007199254740991, currency: "USD" },
      },
    ]);
    expect(find("variants", id(210))?.price).toEqual({ minor: 9007199254740991, currency: "USD" });
    // Seed physical stock must cover every active/held/consumed commitment.
    for (const stock of rows("stock")) {
      const total = rows("reservations")
        .filter(
          (r) =>
            r.variantId === stock.variantId &&
            ["active", "held-for-payment", "consumed"].includes(String(r.state)),
        )
        .reduce((s, r) => s + Number(r.quantity), 0);
      expect(total).toBeLessThanOrEqual(Number(stock.onHand));
    }
    const file = readFileSync(
      new URL("../../../benchmarks/vendure-core/v1/receipt.txt", import.meta.url),
    );
    expect(file.toString()).toBe("fixture receipt\n");
    expect(file.byteLength).toBe(16);
    expect(createHash("sha256").update(file).digest("hex")).toBe(
      (rows("assets")[0] as Record<string, unknown>).sha256,
    );
  });

  it("excludes another customer's address, private prices/stock and revoked receipt replay", () => {
    for (const name of [
      "orders-first-page",
      "orders-next-page",
      "other-order",
      "other-history",
      "other-receipt",
      "foreign-order",
      "foreign-receipt",
      "revoked-order",
      "revoked-receipt",
      "revoked-checkout-replay",
      "other-inbox",
      "revoked-inbox",
      "search-page-one",
      "search-page-two",
      "search-after-rebuild",
    ]) {
      expect(JSON.stringify(request(name).expected), name).not.toMatch(
        /Bob Private Buyer|Foreign Private Buyer|Private Road|Foreign Road|costMinor|onHand|allocated/,
      );
    }
    expect(request("orders-next-page").expected).toMatchObject({
      body: { items: [{ id: id(605) }] },
    });
    expect(request("revoked-checkout-replay").expected).toMatchObject({ status: 404 });
  });

  it.each([
    "missing-observation",
    "unknown-operation",
    "wrong-pin",
    "added-authority",
    "bad-seed",
    "contradicted-literal",
    "unsafe-error",
    "orphan-request",
    "duplicate-route",
  ])("rejects corrupt %s", async (kind) => {
    const fixture = pack();
    const contract = {
      ...vendureFixtureContract,
      operations: [...vendureFixtureContract.operations],
    };
    if (kind === "missing-observation") fixture.observations.pop();
    if (kind === "unknown-operation" && fixture.observations[0])
      fixture.observations[0].operationIds = ["discourseReply"];
    if (kind === "wrong-pin" && fixture.ledgerHashes)
      fixture.ledgerHashes.manifest = "0".repeat(64);
    if (kind === "added-authority")
      (fixture.requests[0]?.input.body as Record<string, unknown>).role = "administrator";
    if (kind === "bad-seed")
      (
        fixture.datasets.find((d) => d.id === "orders")?.rows[0] as Record<string, unknown>
      ).version = 0;
    if (kind === "contradicted-literal") {
      const a = fixture.scenarios[0]?.steps[0]?.assertions[0];
      if (a?.kind === "equals") a.value = { runtimeDerived: true };
    }
    if (kind === "unsafe-error") {
      const r = fixture.requests.find((r) => "status" in r.expected && r.expected.status === 404);
      if (r && "body" in r.expected)
        (r.expected.body as Record<string, unknown>).privateAddress = "secret";
    }
    if (kind === "orphan-request" && fixture.requests[0])
      fixture.requests.push({ ...fixture.requests[0], id: "orphan" });
    if (kind === "duplicate-route" && contract.operations[0])
      contract.operations.push({ ...contract.operations[0], id: "aliasedOperation" });
    await expect(parseBenchmarkFixture(fixture, contract, await ledger())).rejects.toThrow();
  });
});
