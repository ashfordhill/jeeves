import { expect, test } from "vitest";
import { healthyCopies } from "../harness/activity.ts";
import { type Application, withApplication } from "../harness/application.ts";
import {
  assertNoProcessExited,
  faultContainer,
  type LogLine,
  logsSince,
  onlyContainer,
  processStates,
  SqlSession,
  until,
} from "../harness/faults.ts";
import { poll } from "../harness/process.ts";
import { createCapture, emulatorFault, Pulled } from "../harness/pubsub.ts";

// The Pub/Sub fixture: Clicks API's Record stub publishes each click to the Clicks topic with its
// ID as `messageId`; Tally's Count stub consumes its own subscription and writes Tally database.
const templates = ["module-stub", "module-stub"];
const topic = "clicks";
const subscription = "clicks--tally--count";
const failedSubscription = `${subscription}.failed`;
const database = "d_tally_db";
/** The harness's own subscription on the topic. */
const capture = "clicks--gs-capture";
/** Setup installs each fresh export with its README's plain command (P8). */
const plain = { install: "plain" } as const;
// Scenario contract: a stub's statement settles within 2000 ms (its statement timeout).
const statementTimeoutMs = 2000;

// Durations use the monotonic clock: this host steps its wall clock (WSL2 time sync).
type Answer = { status: number; body: unknown; elapsedMs: number; answeredAt: number };
async function timed(request: () => Promise<{ status: number; body: unknown }>): Promise<Answer> {
  const started = performance.now();
  const value = await request();
  const answeredAt = performance.now();
  return { ...value, elapsedMs: Math.round(answeredAt - started), answeredAt };
}
const clickValue = (id: string) => `value of ${id}`;
const record = (app: Application, id: string) =>
  timed(() =>
    app.request("/api/clicks-api/modules/record", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: id, value: clickValue(id) }),
    }),
  );
const clickId = (id: string) => {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid click ID ${id}`);
  return id;
};
/** Tally's counted clicks among `ids`, `<id>|<value>` (administrative observation). */
async function counted(app: Application, ids: string[]) {
  const list = ids.map((id) => `'${clickId(id)}'`).join(",");
  const rows = await app.sql(
    `SELECT message_id||'|'||value FROM m_count.clicks WHERE message_id IN (${list}) ORDER BY message_id COLLATE "C"`,
    database,
  );
  return rows ? rows.split("\n") : [];
}
/** Polls until Tally has counted exactly `ids`, once each; `at` is when it saw them. */
function countedBecomes(app: Application, ids: string[], timeoutMs = 30_000) {
  const expected = [...new Set(ids)].sort().map((id) => `${id}|${clickValue(id)}`);
  return poll(
    `Tally counted ${expected.length} clicks`,
    async () => ({ rows: await counted(app, ids), at: performance.now() }),
    (value) => JSON.stringify(value.rows) === JSON.stringify(expected),
    timeoutMs,
    (value) => app.record(value),
  );
}
/** The attempt of each delivery Count recorded for `id`, in order. */
async function attempts(app: Application, id: string) {
  const rows = await app.sql(
    `SELECT attempt FROM m_count.deliveries WHERE message_id='${clickId(id)}' ORDER BY at, attempt`,
    database,
  );
  return rows ? rows.split("\n").map(Number) : [];
}
/** Resubmits one click (a client retrying its 503) until it answers 202. */
function acceptedAgain(app: Application, id: string, timeoutMs: number) {
  return poll(
    `${id} answers 202 again`,
    () => record(app, id),
    (value) => value.status === 202,
    timeoutMs,
    (value) => app.record(value),
  );
}

/**
 * P7 on a fresh `first-run`: Tally's subscriber probe, from its line before it (its database
 * probe) to its own `ok`, and the stack's first publish (`first`), each under 2.0 s. P8: setup
 * installed this fresh export with the plain command.
 */
async function freshStart(app: Application, first: string) {
  expect(app.installArgs).toEqual(["install", "--frozen-lockfile"]);
  const states = await processStates(app);
  const started = (service: string) => {
    const row = states.find((state) => state.service === service);
    if (!row) throw new Error(`${service} missing`);
    return row.startedAt;
  };
  const tally = await logsSince(app, "app-tally", started("app-tally"));
  const probes = (lines: LogLine[]) => lines.filter((line) => line.entry.event === "probe");
  const tallyProbes = probes(tally);
  const index = tallyProbes.findIndex((line) => line.entry.client === subscription);
  const [previous, own] = [tallyProbes[index - 1], tallyProbes[index]];
  expect(previous?.entry).toMatchObject({ client: "tally-db", check: "SELECT 1", result: "ok" });
  expect(own?.entry).toMatchObject({ check: "the Pub/Sub subscription exists", result: "ok" });
  if (!previous || !own) throw new Error("Probe lines missing");
  // Nothing is logged between them: the gap is the subscriber probe's own time.
  expect(tally.indexOf(own) - tally.indexOf(previous)).toBe(1);
  const subscriberProbeMs = Date.parse(own.at) - Date.parse(previous.at);
  const api = probes(await logsSince(app, "app-clicks-api", started("app-clicks-api")));
  expect(api.map((line) => line.entry)).toEqual([
    expect.objectContaining({ client: topic, check: "the Pub/Sub topic exists", result: "ok" }),
  ]);
  const firstPublish = await record(app, first);
  const p7 = {
    subscriberProbeMs,
    subscriberProbeLines: [previous, own],
    // Upper bound only: from the container's start, Node's start and imports included.
    publisherProbeFromStartMs: Date.parse(api[0]?.at ?? "") - Date.parse(started("app-clicks-api")),
    firstPublish,
  };
  await app.save("p7-fresh-start.json", p7);
  expect(firstPublish.status).toBe(202);
  expect(firstPublish.elapsedMs).toBeLessThan(2000);
  expect(subscriberProbeMs).toBeLessThan(2000);
  return p7;
}

/** Holds the emulator frozen while `work` runs, and always resumes it. */
async function whilePaused<T>(
  app: Application,
  work: (paused: { at: string; monotonicAt: number }) => Promise<T>,
) {
  const paused = await emulatorFault(app, "pause");
  let frozen = true;
  try {
    const result = await work(paused);
    const resumed = await emulatorFault(app, "unpause");
    frozen = false;
    return { paused, resumed, result };
  } finally {
    if (frozen) await emulatorFault(app, "unpause");
  }
}

test("P8, P7, P1, P3, P9: a plain install; a fresh start's first publish and subscriber probe each under 2 s; every 202 is published and a repeated ID counts once; Not implemented and an exhausted retry end in .failed with their codes; a click held 30 s is delivered once", async () => {
  await withApplication(
    "pubsub",
    templates,
    async (app) => {
      // The capture sees every message published after it exists: create it before the first.
      await createCapture(app, "app-clicks-api", capture, topic);
      const captured = new Pulled(app, "app-clicks-api", capture);
      const failed = new Pulled(app, "app-clicks-api", failedSubscription);
      const p7 = await freshStart(app, "p1-a");
      const before = await processStates(app);

      // P1: every ID answered 202 is in the capture subscription; one ID twice counts once.
      const sent = ["p1-a"];
      for (const id of ["p1-b", "p1-b", "p1-c"]) {
        expect((await record(app, id)).status).toBe(202);
        sent.push(id);
      }
      await poll(
        "the capture subscription holds every message answered 202",
        () => captured.pull(),
        (messages) => messages.length >= sent.length,
        15_000,
      );
      expect(captured.ids()).toEqual([...sent].sort());
      for (const message of captured.messages)
        expect(message.data).toBe(
          JSON.stringify({ value: clickValue(message.attributes.messageId ?? "") }),
        );
      await countedBecomes(app, sent);
      // Both p1-b messages reached Count, each its first delivery; the click counted once.
      await poll(
        "Count recorded both p1-b deliveries",
        () => attempts(app, "p1-b"),
        (rows) => rows.length === 2,
        10_000,
      );
      expect(await attempts(app, "p1-b")).toEqual([1, 1]);
      expect(await counted(app, ["p1-b"])).toEqual([`p1-b|${clickValue("p1-b")}`]);

      // P3: "Not implemented" ends in .failed at once; a retryable failure is redelivered with a
      // growing attempt and ends there RETRY_EXHAUSTED on attempt 6 (5 retries).
      const p3At = new Date().toISOString();
      for (const id of ["ni-p3", "retry-p3"]) expect((await record(app, id)).status).toBe(202);
      await poll(
        "both terminal messages are in .failed",
        () => failed.pull(),
        (messages) => messages.length >= 2,
        90_000,
      );
      expect(
        failed.messages
          .map((message) => [message.attributes, message.data] as const)
          .sort(([a], [b]) => String(a.messageId).localeCompare(String(b.messageId))),
      ).toEqual([
        [
          { messageId: "ni-p3", "x-terminal-code": "NOT_IMPLEMENTED" },
          JSON.stringify({ value: clickValue("ni-p3") }),
        ],
        [
          { messageId: "retry-p3", "x-terminal-code": "RETRY_EXHAUSTED" },
          JSON.stringify({ value: clickValue("retry-p3") }),
        ],
      ]);
      const retries = await attempts(app, "retry-p3");
      expect(retries[0]).toBe(1);
      expect(retries.at(-1)).toBe(6);
      for (let n = 1; n < retries.length; n++)
        expect(retries[n]).toBeGreaterThan(retries[n - 1] ?? 0);
      // The fixture's ni- clicks throw before Count records anything.
      expect(await attempts(app, "ni-p3")).toEqual([]);
      expect(await counted(app, ["ni-p3", "retry-p3"])).toEqual([]);
      const lines = await logsSince(app, "app-tally", p3At);
      expect(
        lines.filter((line) => line.entry.event === "not-implemented").map((line) => line.entry),
      ).toEqual([
        expect.objectContaining({
          messageId: "ni-p3",
          action: `sent to ${failedSubscription} (NOT_IMPLEMENTED)`,
        }),
      ]);
      const loopErrors = lines.filter(
        (line) => line.entry.event === "loop-error" && line.entry.messageId === "retry-p3",
      );
      expect(loopErrors.at(-1)?.entry).toMatchObject({
        attempt: 6,
        action: `sent to ${failedSubscription} (RETRY_EXHAUSTED)`,
      });
      // Nothing else reached .failed, and the capture holds each P3 message once.
      await failed.pull();
      expect(failed.messages).toHaveLength(2);
      await captured.pull();
      expect(captured.ids()).toEqual([...sent, "ni-p3", "retry-p3"].sort());
      await assertNoProcessExited(app, before, "P1 and P3");
      await app.save("p1-p3.json", {
        p7,
        captured: captured.messages,
        failed: failed.messages,
        retryAttempts: retries,
        deliveries: await app.sql(
          "SELECT json_agg(d ORDER BY at) FROM m_count.deliveries d",
          database,
        ),
      });

      // P9 (QG27): Count records a hold- click's delivery, holds it 30 s, then counts it. Its
      // lease lasts the subscription's 60 s deadline and is extended while it is in hand, so it
      // doesn't lapse: one delivery, attempt 1. A copy would reach Count right after the held
      // click's ack and be recorded at once, so 10 s after the count shows none came.
      const hold = "hold-p9";
      const holdSent = await record(app, hold);
      expect(holdSent.status).toBe(202);
      const holdCounted = await countedBecomes(app, [hold], 60_000);
      await until(holdCounted.at + 10_000);
      const p9 = {
        sent: holdSent,
        countedMs: Math.round(holdCounted.at - holdSent.answeredAt),
        attempts: await attempts(app, hold),
        deliveries: await app.sql(
          `SELECT json_agg(d ORDER BY at) FROM m_count.deliveries d WHERE message_id='${hold}'`,
          database,
        ),
      };
      await app.save("p9-hold.json", p9);
      expect(p9.attempts).toEqual([1]);
      expect(p9.countedMs).toBeGreaterThanOrEqual(30_000);
      expect(await counted(app, [hold])).toEqual([`${hold}|${clickValue(hold)}`]);
      await failed.pull();
      expect(failed.messages).toHaveLength(2);
      await assertNoProcessExited(app, before, "P9");
    },
    "design.json",
    plain,
  );
});

test("P2, P6: while the emulator is paused a publish answers 503 within 2.5 s and nothing else in the process fails; after a 60 s pause the first 202 comes within 3 s and Tally counts the backlog within 10 s; no process restarts", async () => {
  await withApplication(
    "pubsub",
    templates,
    async (app) => {
      const p7 = await freshStart(app, "p2-first");
      await countedBecomes(app, ["p2-first"]);
      const before = await processStates(app);
      const apiFailures = async (since: string) =>
        (await logsSince(app, "app-clicks-api", since)).filter(
          (line) => line.entry.event === "failure",
        );

      // P2: a short pause. Each publish answers 503 within 2.5 s; the process still answers.
      const p2 = await whilePaused(app, async () => {
        const publishes = [];
        for (const id of ["p2-paused-0", "p2-paused-1"]) publishes.push(await record(app, id));
        const health = await timed(() => app.request("/api/clicks-api/healthz"));
        return { publishes, health };
      });
      for (const answer of p2.result.publishes) {
        expect(answer.status).toBe(503);
        expect(answer.elapsedMs).toBeLessThan(2500);
      }
      expect(p2.result.health.status).toBe(200);
      // Unpaused: 202 within 10 s, the 503's identity resubmitted.
      const resumedAt = p2.resumed.monotonicAt;
      const accepted = await acceptedAgain(app, "p2-paused-0", 15_000);
      const p2AcceptedMs = Math.round(accepted.answeredAt - resumedAt);
      expect(p2AcceptedMs).toBeLessThan(10_000);
      await acceptedAgain(app, "p2-paused-1", 10_000);
      await countedBecomes(app, ["p2-first", "p2-paused-0", "p2-paused-1"]);
      // Nothing else in Clicks API failed: its only failure lines are those publishes' requests.
      const p2Failures = await apiFailures(p2.paused.at);
      expect(p2Failures.length).toBeGreaterThanOrEqual(1);
      for (const line of p2Failures) expect(line.entry.what).toBe("request POST /modules/record");
      await assertNoProcessExited(app, before, "P2 emulator paused");

      // P6: the emulator paused for 60 s. A click every 10 s answers 503 within 2.5 s; its client
      // keeps it to send again.
      const held: string[] = [];
      const p6 = await whilePaused(app, async (paused) => {
        const publishes = [];
        for (let n = 0; n < 6; n++) {
          await until(paused.monotonicAt + n * 10_000);
          const id = `p6-held-${n}`;
          held.push(id);
          publishes.push({ id, ...(await record(app, id)) });
        }
        await until(paused.monotonicAt + 60_000);
        return { publishes };
      });
      for (const answer of p6.result.publishes) {
        expect(answer.status).toBe(503);
        expect(answer.elapsedMs).toBeLessThan(2500);
      }
      const unpausedAt = p6.resumed.monotonicAt;
      const [firstHeld, ...restHeld] = held as [string, ...string[]];
      const first = await acceptedAgain(app, firstHeld, 15_000);
      const firstAcceptedMs = Math.round(first.answeredAt - unpausedAt);
      const fresh = ["p6-after-0", "p6-after-1", "p6-after-2"];
      for (const id of restHeld) await acceptedAgain(app, id, 10_000);
      for (const id of fresh) expect((await record(app, id)).status).toBe(202);
      const backlog = [...held, ...fresh];
      const all = await countedBecomes(app, backlog, 20_000);
      const backlogCountedMs = Math.round(all.at - unpausedAt);
      const p6Evidence = {
        p7,
        p2: { ...p2, acceptedMs: p2AcceptedMs },
        p6: {
          ...p6,
          pausedMs: Math.round(p6.resumed.monotonicAt - p6.paused.monotonicAt),
          firstAcceptedMs,
          backlog,
          backlogCountedMs,
          deliveries: await app.sql(
            "SELECT json_agg(d ORDER BY at) FROM m_count.deliveries d WHERE message_id LIKE 'p6-%'",
            database,
          ),
        },
        failures: {
          api: await apiFailures(p6.paused.at),
          tally: (await logsSince(app, "app-tally", p2.paused.at)).filter(
            (line) => line.entry.level === "error",
          ),
        },
      };
      await app.save("p2-p6.json", p6Evidence);
      expect(firstAcceptedMs).toBeLessThan(3000);
      expect(backlogCountedMs).toBeLessThan(10_000);
      for (const line of p6Evidence.failures.api)
        expect(line.entry.what).toBe("request POST /modules/record");
      await assertNoProcessExited(app, before, "P6 emulator paused 60 s");
    },
    "design.json",
    plain,
  );
});

test("P4, P5: Tally killed after its commit and before its ack gets the click again and counts it once; while PostgreSQL is stopped nothing reaches .failed and the attempt stays, and every click counts after restore with no restart", async () => {
  await withApplication(
    "pubsub",
    templates,
    async (app) => {
      const p7 = await freshStart(app, "p4-seed");
      await countedBecomes(app, ["p4-seed"]);
      const failed = new Pulled(app, "app-clicks-api", failedSubscription);

      // P4: a gate holds Count's delivery record, which follows its committed click, so the
      // handler has not resolved and the message is not acknowledged; then Tally is killed.
      type Backend = {
        pid: number;
        usename: string;
        client: string;
        query_start: string;
        state: string;
        wait_event_type: string | null;
        wait_event: string | null;
        waited_ms: number;
      };
      const backend = (where: string) =>
        `SELECT pid,usename,host(client_addr) AS client,query_start::text,state,wait_event_type,wait_event,
          (extract(epoch FROM clock_timestamp()-query_start)*1000)::int AS waited_ms
         FROM pg_stat_activity WHERE ${where}`;
      const id = "p4-gated";
      const tally = await onlyContainer(app, "app-tally");
      const tallyAddresses = Object.values(tally.NetworkSettings.Networks).map(
        (network) => network.IPAddress,
      );
      const others = (await processStates(app)).filter((row) => row.service !== "app-tally");
      const lockKey = 7420932;
      const holder = await SqlSession.open(app, database, "gate holder");
      const observer = await SqlSession.open(app, database, "observer");
      let locked = false,
        gated = false;
      const removeGate = async () => {
        await holder.run(
          "DROP TRIGGER gs_pubsub_hold ON m_count.deliveries; DROP SCHEMA gs_pubsub_gate CASCADE;",
        );
        gated = false;
      };
      const boundary: Record<string, unknown> = {};
      try {
        await holder.run(`SELECT pg_advisory_lock(${lockKey});`);
        locked = true;
        // Blocks execution only: this relation and this one click.
        await holder.run(`CREATE SCHEMA gs_pubsub_gate;
CREATE FUNCTION gs_pubsub_gate.hold() RETURNS trigger LANGUAGE plpgsql AS $gate$
BEGIN PERFORM pg_advisory_xact_lock_shared(${lockKey}); RETURN NEW; END $gate$;
CREATE TRIGGER gs_pubsub_hold BEFORE INSERT ON m_count.deliveries
  FOR EACH ROW WHEN (NEW.message_id = '${id}') EXECUTE FUNCTION gs_pubsub_gate.hold();`);
        gated = true;
        expect((await record(app, id)).status).toBe(202);
        // Seen promptly: the statement timeout ends the wait 2 s after it starts.
        const waiting = `usename='r_tally_db__tally' AND state='active' AND wait_event_type='Lock' AND wait_event='advisory' AND position('INSERT INTO m_count.deliveries' in query)>0`;
        const deadline = performance.now() + 10_000;
        let blocked: Backend | undefined;
        while (!blocked && performance.now() < deadline) {
          [blocked] = await observer.json<Backend[]>(backend(waiting));
          if (!blocked) await new Promise((done) => setTimeout(done, 10));
        }
        if (!blocked) throw new Error("Count's delivery record never waited at the gate");
        const gate = blocked;
        const killed = await faultContainer(app, "app-tally", tally.Id, "kill");
        // Same backend and statement, still waiting: the kill came before the handler resolved.
        const [still] = await observer.json<Backend[]>(backend(`pid=${gate.pid}`));
        Object.assign(boundary, { blocked: gate, killed, still });
        expect(still).toMatchObject({
          pid: gate.pid,
          query_start: gate.query_start,
          state: "active",
          wait_event: "advisory",
        });
        expect(still?.waited_ms).toBeLessThan(statementTimeoutMs);
        expect(tallyAddresses).toContain(gate.client);
        // Its click had committed before that statement began.
        expect(
          await observer.run(`SELECT value FROM m_count.clicks WHERE message_id='${id}';`),
        ).toBe(clickValue(id));
        // The server's statement timeout ends the dead worker's statement, uncommitted.
        await poll(
          "the killed worker's backend ends",
          () => observer.json<Backend[]>(backend(`pid=${gate.pid}`)),
          (rows) => rows.length === 0,
          15_000,
          (value) => app.record(value),
        );
        expect(
          await observer.run(`SELECT count(*) FROM m_count.deliveries WHERE message_id='${id}';`),
        ).toBe("0");
        await holder.run(`SELECT pg_advisory_unlock(${lockKey});`);
        locked = false;
        await removeGate();
        expect(
          await observer.run("SELECT count(*) FROM pg_trigger WHERE tgname='gs_pubsub_hold';"),
        ).toBe("0");
      } finally {
        if (locked) await holder.run(`SELECT pg_advisory_unlock(${lockKey});`);
        if (gated) await removeGate();
        await holder.close();
        await observer.close();
      }
      await app.save("p4-kill-boundary.json", boundary);
      await assertNoProcessExited(app, others, "P4 Tally killed");
      const restarted = await faultContainer(app, "app-tally", tally.Id, "start");
      await healthyCopies(app, "app-tally", 1);
      // Delivered again (a later attempt) and counted once.
      const again = await poll(
        "the gated click is delivered again",
        () => attempts(app, id),
        (rows) => rows.length > 0,
        60_000,
        (value) => app.record(value),
      );
      const redeliveredMs = Math.round(performance.now() - restarted.monotonicAt);
      for (const attempt of again) expect(attempt).toBeGreaterThan(1);
      expect(await counted(app, [id])).toEqual([`${id}|${clickValue(id)}`]);
      await failed.pull();
      expect(failed.messages).toEqual([]);

      // P5: PostgreSQL stopped while clicks are consumed (SO02's pattern).
      const before = await processStates(app);
      const postgres = await onlyContainer(app, "local-postgres");
      const stopped = await faultContainer(app, "local-postgres", postgres.Id, "stop");
      const during = ["p5-0", "p5-1", "p5-2"];
      // Publishing needs only Pub/Sub: these are accepted during the outage.
      for (const click of during) expect((await record(app, click)).status).toBe(202);
      // PostgreSQL stays away until two waiting lines are first seen one 5 s wait apart, so the
      // click in hand has failed again; .failed is read each time.
      const firstSeen = new Map<string, number>();
      const outage = await poll(
        "Count's click waits out the outage, one wait apart",
        async () => {
          const now = performance.now();
          const notCounted = (await logsSince(app, "app-tally", stopped.at))
            .filter(
              (line) =>
                line.entry.event === "loop-error" &&
                String(line.entry.action).includes("attempt not counted"),
            )
            .map((line) => {
              const key = `${line.container} ${line.at}`;
              if (!firstSeen.has(key)) firstSeen.set(key, now);
              return {
                ...line,
                seenMs: Math.round((firstSeen.get(key) ?? now) - stopped.monotonicAt),
              };
            });
          return { notCounted, failed: await failed.pull() };
        },
        (value) => {
          const seen = value.notCounted.map((line) => line.seenMs);
          return (
            value.failed.length > 0 ||
            (seen.length >= 2 && Math.max(...seen) - Math.min(...seen) >= 5000)
          );
        },
        30_000,
        (value) => app.record(value),
      );
      expect(outage.failed, ".failed while PostgreSQL is away").toEqual([]);
      // One click in hand (Concurrency 1), kept with its first attempt.
      const held = outage.notCounted[0]?.entry.messageId;
      expect(during).toContain(held);
      for (const line of outage.notCounted)
        expect(line.entry).toMatchObject({
          module: "count",
          queue: subscription,
          messageId: held,
          attempt: 1,
        });
      await assertNoProcessExited(app, before, "P5 PostgreSQL away");
      const restored = await faultContainer(app, "local-postgres", postgres.Id, "start");
      await healthyCopies(app, "local-postgres", 1);
      const all = await countedBecomes(app, during, 30_000);
      // The held click ran with the attempt it waited with, and so did each click's first
      // delivery. A lease Pub/Sub let lapse meanwhile can deliver a copy again, with a later
      // attempt (at least once); that copy runs after, and the click still counts once.
      const deliveries: Record<string, number[]> = {};
      for (const click of during) {
        deliveries[click] = await attempts(app, click);
        expect(deliveries[click]?.[0], click).toBe(1);
      }
      await failed.pull();
      expect(failed.messages).toEqual([]);
      await assertNoProcessExited(app, before, "P5 counted after restore");
      await app.save("p4-p5.json", {
        p7,
        p4: { boundary, again, redeliveredMs },
        p5: {
          outage,
          held,
          deliveries,
          times: {
            outageMs: Math.round(restored.monotonicAt - stopped.monotonicAt),
            startToAllCountedMs: Math.round(all.at - restored.monotonicAt),
          },
        },
      });
    },
    "design.json",
    plain,
  );
});
