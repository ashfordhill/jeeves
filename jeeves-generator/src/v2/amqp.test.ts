import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { designSchema } from "@jeeves/spec";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";

// The emitted amqp.ts and delivery.ts on a fake amqplib, loaded as positive-cache.test.ts loads
// valkey.ts on its fake redis, with fake timers.
const source = (name: string) =>
  readFileSync(
    new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts.template`, import.meta.url),
    "utf8",
  );
const moduleUrl = (code: string) =>
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(code)).toString("base64")}`;
const fakeAmqplib = moduleUrl(
  "export default { connect: (options) => globalThis.__amqpFake.connect(options) };",
);
const { createPublisher, createConsumer } = await import(
  moduleUrl(
    source("amqp")
      .replace('from "amqplib"', `from "${fakeAmqplib}"`)
      .replace(
        'import { readSecret } from "./local.ts";',
        'const readSecret = () => { throw new Error("Unexpected secret read"); };',
      )
      .replaceAll('from "./delivery.ts"', `from "${moduleUrl(source("delivery"))}"`),
  )
);
const { brokerState, createFailureLog } = await import(moduleUrl(source("tile-process")));

type Event =
  | { publish: string; body: string; messageId: unknown }
  | { republish: string; body: string; headers: unknown }
  | { ack: string }
  | { prefetch: number; global: boolean }
  | { consume: string; noAck: boolean }
  | { cancel: string };
type Done = (error: Error | null) => void;
type Message = {
  content: Buffer;
  properties: { messageId: string; headers: Record<string, unknown> };
  fields: { redelivered: boolean };
};

/** A confirm channel: it records what the broker would see, and each publish's confirm is acked at
 * once, held, or nacked. A closed channel refuses everything, as amqplib's does. */
class FakeChannel extends EventEmitter {
  closed = false;
  confirm: "ack" | "hold" | "nack" = "ack";
  events: Event[] = [];
  private subscriber?: (message: Message | null) => void;
  private check() {
    if (this.closed) throw new Error("Channel closed");
  }
  private send(event: Event, done: Done) {
    this.events.push(event);
    this.check();
    if (this.confirm !== "hold") {
      const error = this.confirm === "nack" ? new Error("Message nacked") : null;
      void Promise.resolve().then(() => done(error));
    }
    return true;
  }
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: { messageId?: string },
    done: Done,
  ) {
    const to = exchange || routingKey;
    return this.send({ publish: to, body: content.toString(), messageId: options.messageId }, done);
  }
  sendToQueue(queue: string, content: Buffer, options: { headers?: unknown }, done: Done) {
    return this.send(
      { republish: queue, body: content.toString(), headers: options.headers },
      done,
    );
  }
  ack(message: Message) {
    this.events.push({ ack: message.content.toString() });
    this.check();
  }
  async prefetch(count: number, global: boolean) {
    this.check();
    this.events.push({ prefetch: count, global });
  }
  async consume(queue: string, subscriber: (message: Message | null) => void, options: object) {
    this.check();
    this.events.push({ consume: queue, ...(options as { noAck: boolean }) });
    this.subscriber = subscriber;
    return { consumerTag: `tag-${queue}` };
  }
  async cancel(consumerTag: string) {
    this.check();
    this.events.push({ cancel: consumerTag });
  }
  async close() {
    this.check();
    this.shut();
  }
  shut() {
    if (this.closed) return;
    this.closed = true;
    this.emit("close");
  }
  deliver(body: string) {
    this.subscriber?.({
      content: Buffer.from(body),
      properties: { messageId: body, headers: {} },
      fields: { redelivered: false },
    });
  }
  /** The broker cancels the subscription. */
  cancelled() {
    this.subscriber?.(null);
  }
}
class FakeConnection extends EventEmitter {
  closed = false;
  channels: FakeChannel[] = [];
  async createConfirmChannel() {
    if (this.closed) throw new Error("Connection closed");
    const channel = new FakeChannel();
    this.channels.push(channel);
    return channel;
  }
  async close() {
    if (this.closed) throw new Error("Connection closed");
    this.lose();
  }
  /** The broker goes away, as amqplib reports it: the connection's error, then its channels
   * close, then the connection closes with the error. */
  lose(error?: Error) {
    if (this.closed) return;
    this.closed = true;
    if (error) this.emit("error", error);
    for (const channel of this.channels) channel.shut();
    this.emit("close", error);
  }
}
/** The fake broker. Each connect takes the next of `connects` (one that rejects fails it, one that
 * waits holds it) and opens a connection when none is queued. */
function fakeBroker() {
  const state = {
    attempts: 0,
    maxOpen: 0,
    connections: [] as FakeConnection[],
    connects: [] as (() => Promise<void>)[],
  };
  vi.stubGlobal("__amqpFake", {
    async connect() {
      state.attempts += 1;
      await (state.connects.shift() ?? (() => Promise.resolve()))();
      const connection = new FakeConnection();
      state.connections.push(connection);
      const open = state.connections.filter((item) => !item.closed).length;
      state.maxOpen = Math.max(state.maxOpen, open);
      return connection;
    },
  });
  const connection = (index: number) => {
    const found = state.connections[index];
    if (!found) throw new Error(`No connection ${index}`);
    return found;
  };
  const channel = (index: number) => {
    const found = connection(index).channels[0];
    if (!found) throw new Error(`No channel on connection ${index}`);
    return found;
  };
  return { state, connection, channel };
}
const binding = {
  hostname: "local-broker",
  port: 5672,
  username: "runtime",
  passwordSecret: "broker-password",
  heartbeatSeconds: 10,
  confirmTimeoutMs: 5000,
  credential: () => "probe-password",
};
const topic = { exchange: "view-events", routingKey: "" };
const queue = "view-events--view-counter";
const bytes = (text: string) => new TextEncoder().encode(text);
const recorder = () => {
  const states: [string, unknown][] = [];
  return { states, onState: (state: string, error?: unknown) => states.push([state, error]) };
};
const names = (states: [string, unknown][]) => states.map(([state]) => state);
/** A handler that holds each "slow…" message until released and settles any other at once. */
function holding() {
  const releases: (() => void)[] = [];
  const handle = vi.fn(async (body: Buffer) => {
    if (body.toString().startsWith("slow"))
      await new Promise<void>((resolve) => releases.push(resolve));
  });
  return { handle, release: () => releases.shift()?.() };
}
const consumerOptions = (handle: (body: Buffer) => Promise<void>, more: object = {}) => ({
  queue,
  failedQueue: `${queue}.failed`,
  concurrency: 2,
  retryLimit: 3,
  handle,
  ...more,
});
const subscribed = [
  { prefetch: 2, global: false },
  { consume: queue, noAck: false },
];
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("emitted broker publisher reconnects", () => {
  it("reports a lost connection once, rejects publish at once and opens a new one every 5 s", async () => {
    const broker = fakeBroker();
    const { states, onState } = recorder();
    const publisher = await createPublisher(binding, topic, { onState });
    expect(states).toEqual([["available", undefined]]);
    let closed = false;
    void publisher.closed.then(() => {
      closed = true;
    });
    await publisher.publish(bytes("a"), "m1");
    const lost = new Error("Connection reset");
    broker.connection(0).lose(lost);
    expect(states).toEqual([
      ["available", undefined],
      ["unavailable", lost],
    ]);
    // At once: no timer runs before it rejects.
    await expect(publisher.publish(bytes("b"), "m2")).rejects.toThrow("Broker unavailable");
    await vi.advanceTimersByTimeAsync(4999);
    expect(broker.state.attempts).toBe(1);
    broker.state.connects.push(() => Promise.reject(new Error("connect ECONNREFUSED")));
    await vi.advanceTimersByTimeAsync(1);
    expect(broker.state.attempts).toBe(2);
    await vi.advanceTimersByTimeAsync(4999);
    expect(broker.state.attempts).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(broker.state.attempts).toBe(3);
    expect(states).toHaveLength(3);
    expect(states[2]).toEqual(["available", undefined]);
    await publisher.publish(bytes("c"), "m3");
    expect(broker.channel(1).events).toEqual([
      { publish: "view-events", body: "c", messageId: "m3" },
    ]);
    expect(closed).toBe(false);
    expect(broker.state.maxOpen).toBe(1);
    await publisher.close();
    await expect(publisher.closed).resolves.toEqual({ fatal: false });
    expect(broker.connection(1).closed).toBe(true);
  });

  it("rejects a publish waiting for its confirm when the channel closes, by the confirm deadline", async () => {
    const broker = fakeBroker();
    const { states, onState } = recorder();
    const publisher = await createPublisher(binding, topic, { onState });
    // A rejected confirm on an open channel rejects that publish only.
    broker.channel(0).confirm = "nack";
    await expect(publisher.publish(bytes("a"), "m1")).rejects.toThrow("Message nacked");
    broker.channel(0).confirm = "hold";
    let rejected: unknown;
    const waiting = publisher.publish(bytes("b"), "m2").catch((error: unknown) => {
      rejected = error;
    });
    expect(names(states)).toEqual(["available"]);
    broker.connection(0).lose(new Error("Connection reset"));
    await vi.advanceTimersByTimeAsync(binding.confirmTimeoutMs);
    await waiting;
    expect(rejected).toBeInstanceOf(Error);
    await publisher.close();
  });

  it("opens nothing after close() during an outage, and closes a connection still opening as soon as it opens", async () => {
    const broker = fakeBroker();
    const down = await createPublisher(binding, topic);
    broker.connection(0).lose();
    await down.close();
    await expect(down.closed).resolves.toEqual({ fatal: false });
    await vi.advanceTimersByTimeAsync(20000);
    expect(broker.state.attempts).toBe(1);
    await expect(down.publish(bytes("a"), "m1")).rejects.toThrow("AMQP publisher is draining");

    const { states, onState } = recorder();
    const opening = await createPublisher(binding, topic, { onState });
    broker.connection(1).lose();
    let connected!: () => void;
    broker.state.connects.push(
      () =>
        new Promise<void>((resolve) => {
          connected = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(broker.state.attempts).toBe(3);
    await opening.close();
    await expect(opening.closed).resolves.toEqual({ fatal: false });
    connected();
    await settle();
    expect(broker.state.connections).toHaveLength(3);
    expect(broker.connection(2).closed).toBe(true);
    await vi.advanceTimersByTimeAsync(20000);
    expect(broker.state.attempts).toBe(3);
    expect(names(states)).toEqual(["available", "unavailable"]);
  });
});

describe("emitted broker consumer reconnects", () => {
  it("drains the deliveries in hand without acknowledging, then reconnects after 5 s and the drain", async () => {
    const broker = fakeBroker();
    const { states, onState } = recorder();
    const { handle, release } = holding();
    const consumer = await createConsumer(binding, consumerOptions(handle, { onState }));
    expect(broker.channel(0).events).toEqual(subscribed);
    broker.channel(0).deliver("slow-1");
    await settle();
    expect(handle).toHaveBeenCalledTimes(1);
    const lost = new Error("Connection reset");
    broker.connection(0).lose(lost);
    expect(states).toEqual([
      ["available", undefined],
      ["unavailable", lost],
    ]);
    // The handler still holds its delivery at 10 s: no new connection.
    await vi.advanceTimersByTimeAsync(10000);
    expect(broker.state.attempts).toBe(1);
    release();
    await settle();
    expect(broker.state.attempts).toBe(2);
    expect(broker.channel(0).events).toEqual(subscribed);
    expect(broker.channel(1).events).toEqual(subscribed);
    expect(names(states)).toEqual(["available", "unavailable", "available"]);
    broker.channel(1).deliver("fast-1");
    await settle();
    expect(broker.channel(1).events.at(-1)).toEqual({ ack: "fast-1" });
    // The drain over before 5 s: the next connection opens at 5 s, not before.
    broker.channel(1).deliver("slow-2");
    await settle();
    broker.connection(1).lose(new Error("Connection reset"));
    await vi.advanceTimersByTimeAsync(1000);
    release();
    await vi.advanceTimersByTimeAsync(3999);
    expect(broker.state.attempts).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(broker.state.attempts).toBe(3);
    expect(broker.channel(1).events.filter((event) => "ack" in event)).toEqual([{ ack: "fast-1" }]);
    expect(broker.state.maxOpen).toBe(1);
    await consumer.close();
  });

  it("treats a cancelled subscription as a loss and closes the old connection", async () => {
    const broker = fakeBroker();
    const { states, onState } = recorder();
    const consumer = await createConsumer(
      binding,
      consumerOptions(async () => {}, { onState }),
    );
    broker.channel(0).cancelled();
    expect(names(states)).toEqual(["available", "unavailable"]);
    expect(states[1]?.[1]).toEqual(new Error("AMQP subscription cancelled"));
    await settle();
    expect(broker.connection(0).closed).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(broker.state.attempts).toBe(2);
    expect(broker.channel(1).events).toEqual(subscribed);
    expect(names(states)).toEqual(["available", "unavailable", "available"]);
    await consumer.close();
  });

  it("ends a generation whose republish fails without an ack, reconnects, and never calls onFatal", async () => {
    const broker = fakeBroker();
    const { states, onState } = recorder();
    const onFatal = vi.fn();
    const consumer = await createConsumer(
      binding,
      consumerOptions(
        async () => {
          throw new Error("boom");
        },
        { onState, onFatal },
      ),
    );
    broker.channel(0).confirm = "nack";
    broker.channel(0).deliver("m1");
    await settle();
    expect(broker.channel(0).events.slice(2)).toEqual([
      { republish: queue, body: "m1", headers: { "x-delivery-attempt": 1 } },
      { cancel: `tag-${queue}` },
    ]);
    expect(broker.connection(0).closed).toBe(true);
    expect(names(states)).toEqual(["available", "unavailable"]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(broker.state.attempts).toBe(2);
    expect(broker.channel(1).events).toEqual(subscribed);
    expect(names(states)).toEqual(["available", "unavailable", "available"]);
    expect(onFatal).not.toHaveBeenCalled();
    await consumer.close();
  });

  it("closes as before when running, and opens nothing after close() during an outage", async () => {
    const broker = fakeBroker();
    const { handle, release } = holding();
    const running = await createConsumer(binding, consumerOptions(handle));
    broker.channel(0).deliver("slow-1");
    await settle();
    let stopped = false;
    const stopping = running.close().then(() => {
      stopped = true;
    });
    await settle();
    expect(broker.channel(0).events.at(-1)).toEqual({ cancel: `tag-${queue}` });
    expect(stopped).toBe(false);
    expect(broker.connection(0).closed).toBe(false);
    release();
    await stopping;
    expect(broker.channel(0).events.slice(-2)).toEqual([
      { cancel: `tag-${queue}` },
      { ack: "slow-1" },
    ]);
    expect(broker.connection(0).closed).toBe(true);
    await expect(running.closed).resolves.toEqual({ fatal: false });

    // During an outage, close() waits for the lost generation's drain and opens nothing.
    const down = await createConsumer(binding, consumerOptions(handle));
    broker.channel(1).deliver("slow-2");
    await settle();
    broker.connection(1).lose(new Error("Connection reset"));
    let downed = false;
    const closing = down.close().then(() => {
      downed = true;
    });
    await settle();
    expect(downed).toBe(false);
    release();
    await closing;
    await expect(down.closed).resolves.toEqual({ fatal: false });
    await vi.advanceTimersByTimeAsync(20000);
    expect(broker.state.attempts).toBe(2);
  });

  it("keeps publishing and reconnecting when onState throws", async () => {
    const broker = fakeBroker();
    const onState = vi.fn((_state: string, _error?: unknown) => {
      throw new Error("Log unavailable");
    });
    const publisher = await createPublisher(binding, topic, { onState });
    await publisher.publish(bytes("a"), "m1");
    expect(() => broker.connection(0).lose(new Error("Connection reset"))).not.toThrow();
    await vi.advanceTimersByTimeAsync(5000);
    await publisher.publish(bytes("b"), "m2");
    expect(broker.channel(1).events).toEqual([
      { publish: "view-events", body: "b", messageId: "m2" },
    ]);
    expect(onState.mock.calls.map(([state]) => state)).toEqual([
      "available",
      "unavailable",
      "available",
    ]);
    const consumer = await createConsumer(
      binding,
      consumerOptions(async () => {}, { onState }),
    );
    expect(() => broker.connection(2).lose(new Error("Connection reset"))).not.toThrow();
    await vi.advanceTimersByTimeAsync(5000);
    broker.channel(3).deliver("m3");
    await settle();
    expect(broker.channel(3).events.at(-1)).toEqual({ ack: "m3" });
    await Promise.all([publisher.close(), consumer.close()]);
  });

  it("still fails startup on a first connect that fails, and leaves no timer", async () => {
    const broker = fakeBroker();
    const { states, onState } = recorder();
    broker.state.connects.push(() => Promise.reject(new Error("connect ECONNREFUSED")));
    await expect(createPublisher(binding, topic, { onState })).rejects.toThrow("ECONNREFUSED");
    broker.state.connects.push(() => Promise.reject(new Error("connect ECONNREFUSED")));
    await expect(
      createConsumer(
        binding,
        consumerOptions(async () => {}, { onState }),
      ),
    ).rejects.toThrow("ECONNREFUSED");
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(20000);
    expect(broker.state.attempts).toBe(2);
    expect(states).toEqual([]);
  });
});

describe("emitted broker state line", () => {
  it("logs one failure line when the broker is lost and one info line when it is back", () => {
    vi.useRealTimers();
    const lines: unknown[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((line: string) => {
      lines.push(JSON.parse(line));
    });
    try {
      const onState = brokerState(
        "watch-api",
        createFailureLog("watch-api"),
        "broker publish view-events",
      );
      onState("unavailable", new Error("Connection reset"));
      onState("available");
      expect(lines).toEqual([
        {
          level: "error",
          event: "failure",
          tile: "watch-api",
          what: "broker publish view-events",
          error: "Error: Connection reset",
        },
        {
          level: "info",
          event: "broker",
          tile: "watch-api",
          what: "broker publish view-events",
          state: "available",
        },
      ]);
    } finally {
      log.mockRestore();
    }
  });
});

describe("emitted broker wiring", () => {
  it("gives every broker publisher and consumer of the YouTube v3 export one state hook", () => {
    const design = designSchema.parse(
      JSON.parse(
        readFileSync(
          new URL("../../../field-projects/youtube/v3/inputs/design.json", import.meta.url),
          "utf8",
        ),
      ),
    );
    const bundle = assembleV2({ designJson: JSON.stringify(design) }, loadLocalV2Registry());
    /** Each call of `name` in `code`, from its name to its closing parenthesis. */
    const calls = (code: string, name: string) =>
      [...code.matchAll(new RegExp(`\\b${name}\\(`, "g"))].map((match) => {
        let depth = 0;
        let end = match.index + name.length;
        for (; end < code.length; end++) {
          if (code[end] === "(") depth++;
          else if (code[end] === ")" && --depth === 0) break;
        }
        return code.slice(match.index, end + 1);
      });
    const clients = ["loopConsumer", "startModuleLoop", "publisher", "consumer", "queuePublisher"];
    const counts: Record<string, number> = {};
    for (const file of bundle.files) {
      if (!file.path.startsWith("src/processes/")) continue;
      const code = new TextDecoder().decode(file.bytes);
      const opened = clients.flatMap((name) => calls(code, name));
      for (const call of opened) {
        expect(call.match(/brokerState\(/g)).toHaveLength(1);
        expect(call).not.toContain("onFatal");
      }
      expect(code.match(/brokerState\(/g)?.length ?? 0).toBe(opened.length);
      counts[file.path.slice("src/processes/".length)] = opened.length;
    }
    expect(counts).toEqual({
      "account-api.ts": 0,
      "search-api.ts": 0,
      "search-indexer.ts": 1,
      "transcoder.ts": 2,
      "upload-api.ts": 1,
      "video-lifecycle.ts": 2,
      "view-counter.ts": 1,
      "watch-api.ts": 1,
    });
    // The media worker keeps its own onFatal and hooks; its consumer gets the state hook beside them.
    const transcoder = new TextDecoder().decode(
      bundle.files.find((file) => file.path === "src/processes/transcoder.ts")?.bytes,
    );
    expect(transcoder).toContain(
      '{ ...consumerHooks, onState: brokerState(config.tile, failure, "broker consume upload-jobs") }',
    );
    expect(transcoder.match(/onFatal: scope\.fail,/g)).toHaveLength(1);
  });
});
