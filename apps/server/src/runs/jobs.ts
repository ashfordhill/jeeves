/**
 * Background jobs for runs (PLAN §10: "each step executes as a pg-boss job"). `pgBossJobs` is the
 * real queue, in Jeeves's Postgres; `localJobs` runs handlers in-process for API tests that don't
 * need a durable queue.
 */
import { type ConstructorOptions, PgBoss } from "pg-boss";

export type JobHandler = (data: { runId: number }) => Promise<void>;

export interface JobQueue {
  /** Creates the queue if needed and starts handling its jobs. */
  work(name: string, handler: JobHandler): Promise<void>;
  send(name: string, data: { runId: number }): Promise<void>;
  /** `graceful: false` drops jobs in progress (tests use it to simulate a crash). */
  stop(options?: { graceful?: boolean }): Promise<void>;
}

/** A run step may run a coding agent for a long time (S12). pg-boss fails jobs past this. */
const EXPIRE_SECONDS = 6 * 60 * 60;

/**
 * pg-boss on the given connection options (`connectionString`, or `db` for an adapter such as
 * PGlite in tests). Jobs aren't retried: a failed step is recorded on the run instead, and a
 * restart is handled by `recoverRuns`.
 */
export async function pgBossJobs(
  options: ConstructorOptions,
  onError: (error: Error) => void = () => {},
): Promise<JobQueue> {
  const boss = new PgBoss(options);
  boss.on("error", onError);
  await boss.start();
  return {
    async work(name, handler) {
      await boss.createQueue(name, { retryLimit: 0, expireInSeconds: EXPIRE_SECONDS });
      await boss.work<{ runId: number }>(
        name,
        { pollingIntervalSeconds: 0.5, localConcurrency: 4 },
        async (jobs) => {
          for (const job of jobs) await handler(job.data);
        },
      );
    },
    async send(name, data) {
      await boss.send(name, data);
    },
    stop: ({ graceful = true } = {}) => boss.stop({ graceful, timeout: 5_000 }),
  };
}

export type LocalJobs = JobQueue & {
  /** Resolves when no job is queued or running. */
  idle(): Promise<void>;
};

/** In-process queue: each job runs on the next tick. Not durable. */
export function localJobs(): LocalJobs {
  const handlers = new Map<string, JobHandler>();
  const running = new Set<Promise<void>>();
  return {
    async work(name, handler) {
      handlers.set(name, handler);
    },
    async send(name, data) {
      const handler = handlers.get(name);
      if (!handler) throw new Error(`No worker for job queue "${name}".`);
      const job = new Promise<void>((resolve) => setImmediate(resolve))
        .then(() => handler(data))
        .catch(() => {})
        .finally(() => running.delete(job));
      running.add(job);
    },
    async stop() {
      handlers.clear();
    },
    async idle() {
      while (running.size > 0) await Promise.all([...running]);
    },
  };
}
