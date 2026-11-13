import { EventEmitter } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { type AppDeps, buildApp } from "./app.ts";
import { type Clock, type CodexSpawn, createCodexLogin } from "./codex-login.ts";
import { type Db, migrationsFolder } from "./db/client.ts";
import * as schema from "./db/schema.ts";
import { createModelCatalog } from "./model-catalog.ts";
import { Settings } from "./settings.ts";

/**
 * In-process Postgres (PGlite) with the real migrations, so API tests need no Docker. Pass a
 * directory to persist data across `close()` and reopen, which is how tests simulate a restart.
 */
export async function openTestDb(dataDir?: string) {
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db: db as Db, client, close: () => client.close() };
}

/**
 * `models` and `settings` default to "no provider configured" in a throwaway directory. Codex's
 * sign-in never runs `codex` unless a test passes its own (fake) `codexLogin`, and the model
 * catalogue never fetches (an empty catalogue in its own throwaway directory).
 */
export function buildTestApp(db: Db, deps: Partial<AppDeps> = {}) {
  return buildApp({
    db,
    pingDb: async () => {},
    version: "0.0.0-test",
    settings: new Settings(mkdtempSync(join(tmpdir(), "jeeves-home-")), {}),
    codexLogin: createCodexLogin({
      spawn: () => {
        throw new Error("A test ran codex without a fake spawn.");
      },
      env: {},
    }),
    modelCatalog: createModelCatalog({
      home: mkdtempSync(join(tmpdir(), "jeeves-catalog-")),
      fetch: null,
      now: Date.now,
    }),
    ...deps,
  });
}

/** A stand-in for a `codex` child process: tests print its output and end it. */
export class FakeCodexProcess extends EventEmitter {
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  killed = false;

  kill() {
    this.killed = true;
    return true;
  }

  print(stream: "stdout" | "stderr", text: string) {
    this[stream].emit("data", Buffer.from(text));
  }

  exit(code: number | null) {
    this.emit("close", code);
  }
}

/** A fake `spawn` for `createCodexLogin`; `onSpawn` may script each process it starts. */
export function fakeCodexSpawn(
  onSpawn: (child: FakeCodexProcess, args: string[]) => void = () => {},
) {
  const calls: { command: string; args: string[]; env: NodeJS.ProcessEnv }[] = [];
  const children: FakeCodexProcess[] = [];
  const spawn: CodexSpawn = (command, args, { env }) => {
    const child = new FakeCodexProcess();
    calls.push({ command, args, env });
    children.push(child);
    onSpawn(child, args);
    return child;
  };
  return { spawn, calls, children };
}

/** A clock whose timers fire only when a test moves it on. */
export function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  const clock: Clock = {
    setTimeout: (run, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, run });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id as number);
    },
  };
  return {
    clock,
    advance(ms: number) {
      now += ms;
      const due = [...timers].filter(([, t]) => t.at <= now).sort(([, a], [, b]) => a.at - b.at);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.run();
      }
    },
    pending: () => timers.size,
  };
}
