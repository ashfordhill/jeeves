import { expect, test } from "vitest";
import {
  brokerProbe,
  controlContainer,
  healthyCopies,
  inApplication,
} from "../harness/activity.ts";
import { withApplication } from "../harness/application.ts";
import { command, hash, poll } from "../harness/process.ts";
import {
  cacheHitCount,
  cacheObservation,
  catalogLoads,
  externalFixture,
  objectScopeProbe,
  post,
  publish,
  seedSearch,
  wiringTemplates,
} from "../harness/wiring.ts";

test("B05: generated module, HTTP, queue, object and search connections return input-dependent results", async () => {
  await withApplication("wiring", wiringTemplates, async (app) => {
    expect(app.report.applicationComplete).toBe(false);
    expect(app.report.gaps.some((row) => row.status === "custom" && row.required)).toBe(true);
    // This unfinished mapping is honest: the harness seeds an explicitly mapped real index.
    expect(
      app.report.gaps.some((row) => row.id === "search-mappings" && row.status === "unfinished"),
    ).toBe(true);
    const internal = app.report.processes?.tiles.find((row) => row.tile === "internal-api");
    expect(internal?.exposure).toBe("internal");
    for (const path of ["/api/internal-api/healthz", "/api/internal-api/modules/transform"])
      expect((await app.request(path)).status).toBe(404);
    for (const value of ["amber-17", "violet-29"]) {
      expect(await post(app, "wiring-api", "forward", { value })).toEqual({
        status: 200,
        body: { received: value, result: `echo:${value.toUpperCase()}` },
      });
      expect(await post(app, "wiring-api", "internal-call", { value })).toEqual({
        status: 200,
        body: {
          received: value,
          result: `internal:${value.split("").reverse().join("")}`,
        },
      });
    }
    const fixture = await externalFixture(app);
    try {
      for (const value of ["partner-31", "partner-47"])
        expect(
          await post(app, "wiring-api", "external-call", { endpoint: fixture.endpoint, value }),
        ).toEqual({
          status: 200,
          body: { received: value, result: `external:${value.toUpperCase()}` },
        });
      expect(await fixture.requests()).toEqual(
        ["partner-31", "partner-47"].map((value) => ({
          event: "external-request",
          method: "POST",
          path: "/echo",
          body: { value },
        })),
      );
    } finally {
      await app.save("external-fixture.json", await fixture.requests());
    }

    const bytes = Buffer.from(Array.from({ length: 4099 }, (_, index) => (index * 37 + 11) % 256));
    const key = "known-bytes.bin";
    expect(
      await post(app, "wiring-api", "object-roundtrip", {
        key,
        base64: bytes.toString("base64"),
      }),
    ).toEqual({
      status: 200,
      body: {
        key,
        base64: bytes.toString("base64"),
        sha256: hash(bytes),
        bytes: bytes.length,
      },
    });
    app.record({
      objectInput: { key, bytes: bytes.length, sha256: hash(bytes) },
    });
    // These are real, valid application credentials, each permitted on a different private bucket.
    await objectScopeProbe(app, "app-internal-api", "objects", key);
    await objectScopeProbe(app, "app-wiring-api", "vault", "private-record");
    const vault = await inApplication(
      app,
      "app-internal-api",
      `
      import {S3Client,GetObjectCommand} from '@aws-sdk/client-s3';import {readFileSync} from 'node:fs';
      const client=new S3Client({endpoint:'http://local-objects:3900',region:'garage',forcePathStyle:true,maxAttempts:1,
        credentials:JSON.parse(readFileSync('/run/secrets/s3-internal-api','utf8')),
        requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
      try{const object=await client.send(new GetObjectCommand({Bucket:'vault',Key:'private-record'}),{abortSignal:AbortSignal.timeout(3000)});
      console.log(JSON.stringify({value:Buffer.from(await object.Body.transformToByteArray()).toString()}));}finally{client.destroy();}
    `,
    );
    app.record({ internalDurableInput: vault });
    expect(vault).toEqual({ value: "violet-29" });
    await seedSearch(app);
    for (const [q, hit] of [
      ["amber", { id: "amber", title: "Amber lighthouse", state: "published" }],
      ["violet", { id: "violet", title: "Violet harbor", state: "published" }],
    ] as const)
      expect(await app.request(`/api/wiring-api/modules/find-item?q=${q}`)).toEqual({
        status: 200,
        body: { q, hits: [hit] },
      });
    expect(await app.request("/api/wiring-api/modules/find-item?q=absent")).toEqual({
      status: 200,
      body: { q: "absent", hits: [] },
    });

    for (const queue of ["broadcasts--audit", "broadcasts--notify"])
      expect(await brokerProbe(app, "state", queue)).toMatchObject({
        consumerCount: 1,
        messageCount: 0,
        unacknowledged: 0,
      });
    const fanoutIds = ["broadcast:0", "broadcast:1", "broadcast:2"];
    for (const [index, id] of fanoutIds.entries())
      await publish(app, "broadcasts", id, `fanout-${index}`);
    for (const module of ["audit", "notify"]) {
      const rows = await poll(
        `${module} durably records every broadcast identity`,
        () =>
          app.sql(
            `SELECT message_id||'|'||value FROM m_${module}.effects ORDER BY message_id`,
            "d_fanout_db",
          ),
        (rows) => rows.split("\n").length === 3,
        30_000,
        (value) => app.record(value),
      );
      expect(rows.split("\n")).toEqual(fanoutIds.map((id, index) => `${id}|fanout-${index}`));
    }

    await app.compose(["up", "-d", "--no-deps", "--scale", "app-workers=2", "app-workers"]);
    const copies = await healthyCopies(app, "app-workers", 2);
    const hostnames = JSON.parse(
      await command("docker", ["inspect", ...copies.map((row) => row.Id)]),
    ) as { Id: string; Config: { Hostname: string } }[];
    const committed = (id: string) =>
      poll(
        `${id} work effect committed`,
        () =>
          app.sql(
            `SELECT message_id||'|'||value||'|'||worker FROM m_work.effects WHERE message_id='${id}'`,
            "d_work_db",
          ),
        (row) => row.startsWith(`${id}|`),
        30_000,
        (value) => app.record(value),
      );
    for (let index = 0; index < 2; index++) {
      const active = copies[index];
      const stopped = copies[1 - index];
      expect(active).toBeDefined();
      expect(stopped).toBeDefined();
      if (!active || !stopped) throw new Error("Two work consumers required");
      await controlContainer(app, "app-workers", stopped.Id, "stop");
      await poll(
        "one consumer on the distinct work queue",
        () => brokerProbe(app, "state", "jobs"),
        (row) => row !== null && "consumerCount" in row && row.consumerCount === 1,
        15_000,
      );
      const id = `work:solo-${index}`;
      await publish(app, "jobs", id, `solo-${index}`);
      expect(await committed(id)).toBe(
        `${id}|solo-${index}|${hostnames.find((row) => row.Id === active.Id)?.Config.Hostname}`,
      );
      await controlContainer(app, "app-workers", stopped.Id, "start");
      await healthyCopies(app, "app-workers", 2);
    }
    await poll(
      "two competing consumers on jobs",
      () => brokerProbe(app, "state", "jobs"),
      (row) => row !== null && "consumerCount" in row && row.consumerCount === 2,
      15_000,
    );
    const workIds = Array.from(
      { length: 20 },
      (_, index) => `work:burst-${String(index).padStart(2, "0")}`,
    );
    for (let offset = 0; offset < workIds.length; offset += 4)
      await Promise.all(
        workIds.slice(offset, offset + 4).map((id) => publish(app, "jobs", id, `value-${id}`)),
      );
    await poll(
      "all 22 work effects durable",
      () => app.sql("SELECT count(*) FROM m_work.effects", "d_work_db"),
      (value) => value === "22",
      30_000,
    );
    expect(
      (
        await app.sql(
          "SELECT message_id||'|'||value FROM m_work.effects WHERE message_id LIKE 'work:burst-%' ORDER BY message_id",
          "d_work_db",
        )
      ).split("\n"),
    ).toEqual(workIds.map((id) => `${id}|value-${id}`));
    const workers = (
      await app.sql("SELECT DISTINCT worker FROM m_work.effects ORDER BY worker", "d_work_db")
    ).split("\n");
    expect(workers).toEqual(hostnames.map((row) => row.Config.Hostname).sort());
    for (const queue of ["broadcasts--audit", "broadcasts--notify", "jobs"]) {
      await poll(
        `${queue} has no ready or unacknowledged delivery`,
        () => brokerProbe(app, "state", queue),
        (row) =>
          row !== null &&
          "consumerCount" in row &&
          row.messageCount === 0 &&
          row.unacknowledged === 0,
        15_000,
      );
      expect(await brokerProbe(app, "state", `${queue}.failed`)).toMatchObject({
        messageCount: 0,
        unacknowledged: 0,
      });
    }
  });
});

test("B06 normal: immutable published catalog fills, hits and expires in Valkey; absence remains uncached", async () => {
  await withApplication("wiring", wiringTemplates, async (app) => {
    const expected = {
      id: "published-a",
      title: "Immutable amber catalog",
      state: "published",
    };
    const read = (id: string) => app.request(`/api/catalog-api/modules/catalog-read/${id}`);
    const key = "catalog:published-a";
    expect(await catalogLoads(app, "published-a")).toBe(0);
    expect(await cacheObservation(app, key)).toMatchObject({
      value: null,
      pttl: -2,
    });
    expect(await read("published-a")).toEqual({ status: 200, body: expected });
    const filled = await cacheObservation(app, key);
    expect(JSON.parse(filled.value ?? "null")).toEqual(expected);
    expect(filled.pttl).toBeGreaterThan(2500);
    expect(filled.pttl).toBeLessThanOrEqual(4000);
    expect(await catalogLoads(app, "published-a")).toBe(1);
    const beforeHit = await cacheHitCount(app);
    expect(await read("published-a")).toEqual({ status: 200, body: expected });
    // INFO-only observations do not look up a key: exactly one hit belongs to the HTTP request.
    expect((await cacheHitCount(app)) - beforeHit).toBe(1);
    expect(await catalogLoads(app, "published-a")).toBe(1);
    const hit = await cacheObservation(app, key);
    expect(hit.pttl).toBeLessThan(filled.pttl);
    await poll(
      "four-second positive cache entry actually expires",
      () => cacheObservation(app, key),
      (value) => value.value === null && value.pttl === -2,
      7000,
    );
    expect(await read("published-a")).toEqual({ status: 200, body: expected });
    expect(JSON.parse((await cacheObservation(app, key)).value ?? "null")).toEqual(expected);
    expect(await catalogLoads(app, "published-a")).toBe(2);
    for (const id of ["missing-a", "draft-a"]) {
      for (let attempt = 0; attempt < 2; attempt++) {
        expect((await read(id)).status).toBe(404);
        expect(await cacheObservation(app, `catalog:${id}`)).toMatchObject({
          value: null,
          pttl: -2,
        });
      }
      expect(await catalogLoads(app, id)).toBe(2);
    }
    expect(
      await app.sql(
        "SELECT id||'|'||title||'|'||state FROM published.catalog ORDER BY id",
        "d_catalog",
      ),
    ).toBe("published-a|Immutable amber catalog|published");
    expect(await post(app, "catalog-api", "catalog-writer", {})).toEqual({
      status: 200,
      body: [expected],
    });
  });
});
