import { createHash, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import Stripe from "stripe";
import { expect, test } from "vitest";
import { controlContainer, healthyCopies } from "../harness/activity.ts";
import { type Application, withApplication } from "../harness/application.ts";
import { rememberSecrets } from "../harness/evidence.ts";
import { command, poll, repository } from "../harness/process.ts";
import { finish, native } from "../harness/rg-foundations.ts";

const service = "app-payment-inbox";
const module = "verified-payment-event";
const route = `/modules/${module}`;
const edge = `/api/payment-inbox${route}`;
const bodyLimit = 262144;
const migration052 = "infra/postgres/billing/052-jeeves-durable-work.sql";
const migration056 = "infra/postgres/billing/056-jeeves-stripe-retention.sql";
const endpointSecret = () => `whsec_${randomBytes(32).toString("hex")}`;

function stripeEvent(id: string, status: string, created: number) {
  return {
    object: "event",
    id,
    type: "customer.subscription.updated",
    livemode: false,
    created,
    data: {
      object: { object: "subscription", id: "sub_fixture", customer: "cus_fixture", status },
    },
  };
}

function stripeHeaders(secret: string, payload: string, ageSeconds = 0) {
  return {
    "content-type": "application/json",
    "stripe-signature": Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
      timestamp: Math.floor(Date.now() / 1000) - ageSeconds,
    }),
  };
}

async function provision(app: Application, value: string, format: "stripe" | "keys") {
  const name = format === "stripe" ? "STRIPE_SECRET" : "KEYS";
  const file = join(app.directory, "../", `qr-fixture-${format}`);
  await rememberSecrets(app.directory, value);
  await writeFile(file, value, { mode: 0o644 });
  await writeFile(
    join(app.directory, "compose.override.yaml"),
    JSON.stringify({
      services: {
        [service]: {
          environment: {
            [`JEEVES_SECRET_JEEVES_WEBHOOK_VERIFIED_PAYMENT_EVENT_${name}_FILE`]:
              "/fixture-endpoint-secret",
          },
          volumes: [`${file}:/fixture-endpoint-secret:ro`],
        },
      },
    }),
  );
}

const sql = (app: Application, statement: string) => app.sql(statement, "d_billing");
const effectCount = (app: Application, id: string) =>
  sql(app, `SELECT count(*) FROM p_payment_inbox_owner.subscription_events WHERE event_id='${id}'`);
const row = (app: Application, id: string) =>
  sql(app, `SELECT state FROM jeeves.work_records WHERE work_key='${id}'`);
const expectState = (app: Application, id: string, state: string) =>
  poll(
    `${id} ${state}`,
    () => row(app, id),
    (value) => value === state,
  );
const post = (app: Application, body: string, headers: Record<string, string>) =>
  app.request(edge, { method: "POST", headers, body });

async function directCopy(
  app: Application,
  container: string,
  body: string,
  headers: Record<string, string>,
) {
  return native<{ status: number; id?: string }>(
    app,
    service,
    `
import {createHmac} from 'node:crypto';
const path=${JSON.stringify(route)}, seconds=String(Math.floor(Date.now()/1000));
const stamp='v1.'+seconds+'.'+createHmac('sha256',process.env.JEEVES_EDGE_STAMP_KEY).update(seconds+'.POST.'+path).digest('hex');
const response=await fetch('http://127.0.0.1:3000'+path,{method:'POST',headers:{... ${JSON.stringify(headers)},'x-edge-stamp':stamp},body:${JSON.stringify(body)}});
const value=await response.json();
${finish("{status:response.status,id:value.id}")}
`,
    container,
  );
}

/** A provider-facing relay receives the upstream reply but loses it before its client sees it. */
async function loseReply(
  app: Application,
  body: string,
  headers: Record<string, string>,
  id: string,
) {
  let resolve!: (receipt: { status: number; persisted: string }) => void;
  let reject!: (error: unknown) => void;
  const observed = new Promise<{ status: number; persisted: string }>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const relay = createServer(async (request, reply) => {
    request.resume();
    try {
      const { status } = await post(app, body, headers);
      resolve({ status, persisted: await row(app, id) });
    } catch (error) {
      reject(error);
    } finally {
      reply.destroy();
    }
  });
  await new Promise<void>((ready, fail) => {
    relay.once("error", fail);
    relay.listen(0, "127.0.0.1", ready);
  });
  try {
    const address = relay.address();
    if (!address || typeof address === "string") throw Error("Fixture relay unavailable");
    const provider = fetch(`http://127.0.0.1:${address.port}`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(7000),
    });
    const [receipt, delivery] = await Promise.all([
      observed,
      provider.then(
        (response) => response.status,
        () => null,
      ),
    ]);
    return { ...receipt, delivery };
  } finally {
    await new Promise<void>((close) => relay.close(() => close()));
  }
}

test("QR Stripe: exact signed ingress, durable retries across copies and restart, and finite retention", async () => {
  const secret = endpointSecret();
  await withApplication(
    "qr-stripe",
    ["webhook-receiver"],
    async (app) => {
      await app.compose(["up", "-d", "--no-deps", "--scale", `${service}=2`, service]);
      const copies = await healthyCopies(app, service, 2);
      const [first, second] = copies;
      if (!first || !second) throw Error("Two independent webhook copies required");

      const id = "evt_fixture_paid";
      const payload = JSON.stringify(stripeEvent(id, "active", 200));
      const headers = stripeHeaders(secret, payload);
      expect((await app.request(edge)).status).toBe(404);
      expect(
        (await app.request(`${edge}/other`, { method: "POST", body: payload, headers })).status,
      ).toBe(404);

      const authenticity = {
        missing: (await post(app, payload, { "content-type": "application/json" })).status,
        altered: (await post(app, `${payload} `, headers)).status,
        bad: (await post(app, payload, { ...headers, "stripe-signature": "wrong" })).status,
        stale: (await post(app, payload, stripeHeaders(secret, payload, 61))).status,
        future: (await post(app, payload, stripeHeaders(secret, payload, -61))).status,
        bom: (await post(app, `\ufeff${payload}`, headers)).status,
      };
      expect(authenticity).toEqual({
        missing: 400,
        altered: 400,
        bad: 400,
        stale: 400,
        future: 400,
        bom: 400,
      });
      expect(await row(app, id)).toBe("");
      const remapId = "evt_fixture_remap";
      const remap = JSON.stringify(stripeEvent(remapId, "fixture-remap", 200));
      expect((await post(app, remap, stripeHeaders(secret, remap))).status).toBe(400);
      expect(await row(app, remapId)).toBe("");
      expect(await row(app, "evt_fixture_wrong_id")).toBe("");
      app.record({ authenticity, changedMappedId: 400 });

      const before = await loseReply(
        app,
        payload,
        {
          ...headers,
          cookie: "fixture-session=invalid",
          authorization: "Bearer fixture-invalid-user",
        },
        id,
      );
      expect(before.status).toBe(202);
      expect(["accepted", "running", "completed"]).toContain(before.persisted);
      expect(before.delivery).toBeNull();
      expect(
        await sql(
          app,
          `SELECT input->'value'->>'contentHash' FROM jeeves.work_records WHERE work_key='${id}'`,
        ),
      ).toBe(createHash("sha256").update(payload).digest("hex"));
      app.record({ lostReply: before });

      await controlContainer(app, service, first.Id, "stop");
      await controlContainer(app, service, first.Id, "start");
      await healthyCopies(app, service, 2);
      const copiesResult = await Promise.all(
        [first, second].map(({ Id }) =>
          directCopy(app, Id, payload, stripeHeaders(secret, payload, 1)),
        ),
      );
      expect(copiesResult).toEqual([
        { status: 202, id },
        { status: 202, id },
      ]);
      await expectState(app, id, "completed");
      expect(await effectCount(app, id)).toBe("1");
      app.record({ replicas: copies.map((copy) => copy.Id), copiesResult, committedEffects: 1 });

      const conflict = await post(app, `${payload}\n`, stripeHeaders(secret, `${payload}\n`));
      expect(conflict.status).toBe(409);
      expect(conflict.body).toMatchObject({ error: "WORK_IDENTITY_CONFLICT" });
      expect(await effectCount(app, id)).toBe("1");

      const olderId = "evt_fixture_older";
      const older = JSON.stringify(stripeEvent(olderId, "incomplete", 100));
      expect((await post(app, older, stripeHeaders(secret, older))).status).toBe(202);
      await expectState(app, olderId, "completed");
      expect(await effectCount(app, olderId)).toBe("1");
      expect(
        await sql(
          app,
          "SELECT status||'|'||event_created FROM p_payment_inbox_owner.subscriptions",
        ),
      ).toBe("active|200");

      const limitId = "evt_fixture_max_bytes";
      const pre = JSON.stringify({ ...stripeEvent(limitId, "active", 200), fixturePadding: "" });
      const exact = `${pre.slice(0, -2) + "x".repeat(bodyLimit - Buffer.byteLength(pre))}"}`;
      const larger = `${exact} `;
      expect(Buffer.byteLength(exact)).toBe(bodyLimit);
      // These bodies are synthetic and deliberately large. Record sizes/statuses rather than bytes.
      async function sizeProbe(body: string) {
        const response = await fetch(`http://127.0.0.1:${app.stack.ports[0]}${edge}`, {
          method: "POST",
          body,
          headers: stripeHeaders(secret, body),
          signal: AbortSignal.timeout(5000),
        });
        const status = response.status;
        await response.arrayBuffer();
        return status;
      }
      expect(await sizeProbe(exact)).toBe(202);
      expect(await sizeProbe(larger)).toBe(413);
      await expectState(app, limitId, "completed");
      expect(await effectCount(app, limitId)).toBe("1");
      app.record({ bodySizes: { [bodyLimit]: 202, [bodyLimit + 1]: 413 } });

      const unavailableId = "evt_fixture_store_unavailable";
      const unavailable = JSON.stringify(stripeEvent(unavailableId, "active", 200));
      const [postgres] = await app.containers("local-postgres");
      if (!postgres) throw Error("Fixture Postgres missing");
      await controlContainer(app, "local-postgres", postgres, "stop");
      try {
        const response = await fetch(`http://127.0.0.1:${app.stack.ports[0]}${edge}`, {
          method: "POST",
          body: unavailable,
          headers: stripeHeaders(secret, unavailable),
          signal: AbortSignal.timeout(5000),
        });
        const retryAfter = response.headers.get("retry-after");
        expect(response.status).toBe(503);
        expect(retryAfter).toBe("1");
        app.record({
          unavailable: { status: response.status, retryAfter, error: await response.json() },
        });
      } finally {
        await controlContainer(app, "local-postgres", postgres, "start");
      }
      await healthyCopies(app, "local-postgres", 1);
      expect(await row(app, unavailableId)).toBe("");
      expect((await post(app, unavailable, stripeHeaders(secret, unavailable))).status).toBe(202);
      await expectState(app, unavailableId, "completed");
      expect(await effectCount(app, unavailableId)).toBe("1");

      const failedId = "evt_fixture_failed";
      const failed = JSON.stringify(stripeEvent(failedId, "fixture-failure", 300));
      expect((await post(app, failed, stripeHeaders(secret, failed))).status).toBe(202);
      await expectState(app, failedId, "failed");
      expect(await effectCount(app, failedId)).toBe("0");
      expect(
        await sql(
          app,
          `SELECT retention_seconds||'|'||round(extract(epoch from expires_at-completed_at)) FROM jeeves.work_records WHERE work_key='${id}'`,
        ),
      ).toBe("3024000|3024000");
      expect(
        await sql(
          app,
          `SELECT state||'|'||attempts||'|'||(expires_at IS NULL) FROM jeeves.work_records WHERE work_key='${failedId}'`,
        ),
      ).toBe("failed|4|true");
      await sql(
        app,
        `
WITH fixture_clock AS (SELECT clock_timestamp() AS now)
UPDATE jeeves.work_records SET
  completed_at=now-interval '35 days'+CASE WHEN work_key='${olderId}' THEN interval '1 hour' ELSE interval '0' END,
  expires_at=now+CASE WHEN work_key='${olderId}' THEN interval '1 hour' ELSE interval '0' END
FROM fixture_clock WHERE work_key IN ('${id}', '${olderId}');
`,
      );
      await expectState(app, id, "");
      expect(await row(app, olderId)).toBe("completed");
      expect(await row(app, failedId)).toBe("failed");
      expect(await effectCount(app, id)).toBe("1");
      app.record({
        completedRetentionSeconds: 3024000,
        cutoff: "removed",
        withinCutoff: "completed",
        failed: "retained",
      });
    },
    "design.json",
    {
      beforeStart: (app) => provision(app, secret, "stripe"),
    },
  );
});

test("QR Stripe: older absent format still uses generic Jeeves verification and seven days", async () => {
  const raw = randomBytes(32);
  const ring = JSON.stringify([{ id: "fixture", key: raw.toString("base64url") }]);
  await withApplication(
    "qr-stripe",
    ["webhook-receiver"],
    async (app) => {
      const id = "synthetic-generic-id";
      const payload = JSON.stringify({
        id,
        type: "subscription.changed",
        payload: { customer: "c", status: "active", created: 1 },
      });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const key = Buffer.from(
        hkdfSync("sha256", raw, "jeeves.keys.v1", '["sign","jeeves.webhook.v1"]', 32),
      );
      const signature = createHmac("sha256", key)
        .update(`jeeves-webhook-v1\n${module}\n${timestamp}\n`)
        .update(payload)
        .digest("hex");
      const headers = {
        "content-type": "application/json",
        "x-jeeves-timestamp": timestamp,
        "x-jeeves-signature": `v1=${signature}`,
      };
      expect((await post(app, payload, stripeHeaders(endpointSecret(), payload))).status).toBe(401);
      expect((await post(app, payload, headers)).status).toBe(202);
      expect((await post(app, payload, headers)).status).toBe(202);
      await expectState(app, id, "completed");
      expect(await effectCount(app, id)).toBe("1");
      expect(
        await sql(app, `SELECT retention_seconds FROM jeeves.work_records WHERE work_key='${id}'`),
      ).toBe("604800");
      expect(
        app.manifest.files.some((entry) => entry.path === "src/runtime/stripe-webhook.ts"),
      ).toBe(false);
      const before = await sql(
        app,
        `SELECT sha256 FROM public.local_migrations WHERE version='${migration052}'`,
      );
      expect(before).toMatch(/^[a-f0-9]{64}$/);
      expect(
        await sql(
          app,
          `SELECT version FROM public.local_migrations WHERE version='${migration056}'`,
        ),
      ).toBe("");
      const upgrade = join(app.directory, "../stripe-migration");
      await command("pnpm", [
        "--filter",
        "@jeeves/generator",
        "export:v2",
        join(repository, "field-projects/generator-system/fixtures/qr-stripe/design.json"),
        upgrade,
      ]);
      const historical = await readFile(join(upgrade, migration052));
      expect(createHash("sha256").update(historical).digest("hex")).toBe(before);
      // The generated migration service uses the current Stripe export's plan and extra migration
      // against the running legacy database. Its existing image retains the identical 052 files,
      // migration runner and fixture product attachments.
      const mount = (path: string) => ["--volume", `${join(upgrade, path)}:/app/${path}:ro`];
      const run = () =>
        app.compose([
          "run",
          "--rm",
          "--no-deps",
          ...mount("infra/local.json"),
          ...mount(migration056),
          "setup-migrate",
        ]);
      await run();
      await run();
      expect(
        await sql(
          app,
          `SELECT sha256 FROM public.local_migrations WHERE version='${migration052}'`,
        ),
      ).toBe(before);
      expect(
        await sql(
          app,
          `SELECT version FROM public.local_migrations WHERE version='${migration056}'`,
        ),
      ).toBe(migration056);
      expect(await row(app, id)).toBe("completed");
      expect(await effectCount(app, id)).toBe("1");
      await expect(
        sql(
          app,
          `
UPDATE jeeves.work_records
SET namespace='["billing","payment-inbox-owner","webhook-v1"]',retention_seconds=3024000
WHERE work_key='${id}'
`,
        ),
      ).rejects.toThrow(/work_records_retention_seconds_check/);
      expect(
        await sql(app, `SELECT retention_seconds FROM jeeves.work_records WHERE work_key='${id}'`),
      ).toBe("604800");
      app.record({
        migration: {
          retained052: before,
          applied: migration056,
          reapply: "no-op",
          ordinaryWorkCapped: true,
        },
      });
    },
    "generic.json",
    {
      beforeStart: (app) => provision(app, ring, "keys"),
    },
  );
});
