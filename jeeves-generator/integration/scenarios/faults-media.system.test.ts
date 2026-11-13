import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { brokerProbe, controlContainer, healthyCopies } from "../harness/activity.ts";
import { type Application, withApplication } from "../harness/application.ts";
import {
  assertNoProcessExited,
  brokerSignals,
  faultContainer,
  logsSince,
  onlyContainer,
  processStates,
  processTable,
  queueDepth,
  SqlSession,
} from "../harness/faults.ts";
import { IdentityClient } from "../harness/identity.ts";
import {
  api,
  asset,
  counts,
  delivery,
  details,
  mediaTemplates,
  plays,
  putPart,
  search,
  searchDocuments,
  startUpload,
  syntheticVideo,
  type Upload,
  uploads,
} from "../harness/media.ts";
import { poll } from "../harness/process.ts";

// Scenario contract: each API answers within its configured request deadline (at most 1 s for
// the reads and plays used here) plus the single edge hop.
const answerBoundMs = 1500;
const mediaBrokerClients = [
  { service: "app-watch-api", what: "broker publish view-events" },
  { service: "app-upload-api", what: "broker publish upload-jobs" },
  { service: "app-video-lifecycle", what: "broker publish publication-events" },
  { service: "app-video-lifecycle", what: "broker consume processing-events--video-lifecycle" },
  { service: "app-transcoder", what: "broker publish processing-events" },
  { service: "app-transcoder", what: "broker consume upload-jobs" },
  { service: "app-search-indexer", what: "broker consume publication-events--search-indexer" },
  { service: "app-view-counter", what: "broker consume view-events--view-counter" },
];
type Backend = {
  pid: number;
  usename: string;
  client: string;
  xact_start: string;
  query_start: string;
  state: string;
  wait_event_type: string | null;
  wait_event: string | null;
  waited_ms: number;
};
const backend = (where: string) =>
  `SELECT pid,usename,host(client_addr) AS client,xact_start::text,query_start::text,state,wait_event_type,
    wait_event,(extract(epoch FROM clock_timestamp()-query_start)*1000)::int AS waited_ms
   FROM pg_stat_activity WHERE ${where}`;
type Intent = { event_id: string; sent: boolean; attempts: number };
async function jobIntent(app: Application, id: string) {
  const value = await app.sql(
    `SELECT row_to_json(a) FROM (SELECT event_id,sent_at IS NOT NULL AS sent,attempts FROM upload_api_multipart_uploads.outbox WHERE destination='jobs' AND payload->>'videoId'='${id}') a`,
    "d_metadata",
  );
  return JSON.parse(value) as Intent;
}
/** One durable downstream effect: lifecycle receipts, publication intent, view and document. */
async function effects(app: Application, id: string) {
  const receipts = await app.sql(
    `SELECT coalesce(string_agg(payload->>'kind',',' ORDER BY payload->>'kind'),'') FROM upload_api_multipart_uploads.receipts WHERE payload->>'assetId'='${id}'`,
    "d_metadata",
  );
  const publications = await app.sql(
    `SELECT count(*)||'/'||count(sent_at) FROM upload_api_multipart_uploads.outbox WHERE destination='publication' AND payload->>'videoId'='${id}'`,
    "d_metadata",
  );
  const published = await app.sql(
    `SELECT count(*) FROM published.videos WHERE video_id='${id}'`,
    "d_metadata",
  );
  const documents = (await searchDocuments(app)).hits.filter((row) => row._id === id).length;
  const value = { receipts, publications, published, documents };
  app.record({ durableEffects: { id, ...value } });
  return value;
}
const once = { receipts: "started,succeeded", publications: "1/1", published: "1", documents: 1 };

test("B09 media: a Transcoder killed mid-encode, a jobs relay killed after its confirmed publish, and a broker outage with a job in hand and an intent waiting each yield one publication", async () => {
  await withApplication("media", mediaTemplates, async (app) => {
    const identity = new IdentityClient(app);
    const [account] = await identity.provision();
    if (!account) throw new Error("Disposable account required");
    let token = await identity.signIn(account);
    const short = await syntheticVideo(app);
    const long = await syntheticVideo(app, "long");
    const transfer = async (bytes: Buffer, name: string) => {
      const upload = await startUpload(app, token, bytes, name);
      for (let part = 1; part <= upload.partCount; part++)
        await putPart(app, token, upload, bytes, part);
      return upload;
    };
    const complete = async (upload: Upload) => {
      const response = await api(app, token, `${uploads}/${upload.uploadId}/complete`, "POST");
      expect(response).toMatchObject({
        status: 200,
        body: { videoId: upload.assetId, state: "pending" },
      });
    };
    const transcoder = await onlyContainer(app, "app-transcoder");
    const ffmpeg = async () =>
      (await processTable(app, "app-transcoder", transcoder.Id)).filter((line) =>
        /\bffmpeg\b.*media-job-/.test(line),
      );
    /** The job is processing and FFmpeg runs in the identified Transcoder container. */
    const encoding = (id: string) =>
      poll(
        `${id} is processing with FFmpeg running in ${transcoder.Id}`,
        async () => {
          const [row, lines, view] = await Promise.all([
            asset(app, id),
            ffmpeg(),
            app.request(details(id)),
          ]);
          return { state: row.state, ffmpeg: lines, details: view.status };
        },
        (value) => value.state === "processing" && value.ffmpeg.length > 0,
        60_000,
        (value) => app.record(value),
      );
    /** Until ready, no public view exists; partial or failed output is never public. */
    const readyOnlyWhenComplete = async (id: string) => {
      const history: { state: string; details: number }[] = [];
      const ready = await poll(
        `${id} becomes ready and only then public`,
        async () => {
          const view = await app.request(details(id));
          const row = await asset(app, id);
          history.push({ state: row.state, details: view.status });
          return { row, view };
        },
        (value) => value.row.state === "ready" && value.view.status === 200,
        180_000,
        (value) => app.record(value),
      );
      for (const step of history) {
        expect(step.state).not.toBe("failed");
        if (step.details === 200) expect(step.state).toBe("ready");
      }
      return ready;
    };

    // Case 1: the Transcoder dies while encoding.
    const killedEncode = await transfer(long, "transcoder-kill");
    await complete(killedEncode);
    const caught = await encoding(killedEncode.assetId);
    expect(caught.details).toBe(404);
    const killed = await faultContainer(app, "app-transcoder", transcoder.Id, "kill");
    expect(await asset(app, killedEncode.assetId)).toMatchObject({
      state: "processing",
      ready_at: null,
    });
    expect((await app.request(details(killedEncode.assetId))).status).toBe(404);
    await poll(
      "the killed encode's job returned to its queue",
      () => queueDepth(app, "app-video-lifecycle", "upload-jobs"),
      (value) => value.messageCount === 1 && value.consumerCount === 0,
      15_000,
      (value) => app.record(value),
    );
    await faultContainer(app, "app-transcoder", transcoder.Id, "start");
    await healthyCopies(app, "app-transcoder", 1);
    const recovered = await readyOnlyWhenComplete(killedEncode.assetId);
    expect(Date.parse(recovered.row.ready_at as string)).toBeGreaterThan(Date.parse(killed.at));
    const view = recovered.view.body as { manifest: string; thumbnail: string };
    await delivery(app, view.manifest, view.thumbnail);
    await poll(
      "the recovered encode has exactly one durable publication",
      () => effects(app, killedEncode.assetId),
      (value) => value.documents === 1,
      30_000,
    );
    expect(await effects(app, killedEncode.assetId)).toEqual(once);
    await app.save("transcoder-kill.json", { caught, killed, recovered: recovered.row });

    // Case 2: the jobs relay's process dies after its publish is confirmed, before sent_at.
    token = await identity.signIn(account);
    await controlContainer(app, "app-transcoder", transcoder.Id, "stop");
    await poll(
      "upload-jobs has no consumer, so the relayed job stays observable",
      () => queueDepth(app, "app-video-lifecycle", "upload-jobs"),
      (value) => value.messageCount === 0 && value.consumerCount === 0,
      15_000,
    );
    const relayed = await transfer(short, "relay-kill");
    const relay = await onlyContainer(app, "app-upload-api");
    const relayAddresses = Object.values(relay.NetworkSettings.Networks).map(
      (network) => network.IPAddress,
    );
    const lockKey = 7420731;
    const holder = await SqlSession.open(app, "d_metadata", "relay gate holder");
    const observer = await SqlSession.open(app, "d_metadata", "observer");
    let locked = false,
      gated = false;
    const removeGate = async () => {
      await holder.run(
        "DROP TRIGGER gs07_hold_sent ON upload_api_multipart_uploads.outbox; DROP SCHEMA gs07_fault_gate CASCADE;",
      );
      gated = false;
    };
    try {
      await holder.run(`SELECT pg_advisory_lock(${lockKey});`);
      locked = true;
      // Blocks execution only: this relation, the jobs destination and this one video.
      await holder.run(`CREATE SCHEMA gs07_fault_gate;
CREATE FUNCTION gs07_fault_gate.hold_sent() RETURNS trigger LANGUAGE plpgsql AS $gate$
BEGIN PERFORM pg_advisory_xact_lock_shared(${lockKey}); RETURN NEW; END $gate$;
CREATE TRIGGER gs07_hold_sent BEFORE UPDATE OF sent_at ON upload_api_multipart_uploads.outbox
  FOR EACH ROW WHEN (OLD.sent_at IS NULL AND NEW.sent_at IS NOT NULL AND OLD.destination='jobs'
    AND OLD.payload->>'videoId'='${relayed.assetId}')
  EXECUTE FUNCTION gs07_fault_gate.hold_sent();`);
      gated = true;
      await complete(relayed);
      const [blocked] = await poll(
        "the relay's sent_at update waits at the gate",
        () =>
          observer.json<Backend[]>(
            backend(
              "datname='d_metadata' AND state='active' AND wait_event_type='Lock' AND wait_event='advisory' AND position('SET sent_at' in query)>0",
            ),
          ),
        (rows) => rows.length === 1,
        10_000,
        (value) => app.record(value),
      );
      if (!blocked) throw new Error("Blocked relay update missing");
      expect(blocked.usename).toBe("r_metadata__upload_api");
      expect(relayAddresses).toContain(blocked.client);
      const downstream = await queueDepth(app, "app-video-lifecycle", "upload-jobs");
      expect(downstream).toMatchObject({ messageCount: 1, consumerCount: 0 });
      const relayKilled = await faultContainer(app, "app-upload-api", relay.Id, "kill");
      const [still] = await observer.json<Backend[]>(backend(`pid=${blocked.pid}`));
      expect(still).toMatchObject({
        pid: blocked.pid,
        xact_start: blocked.xact_start,
        query_start: blocked.query_start,
        state: "active",
        wait_event: "advisory",
      });
      await app.save("relay-kill-boundary.json", { blocked, downstream, relayKilled, still });
      await holder.run(`SELECT pg_advisory_unlock(${lockKey});`);
      locked = false;
      await poll(
        "the killed relay's database backend ends",
        () => observer.json<Backend[]>(backend(`pid=${blocked.pid}`)),
        (rows) => rows.length === 0,
        30_000,
        (value) => app.record(value),
      );
      // The committed intent is still pending: the dead relay's update never committed.
      expect(await jobIntent(app, relayed.assetId)).toMatchObject({ sent: false, attempts: 0 });
      await removeGate();
      expect(
        await observer.run("SELECT count(*) FROM pg_trigger WHERE tgname='gs07_hold_sent';"),
      ).toBe("0");
    } finally {
      if (locked) await holder.run(`SELECT pg_advisory_unlock(${lockKey});`);
      if (gated) await removeGate();
      await holder.close();
      await observer.close();
    }
    await faultContainer(app, "app-upload-api", relay.Id, "start");
    await healthyCopies(app, "app-upload-api", 1);
    const resent = await poll(
      "the pending intent is relayed again and marked sent",
      () => jobIntent(app, relayed.assetId),
      (value) => value.sent,
      30_000,
      (value) => app.record(value),
    );
    expect(resent.attempts).toBe(1);
    expect(await queueDepth(app, "app-video-lifecycle", "upload-jobs")).toMatchObject({
      messageCount: 2,
      consumerCount: 0,
    });
    await controlContainer(app, "app-transcoder", transcoder.Id, "start");
    await healthyCopies(app, "app-transcoder", 1);
    await readyOnlyWhenComplete(relayed.assetId);
    await poll(
      "both copies of the relayed job are consumed",
      () => queueDepth(app, "app-video-lifecycle", "upload-jobs"),
      (value) => value.messageCount === 0 && value.consumerCount === 1,
      60_000,
      (value) => app.record(value),
    );
    await poll(
      "the relayed job has exactly one durable publication",
      () => effects(app, relayed.assetId),
      (value) => value.documents === 1,
      30_000,
    );
    expect(await effects(app, relayed.assetId)).toEqual(once);
    // The restarted relay's process routes again through the edge (10 s name refresh).
    await poll(
      "the upload API answers through the edge again",
      () => app.request("/api/upload-api/healthz"),
      (value) => value.status === 200,
      15_000,
      (value) => app.record(value),
    );

    // Case 3: the broker stops with a job in the Transcoder's hands and an intent to relay.
    token = await identity.signIn(account);
    const inHand = await transfer(long, "broker-in-hand");
    const waiting = await transfer(short, "broker-waiting");
    await complete(inHand);
    await encoding(inHand.assetId);
    const inHandJob = (await jobIntent(app, inHand.assetId)).event_id;
    const broker = await onlyContainer(app, "local-broker");
    const running = await processStates(app);
    const outage = await faultContainer(app, "local-broker", broker.Id, "stop");
    // Precondition: the broker went away while the job was still in the Transcoder's hands.
    const inHandAtOutage = await ffmpeg();
    app.record({ inHandAtOutage });
    expect(inHandAtOutage.length).toBeGreaterThan(0);
    expect(await asset(app, inHand.assetId)).toMatchObject({ state: "processing", ready_at: null });
    await brokerSignals(app, mediaBrokerClients, outage.at, false, 15_000);
    for (const id of [killedEncode.assetId, relayed.assetId]) {
      const started = performance.now();
      const read = await app.request(details(id));
      expect(read.status).toBe(200);
      expect(performance.now() - started).toBeLessThan(answerBoundMs);
    }
    const found = await search(app);
    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({ total: 2 });
    const playEvent = randomUUID();
    // Durations use the monotonic clock: this host steps its wall clock (WSL2 time sync).
    const playStarted = performance.now();
    const play = await api(app, token, plays(killedEncode.assetId), "POST", {
      eventId: playEvent,
    });
    expect(play).toMatchObject({ status: 503, body: { error: "UNAVAILABLE" } });
    expect(performance.now() - playStarted).toBeLessThan(answerBoundMs);
    await complete(waiting);
    const deferred = await poll(
      "the waiting video's job intent stays pending, deferred by the relay",
      () => jobIntent(app, waiting.assetId),
      (value) => !value.sent && value.attempts >= 1,
      30_000,
      (value) => app.record(value),
    );
    const settled = await poll(
      "the job in hand runs on and settles while the broker is away",
      async () => ({
        lines: (await logsSince(app, "app-transcoder", outage.at)).filter(
          (line) => line.entry.event === "loop-error" && line.entry.messageId === inHandJob,
        ),
        ffmpeg: await ffmpeg(),
      }),
      (value) => value.lines.length > 0 && value.ffmpeg.length === 0,
      180_000,
      (value) => app.record(value),
    );
    expect(await asset(app, inHand.assetId)).toMatchObject({ state: "processing" });
    await assertNoProcessExited(app, running, "media broker down");
    const restored = await faultContainer(app, "local-broker", broker.Id, "start");
    await healthyCopies(app, "local-broker", 1);
    const signals = await brokerSignals(app, mediaBrokerClients, outage.at, true, 60_000);
    await assertNoProcessExited(app, running, "media broker back");
    const resumed = await readyOnlyWhenComplete(inHand.assetId);
    expect(Date.parse(resumed.row.ready_at as string)).toBeGreaterThan(Date.parse(restored.at));
    await readyOnlyWhenComplete(waiting.assetId);
    expect(await jobIntent(app, waiting.assetId)).toMatchObject({ sent: true });
    for (const id of [inHand.assetId, waiting.assetId]) {
      await poll(
        `${id} has exactly one durable publication`,
        () => effects(app, id),
        (value) => value.documents === 1,
        30_000,
      );
      expect(await effects(app, id)).toEqual(once);
    }
    // The 503's outcome is uncertain to its caller: retry the same stable identity.
    expect(
      (await api(app, token, plays(killedEncode.assetId), "POST", { eventId: playEvent })).status,
    ).toBe(202);
    await poll(
      "the retried play counts once",
      () => app.request(counts(killedEncode.assetId)),
      (value) => (value.body as { views?: string }).views === "1",
      30_000,
      (value) => app.record(value),
    );
    expect(
      await app.sql(
        `SELECT count(*) FROM view_counter_receipt_and_increment.receipts WHERE event_id='${playEvent}'`,
        "d_view_counts",
      ),
    ).toBe("1");
    const final = await search(app);
    expect(final.body).toMatchObject({ total: 4 });
    for (const queue of [
      "upload-jobs",
      "processing-events--video-lifecycle",
      "publication-events--search-indexer",
      "view-events--view-counter",
    ]) {
      await poll(
        `${queue} drained with its consumer back`,
        () => brokerProbe(app, "state", queue),
        (value) =>
          !!value &&
          "messageCount" in value &&
          value.messageCount === 0 &&
          value.unacknowledged === 0 &&
          value.consumerCount === 1,
        30_000,
        (value) => app.record(value),
      );
      expect(await brokerProbe(app, "state", `${queue}.failed`)).toMatchObject({
        messageCount: 0,
        unacknowledged: 0,
      });
    }
    await assertNoProcessExited(app, running, "media broker recovery complete");
    await app.save("broker-outage.json", { outage, deferred, settled, restored, signals });
  });
});
