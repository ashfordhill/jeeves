import assert from "node:assert/strict";
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { inApplication, serviceContainers } from "./activity.ts";
import type { Application } from "./application.ts";
import { command, poll } from "./process.ts";

/** Real process/network controls on one discovered container of this stack only. */
export type FaultAction = "stop" | "start" | "kill" | "pause" | "unpause";
export async function faultContainer(
  app: Application,
  service: string,
  id: string,
  action: FaultAction,
) {
  assert(
    (await serviceContainers(app, service)).some((row) => row.Id === id),
    "Foreign container refused",
  );
  const at = new Date().toISOString();
  const started = Date.now();
  const result = await command(
    "docker",
    action === "stop" ? ["stop", "--time", "20", id] : [action, id],
    { timeoutMs: 60_000 },
  );
  const boundary = {
    fault: `${service} ${action}`,
    container: id,
    at,
    elapsedMs: Date.now() - started,
    result: result.trim(),
  };
  app.record(boundary);
  return boundary;
}

export async function onlyContainer(app: Application, service: string) {
  const rows = await serviceContainers(app, service);
  assert.equal(rows.length, 1, `${service} must run exactly one copy for a precise fault`);
  const [row] = rows;
  assert(row);
  return row;
}

type Inspected = {
  Id: string;
  RestartCount: number;
  State: {
    Status: string;
    Running: boolean;
    ExitCode: number;
    StartedAt: string;
    FinishedAt: string;
    OOMKilled: boolean;
    Health?: { Status: string };
  };
  Config: { Labels: Record<string, string> };
  NetworkSettings: { Networks: Record<string, { IPAddress: string }> };
};
export type ProcessState = {
  service: string;
  id: string;
  status: string;
  health?: string;
  restarts: number;
  startedAt: string;
  exitCode: number;
  addresses: string[];
};
/** Every application container of this exact project, with its restart identity. */
export async function processStates(app: Application): Promise<ProcessState[]> {
  const ids = (await app.compose(["ps", "-aq"])).trim().split(/\s+/).filter(Boolean);
  const rows: Inspected[] = ids.length
    ? JSON.parse(await command("docker", ["inspect", ...ids]))
    : [];
  return rows
    .filter((row) => {
      assert.equal(row.Config.Labels["com.docker.compose.project"], app.stack.project);
      return row.Config.Labels["com.docker.compose.service"]?.startsWith("app-");
    })
    .map((row) => ({
      service: row.Config.Labels["com.docker.compose.service"] as string,
      id: row.Id,
      status: row.State.Status,
      health: row.State.Health?.Status,
      restarts: row.RestartCount,
      startedAt: row.State.StartedAt,
      exitCode: row.State.ExitCode,
      addresses: Object.values(row.NetworkSettings.Networks).map((network) => network.IPAddress),
    }))
    .sort((a, b) => a.service.localeCompare(b.service) || a.id.localeCompare(b.id));
}
/** After a broker fault no running application process may have exited, restarted or been
 * replaced. Only containers running in `before` are judged; a precondition stop is not. */
export async function assertNoProcessExited(
  app: Application,
  before: ProcessState[],
  label: string,
) {
  const running = before.filter((row) => row.status === "running");
  const services = new Set(running.map((row) => row.service));
  const after = (await processStates(app)).filter((row) => services.has(row.service));
  app.record({ processContinuity: label, running, after });
  assert(running.length > 0, `${label}: no running process to judge`);
  assert.deepEqual(
    after.map((row) => [row.service, row.id, row.startedAt]),
    running.map((row) => [row.service, row.id, row.startedAt]),
    `${label}: an application container was replaced or restarted`,
  );
  for (const row of after) {
    assert.equal(row.status, "running", `${label}: ${row.service} exited`);
    assert.equal(row.restarts, 0, `${label}: ${row.service} restarted`);
  }
  return after;
}

/** Raw output (including non-JSON crash text) of each container of a service since a boundary. */
export async function rawLogsSince(app: Application, service: string, since: string) {
  const result: Record<string, string> = {};
  for (const row of await serviceContainers(app, service))
    result[row.Id] = await command("docker", ["logs", "--timestamps", "--since", since, row.Id], {
      timeoutMs: 15_000,
    });
  return result;
}

export type LogLine = {
  service: string;
  container: string;
  at: string;
  entry: Record<string, unknown>;
};
/** JSON log lines each container of a service wrote since a recorded boundary. */
export async function logsSince(app: Application, service: string, since: string) {
  const lines: LogLine[] = [];
  for (const row of await serviceContainers(app, service)) {
    const text = await command("docker", ["logs", "--timestamps", "--since", since, row.Id], {
      timeoutMs: 15_000,
    });
    for (const raw of text.split("\n")) {
      const space = raw.indexOf(" ");
      const brace = raw.indexOf("{", space);
      if (space < 0 || brace < 0) continue;
      try {
        lines.push({
          service,
          container: row.Id,
          at: raw.slice(0, space),
          entry: JSON.parse(raw.slice(brace)),
        });
      } catch {
        /* Not a JSON line. */
      }
    }
  }
  return lines;
}

/** Docker log timestamps are RFC 3339 with nanoseconds; compare them as instants. */
export function after(a: string, b: string) {
  const [left, right] = [Date.parse(a), Date.parse(b)];
  return left === right ? a.localeCompare(b) > 0 : left > right;
}

export type BrokerClient = { service: string; what: string };
/** Each copy of each broker client logs one `broker` failure line after the boundary, and
 * (when `recovered`) a later `"state":"available"` line for the same `what`. */
export async function brokerSignals(
  app: Application,
  clients: BrokerClient[],
  since: string,
  recovered: boolean,
  timeoutMs: number,
) {
  return poll(
    `${clients.length} broker clients logged ${recovered ? "failure then available" : "failure"}`,
    async () => {
      const rows = [];
      for (const client of clients) {
        const lines = await logsSince(app, client.service, since);
        for (const container of await serviceContainers(app, client.service)) {
          const own = lines.filter((line) => line.container === container.Id);
          const failure = own.find(
            (line) => line.entry.event === "failure" && line.entry.what === client.what,
          );
          const available = own.find(
            (line) =>
              line.entry.event === "broker" &&
              line.entry.what === client.what &&
              line.entry.state === "available" &&
              failure !== undefined &&
              after(line.at, failure.at),
          );
          rows.push({ ...client, container: container.Id, failure, available });
        }
      }
      return rows;
    },
    (rows) =>
      rows.length >= clients.length &&
      rows.every(
        (row) =>
          row.failure !== undefined &&
          String(row.failure.entry.what).startsWith("broker ") &&
          (!recovered || row.available !== undefined),
      ),
    timeoutMs,
    (value) => app.record(value),
  );
}

/** A long-lived administrative psql session, used only to hold locks, gate or observe. */
export class SqlSession {
  private output = "";
  private exitCode: number | null | undefined;
  private readonly exited: Promise<void>;
  private constructor(
    readonly app: Application,
    readonly label: string,
    private readonly child: ChildProcessWithoutNullStreams,
  ) {
    const collect = (chunk: Buffer) => {
      this.output += chunk.toString();
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    this.exited = new Promise((done) => {
      child.once("close", (code) => {
        this.exitCode = code;
        done();
      });
      child.once("error", () => {
        this.exitCode = -1;
        done();
      });
    });
  }
  static async open(app: Application, database: string, label: string) {
    assert(/^[a-z][a-z0-9_]*$/.test(database));
    const postgres = await onlyContainer(app, "local-postgres");
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
        postgres.Id,
        "psql",
        "-U",
        "postgres",
        "-d",
        database,
        "-X",
        "-q",
        "-A",
        "-t",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const session = new SqlSession(app, label, child);
    assert.equal(await session.run("SELECT 1;"), "1");
    return session;
  }
  /** Runs statements in this session and returns their output; bounded, never retried. */
  async run(sql: string, timeoutMs = 10_000): Promise<string> {
    assert(this.exitCode === undefined, `${this.label} session ended: ${this.output}`);
    const marker = `gs-session-${randomUUID()}`;
    const start = this.output.length;
    this.child.stdin.write(`${sql}\n\\echo ${marker}\n`);
    const deadline = Date.now() + timeoutMs;
    while (!this.output.includes(marker, start)) {
      if (this.exitCode !== undefined)
        throw new Error(`${this.label} session ended: ${this.output.slice(start)}`);
      if (Date.now() > deadline)
        throw new Error(`${this.label} statement deadline: ${this.output.slice(start)}`);
      await new Promise((done) => setTimeout(done, 10));
    }
    const result = this.output.slice(start, this.output.indexOf(marker, start)).trim();
    this.app.record({ session: this.label, sql, result, at: new Date().toISOString() });
    return result;
  }
  async json<T>(select: string): Promise<T> {
    return JSON.parse(await this.run(`SELECT coalesce(json_agg(a), '[]') FROM (${select}) a;`));
  }
  async close() {
    if (this.exitCode !== undefined) return;
    this.child.stdin.end();
    const closed = await Promise.race([
      this.exited.then(() => true),
      new Promise<boolean>((done) => setTimeout(() => done(false), 10_000)),
    ]);
    if (!closed) this.child.kill("SIGKILL");
    this.app.record({ session: this.label, closed: true, exitCode: this.exitCode });
  }
}

/** Fast passive declaration through the application's broker login: ready count and consumers. */
export async function queueDepth(app: Application, service: string, queue: string) {
  assert(/^[a-z0-9.-]+$/.test(queue));
  const result = await inApplication<{
    queue: string;
    messageCount: number;
    consumerCount: number;
  }>(
    app,
    service,
    `
    import amqp from 'amqplib'; import {readFileSync} from 'node:fs';
    const connection=await amqp.connect({hostname:'local-broker',username:'runtime',
      password:readFileSync('/run/secrets/broker-password','utf8').trim(),heartbeat:10});
    const channel=await connection.createChannel();
    try {console.log(JSON.stringify(await channel.checkQueue(${JSON.stringify(queue)})));}
    finally {await channel.close();await connection.close();}
  `,
  );
  app.record({ queueDepth: { service, queue, result, at: new Date().toISOString() } });
  return result;
}

/** The process table of one identified container, as `docker top` reports it. */
export async function processTable(app: Application, service: string, id: string) {
  assert(
    (await serviceContainers(app, service)).some((row) => row.Id === id),
    "Foreign container refused",
  );
  const lines = (await command("docker", ["top", id], { timeoutMs: 10_000 }))
    .trim()
    .split("\n")
    .slice(1);
  return lines;
}

/** Wait for an instant without claiming anything happened; callers assert what follows. */
export async function until(instant: number) {
  const delay = instant - Date.now();
  if (delay > 0) await new Promise((done) => setTimeout(done, delay));
}
