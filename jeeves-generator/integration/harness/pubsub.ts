import assert from "node:assert/strict";
import { inApplication } from "./activity.ts";
import type { Application } from "./application.ts";
import { faultContainer, onlyContainer } from "./faults.ts";

/** A Pub/Sub topic or subscription ID as the emulator takes it (QG07's rule). */
function pubsubId(value: string) {
  assert(
    /^[A-Za-z][A-Za-z0-9._~+%-]{2,254}$/.test(value) && !value.startsWith("goog"),
    `Invalid Pub/Sub name ${value}`,
  );
  return value;
}

export type PulledMessage = {
  /** The emulator's message ID. */
  id: string;
  data: string;
  attributes: Record<string, string>;
  deliveryAttempt?: number;
  publishTime: string;
};

/**
 * One request to this stack's own emulator through its REST API, from inside `service`'s running
 * container: the emulator has no published port (QG07), and the address and project are the ones
 * that container's own environment names (`PUBSUB_EMULATOR_HOST`, `JEEVES_PUBSUB_PROJECT`).
 * Harness observation and setup only; no generated runtime function or client is used. In the
 * body, `{project}` stands for that project.
 */
async function emulatorCall<T>(
  app: Application,
  service: string,
  method: "GET" | "PUT" | "POST",
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  assert(/^\/(?:topics|subscriptions)\/[A-Za-z0-9._~+%-]+(?::[a-z]+)?$/.test(path), path);
  return inApplication(
    app,
    service,
    `
    const host=process.env.PUBSUB_EMULATOR_HOST, project=process.env.JEEVES_PUBSUB_PROJECT;
    if (!host || !project) throw new Error('No local Pub/Sub environment');
    const body=${body === undefined ? "undefined" : JSON.stringify(JSON.stringify(body))};
    const response=await fetch('http://'+host+'/v1/projects/'+project+${JSON.stringify(path)},{
      method:${JSON.stringify(method)},headers:{'content-type':'application/json'},
      body:body?.replaceAll('{project}',project),signal:AbortSignal.timeout(5000)});
    const text=await response.text();
    console.log(JSON.stringify({status:response.status,body:text?JSON.parse(text):null}));
  `,
  );
}

/** A harness-owned pull subscription on a topic, in this stack's emulator only. It holds every
 * message published to the topic after it exists, beside the application's own subscriptions. */
export async function createCapture(
  app: Application,
  service: string,
  subscription: string,
  topic: string,
) {
  const result = await emulatorCall(
    app,
    service,
    "PUT",
    `/subscriptions/${pubsubId(subscription)}`,
    { topic: `projects/{project}/topics/${pubsubId(topic)}`, ackDeadlineSeconds: 60 },
  );
  app.record({ pubsubCapture: { subscription, topic, result, at: new Date().toISOString() } });
  assert.equal(result.status, 200, `Capture subscription not created: ${JSON.stringify(result)}`);
  return result.body;
}

/** What a subscription hands over now, acknowledged so that the next pull sees only new messages.
 * It removes them from that subscription only. */
export async function pullNow(
  app: Application,
  service: string,
  subscription: string,
): Promise<PulledMessage[]> {
  type Received = {
    ackId: string;
    deliveryAttempt?: number;
    message: {
      messageId: string;
      data?: string;
      attributes?: Record<string, string>;
      publishTime: string;
    };
  };
  const path = `/subscriptions/${pubsubId(subscription)}`;
  const pulled = await emulatorCall<{ receivedMessages?: Received[] }>(
    app,
    service,
    "POST",
    `${path}:pull`,
    { maxMessages: 1000, returnImmediately: true },
  );
  assert.equal(pulled.status, 200, `Pull failed: ${JSON.stringify(pulled)}`);
  const received = pulled.body.receivedMessages ?? [];
  if (received.length) {
    const acked = await emulatorCall(app, service, "POST", `${path}:acknowledge`, {
      ackIds: received.map((row) => row.ackId),
    });
    assert.equal(acked.status, 200, `Acknowledge failed: ${JSON.stringify(acked)}`);
  }
  const messages = received.map((row) => ({
    id: row.message.messageId,
    data: Buffer.from(row.message.data ?? "", "base64").toString(),
    attributes: row.message.attributes ?? {},
    ...(row.deliveryAttempt !== undefined && { deliveryAttempt: row.deliveryAttempt }),
    publishTime: row.message.publishTime,
  }));
  app.record({ pubsubPull: { subscription, messages, at: new Date().toISOString() } });
  return messages;
}

/** Everything pulled from one subscription so far, in order: a poll adds what each pull hands
 * over, so a message pulled once is never lost to a later observation. */
export class Pulled {
  readonly messages: PulledMessage[] = [];
  constructor(
    readonly app: Application,
    readonly service: string,
    readonly subscription: string,
  ) {}
  async pull() {
    this.messages.push(...(await pullNow(this.app, this.service, this.subscription)));
    return this.messages;
  }
  /** The `messageId` attribute of each message pulled, sorted. */
  ids() {
    return this.messages.map((message) => message.attributes.messageId ?? "").sort();
  }
}

/** The emulator of this exact project (`local-pubsub`), frozen or resumed by `docker pause` and
 * `unpause` on the one container its labels name. */
export async function emulatorFault(app: Application, action: "pause" | "unpause") {
  const emulator = await onlyContainer(app, "local-pubsub");
  return faultContainer(app, "local-pubsub", emulator.Id, action);
}
