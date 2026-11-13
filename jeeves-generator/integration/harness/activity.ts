import assert from "node:assert/strict";
import type { Application } from "./application.ts";
import { command, poll } from "./process.ts";

export const activityTemplates = ["module-stub", "event-counter", "module-stub"];
// The installed counter uses a topic with one subscriber queue. Copies compete on that queue.
export const counterQueue = "events--counter";
export const readTotal = (app: Application, aggregateKey: string) =>
  app.request(`/api/totals-api/modules/read-total?aggregate=${encodeURIComponent(aggregateKey)}`);
export const submit = (app: Application, aggregateKey: string, eventId: string) =>
  app.request("/api/activity-api/modules/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ aggregateKey, eventId }),
  });

export async function totalBecomes(app: Application, aggregateKey: string, total: number) {
  return poll(
    `${aggregateKey} committed total becomes ${total}`,
    () => readTotal(app, aggregateKey),
    (value) => value.status === 200 && (value.body as { total?: string }).total === String(total),
    30_000,
    (value) => app.record(value),
  );
}

export async function receiptIds(app: Application, aggregateKey: string) {
  assert(/^[A-Za-z0-9:_-]+$/.test(aggregateKey));
  const value = await app.sql(
    `SELECT event_id||'|'||coalesce(result->>'value','MISSING') FROM increment.receipts WHERE scope_key='${aggregateKey}' ORDER BY event_id`,
  );
  return value
    ? value.split("\n").map((row) => {
        assert(row.endsWith("|true"), `Invalid receipt result: ${row}`);
        return row.slice(0, -5);
      })
    : [];
}

type Container = {
  Id: string;
  State: { Status: string; Health?: { Status: string } };
  Config: { Labels: Record<string, string> };
  NetworkSettings: { Networks: Record<string, { IPAddress: string }> };
};
export async function serviceContainers(app: Application, service: string) {
  const ids = await app.containers(service);
  const rows: Container[] = ids.length
    ? JSON.parse(await command("docker", ["inspect", ...ids]))
    : [];
  for (const row of rows) {
    assert.equal(row.Config.Labels["com.docker.compose.project"], app.stack.project);
    assert.equal(row.Config.Labels["com.docker.compose.service"], service);
  }
  return rows;
}

export async function healthyCopies(app: Application, service: string, count: number) {
  const result = await poll(
    `${service} has ${count} healthy copies`,
    async () => {
      const rows = await serviceContainers(app, service);
      app.record({
        condition: "healthy copies",
        service,
        containers: rows.map((row) => ({ id: row.Id, state: row.State })),
      });
      return rows;
    },
    (rows) =>
      rows.length === count &&
      rows.every((row) => row.State.Status === "running" && row.State.Health?.Status === "healthy"),
    60_000,
  );
  return result;
}

export async function controlContainer(
  app: Application,
  service: string,
  id: string,
  action: "start" | "stop",
) {
  assert(
    (await serviceContainers(app, service)).some((row) => row.Id === id),
    "Foreign container refused",
  );
  const result = await command(
    "docker",
    [action, ...(action === "stop" ? ["--time", "20"] : []), id],
    { timeoutMs: 30_000 },
  );
  app.record({
    boundary: `${service} ${action}`,
    at: new Date().toISOString(),
    container: id,
    result: result.trim(),
  });
}

/** Independent provider observations/injection; no generated runtime function is imported. */
export async function inApplication<T>(
  app: Application,
  service: string,
  script: string,
): Promise<T> {
  const [container] = await serviceContainers(app, service);
  assert(container?.State.Status === "running", `${service} is not running`);
  const output = await command(
    "docker",
    ["exec", "-i", container.Id, "node", "--input-type=module"],
    {
      input: script,
      timeoutMs: 15_000,
    },
  );
  return JSON.parse(output) as T;
}

export type QueueState = {
  queue: string;
  messageCount: number;
  unacknowledged: number;
  consumerCount: number;
};
export async function brokerProbe(
  app: Application,
  action: "state" | "malformed" | "failed",
  queue = counterQueue,
) {
  assert(/^[a-z0-9.-]+$/.test(queue));
  if (action === "state") {
    const [container] = await serviceContainers(app, "local-broker");
    assert(container, "Broker missing");
    const rows = JSON.parse(
      await command(
        "docker",
        [
          "exec",
          container.Id,
          "rabbitmqctl",
          "-q",
          "list_queues",
          "name",
          "messages_ready",
          "messages_unacknowledged",
          "consumers",
          "--formatter=json",
        ],
        { timeoutMs: 15_000 },
      ),
    ) as {
      name: string;
      messages_ready: number;
      messages_unacknowledged: number;
      consumers: number;
    }[];
    const row = rows.find((row) => row.name === queue);
    assert(row, `Missing queue ${queue}`);
    const result = {
      queue,
      messageCount: row.messages_ready,
      unacknowledged: row.messages_unacknowledged,
      consumerCount: row.consumers,
    };
    app.record({ broker: action, queue, result });
    return result;
  }
  const result = await inApplication<
    QueueState | { messageId?: string; body: string; headers: Record<string, unknown> } | null
  >(
    app,
    "app-activity-api",
    `
    import amqp from 'amqplib';
    import { readFileSync } from 'node:fs';
    const connection = await amqp.connect({hostname:'local-broker', username:'runtime',
      password:readFileSync('/run/secrets/broker-password','utf8').trim(), heartbeat:10});
    const channel = await connection.createConfirmChannel();
    try {
      let result;
      if (${JSON.stringify(action)} === 'malformed') {
        channel.sendToQueue(${JSON.stringify(queue)}, Buffer.from('{"aggregateKey":'),
          {persistent:true,messageId:'malformed:one',contentType:'application/json'});
        await channel.waitForConfirms(); result={confirmed:true};
      } else if (${JSON.stringify(action)} === 'failed') {
        const message=await channel.get(${JSON.stringify(queue)}, {noAck:false});
        result=message ? {messageId:message.properties.messageId,body:message.content.toString(),headers:message.properties.headers} : null;
        if (message) channel.ack(message);
      }
      console.log(JSON.stringify(result));
    } finally { await channel.close(); await connection.close(); }
  `,
  );
  app.record({ broker: action, queue, result });
  return result;
}

export async function queueBecomes(app: Application, consumers: number, messages?: number) {
  return poll(
    `${counterQueue} has ${consumers} consumers${messages === undefined ? "" : ` and ${messages} queued messages`}`,
    () => brokerProbe(app, "state"),
    (value) =>
      value !== null &&
      "consumerCount" in value &&
      value.consumerCount === consumers &&
      (messages === undefined || (value.messageCount === messages && value.unacknowledged === 0)),
    30_000,
    (value) => app.record(value),
  );
}
