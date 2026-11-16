import { stripTypeScriptTypes } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { localOperationDesign } from "../../../field-projects/generator-system/fixtures/rg-local-operation/design.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import {
  assertNetworkAllowed,
  databases,
  fixture,
  load,
  operation,
  ring,
  sweepExpired,
  transaction,
  withEffect,
  withOperation,
} from "./local-operation.test.helpers.ts";

afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.close()));
  vi.restoreAllMocks();
});

describe("RG10 local operation ownership", () => {
  it("replays before failed admission, shares HTTP/callable identity and conflicts on changed input", async () => {
    const f = await fixture();
    let unavailable = false;
    let admissions = 0;
    const local = f.define({
      admit: async () => {
        admissions++;
        if (unavailable) throw Error("reputation unavailable");
      },
    });
    const first = await f.run(local);
    unavailable = true;
    expect(await f.run(local, "key", { id: "one" }, "alice", true)).toEqual({
      ...first,
      headers: { "Cache-Control": "no-store" },
    });
    expect(admissions).toBe(1);
    await expect(f.run(local, "key", { id: "changed" })).rejects.toMatchObject({
      statusCode: 409,
      code: "IDEMPOTENCY_CONFLICT",
    });
    await expect(f.run(local, "other", { id: "new" })).rejects.toThrow("reputation unavailable");
    expect((await f.pg.query("SELECT count(*)::int AS n FROM p_app.items")).rows).toEqual([
      { n: 1 },
    ]);
    const stored = JSON.stringify(
      (await f.pg.query("SELECT response,metadata FROM jeeves.idempotency_records")).rows,
    );
    expect(stored).not.toContain("replay-secret");
    expect(stored).toContain("jke1.old.");
    expect(stored).toContain('"codec":1');
  });
  it("authenticates and derives account scope before lookup; another account never obtains the replay", async () => {
    const f = await fixture();
    let admit = 0;
    const local = f.define({
      admit: async () => {
        if (++admit > 1) throw Error("denied other account");
      },
    });
    await f.run(local);
    await expect(f.run(local, "key", { id: "one" }, "")).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(f.run(local, "key", { id: "one" }, "bob")).rejects.toThrow("denied other account");
    expect((await f.pg.query("SELECT scope_id FROM jeeves.idempotency_records")).rows).toEqual([
      { scope_id: "alice" },
    ]);
  });
  it("rolls back the mutation and replay together on callback failure or invalid/oversized result", async () => {
    const f = await fixture();
    for (const status of ["throw", "oversize", "status"]) {
      const local = f.define({
        mutate: async (
          _input: unknown,
          sql: { call: (name: string, args: unknown[]) => Promise<unknown> },
        ) => {
          await sql.call("insert", [status, "alice"]);
          if (status === "throw") throw Error("failure");
          return {
            status: status === "status" ? 500 : 201,
            body: "x".repeat(12289),
          };
        },
      });
      await expect(f.run(local, status, { id: status })).rejects.toThrow();
    }
    expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toEqual([]);
    expect((await f.pg.query("SELECT * FROM jeeves.idempotency_records")).rows).toEqual([]);
  });
  it("lost COMMIT response remains unknown and recovers the durable result without another mutation", async () => {
    const f = await fixture();
    let calls = 0;
    const local = f.define({
      admit: async () => {
        calls++;
      },
    });
    f.lose();
    await expect(f.run(local)).rejects.toMatchObject({
      outcome: "unknown",
      name: "TransactionOutcomeUnknown",
    });
    expect(await f.run(local)).toEqual({
      status: 201,
      body: { id: "one", secret: "replay-secret" },
    });
    expect(calls).toBe(1);
    expect(f.releases).toContain(true);
  });
  it("coordinates identical callers and returns explicit in-progress; expired rows refuse and cleanup preserves active state", async () => {
    const f = await fixture();
    const local = f.define();
    const [a, b] = await Promise.all([f.run(local), f.run(local)]);
    expect(a).toEqual(b);
    expect((await f.pg.query("SELECT count(*)::int AS n FROM p_app.items")).rows).toEqual([
      { n: 1 },
    ]);
    f.deny();
    await expect(f.run(local, "competing", { id: "two" })).rejects.toMatchObject({
      code: "IDEMPOTENCY_IN_PROGRESS",
    });
    await f.pg.exec("UPDATE jeeves.idempotency_records SET expires_at = now()-interval '1 second'");
    await expect(f.run(local)).rejects.toMatchObject({
      statusCode: 410,
      code: "IDEMPOTENCY_EXPIRED",
    });
    await f.pg.exec(
      "INSERT INTO jeeves.idempotency_records SELECT tile,scope_kind,scope_id,'active',request_hash,0,'{}',created_at,expires_at,metadata FROM jeeves.idempotency_records",
    );
    expect(await sweepExpired(f.pool)).toBe(1);
    expect((await f.pg.query("SELECT idem_key FROM jeeves.idempotency_records")).rows).toEqual([
      { idem_key: "active" },
    ]);
  });
  it("retained key rotation replays, removed keys and cross-scope ciphertext swaps fail closed", async () => {
    const f = await fixture();
    await f.run(f.define());
    expect(await f.run(f.define({}, ring(["new", "old"])))).toMatchObject({
      status: 201,
    });
    await expect(f.run(f.define({}, ring(["new"])))).rejects.toMatchObject({
      code: "REPLAY_UNAVAILABLE",
    });
    await f.pg.exec(
      "INSERT INTO jeeves.idempotency_records SELECT tile,scope_kind,'bob',idem_key,request_hash,status,response,created_at,expires_at,metadata FROM jeeves.idempotency_records",
    );
    await expect(
      f.run(f.define({}, ring(["old"])), "key", { id: "one" }, "bob"),
    ).rejects.toMatchObject({ code: "REPLAY_UNAVAILABLE" });
  });
  it("keeps every concurrent command under the restricted role, drains unawaited work and closes the supplied handle", async () => {
    const f = await fixture();
    let retained: { call: (name: string, args: unknown[]) => Promise<unknown> } | undefined;
    const local = f.define({
      mutate: async (_input: unknown, sql: NonNullable<typeof retained>) => {
        retained = sql;
        sql.call("insert", ["two", "alice"]);
        await sql.call("insert", ["three", "alice"]);
        return { status: 201, body: { ok: true } };
      },
    });
    await f.run(local);
    expect(f.trace.filter((row) => row.sql.startsWith("INSERT INTO p_app"))).toEqual([
      {
        sql: "INSERT INTO p_app.items(id,account) VALUES($1,$2) RETURNING id, account",
        role: "product",
      },
      {
        sql: "INSERT INTO p_app.items(id,account) VALUES($1,$2) RETURNING id, account",
        role: "product",
      },
    ]);
    expect(f.trace.find((row) => row.sql.startsWith("UPDATE jeeves"))?.role).toBe("runtime");
    if (!retained) throw new Error("missing scoped handle");
    await expect(retained.call("insert", ["late", "alice"])).rejects.toThrow("closed");
    await f.pg.exec("SET SESSION AUTHORIZATION product");
    await expect(f.pg.query("SELECT * FROM jeeves.idempotency_records")).rejects.toThrow(
      /permission denied/,
    );
    await f.pg.exec("SET SESSION AUTHORIZATION postgres");
  });
  it("caught command failure poisons the transaction, including failure before SQL dispatch", async () => {
    const f = await fixture();
    for (const name of ["insert", "unregistered"]) {
      const local = f.define({
        mutate: async (
          _input: unknown,
          sql: { call: (name: string, args: unknown[]) => Promise<unknown> },
        ) => {
          await sql.call("insert", ["same", "alice"]);
          await sql.call(name, ["same", "alice"]).catch(() => {});
          return { status: 201, body: { ok: true } };
        },
      });
      await expect(f.run(local, name, { id: name })).rejects.toThrow();
    }
    expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toEqual([]);
    expect((await f.pg.query("SELECT * FROM jeeves.idempotency_records")).rows).toEqual([]);
  });
  it("refuses captured same/other database handles and network capabilities even through nested reads", async () => {
    const f = await fixture();
    for (const effect of [
      () => f.dependencies.db.call("read", []),
      () =>
        transaction(
          {
            connect: () => {
              throw Error("must not connect");
            },
          },
          async () => {},
        ),
      () =>
        withEffect("read", () => {
          assertNetworkAllowed();
          throw Error("must not dispatch");
        }),
    ]) {
      const local = f.define({
        mutate: async () => {
          await effect();
          return { status: 201, body: { ok: true } };
        },
      });
      await expect(f.run(local)).rejects.toMatchObject({
        outcome: "refused",
        code: "EFFECT_NOT_ALLOWED",
      });
    }
    expect((await f.pg.query("SELECT * FROM jeeves.idempotency_records")).rows).toEqual([]);
  });
});

it("RG10 observes rejected async validation and refuses invalid inputs before acquiring a connection", async () => {
  const f = await fixture();
  const local = f.define({
    validate: async () => {
      throw Error("private validator failure");
    },
  });
  await expect(f.run(local)).rejects.toMatchObject({
    statusCode: 400,
    code: "LOCAL_OPERATION_INPUT",
  });
  expect(f.trace).toEqual([]);
  const normal = f.define();
  for (const [key, input] of [
    ["bad key", { id: "one" }],
    ["key", () => {}],
    ["key", { id: "x".repeat(16385) }],
  ])
    await expect(f.run(normal, key as string, input)).rejects.toMatchObject({ statusCode: 400 });
  expect(f.trace).toEqual([]);
});
it("RG10 starts retention at successful storage rather than transaction/admission start", async () => {
  const f = await fixture();
  const local = f.define({
    admit: async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    },
  });
  await f.run(local);
  const row = (
    await f.pg.query<{ horizon: number; remaining: number }>(
      "SELECT extract(epoch FROM expires_at-created_at)::float8 AS horizon, extract(epoch FROM expires_at-clock_timestamp())::float8 AS remaining FROM jeeves.idempotency_records",
    )
  ).rows[0];
  expect(row?.horizon).toBeGreaterThan(60.05);
  expect(row?.remaining).toBeGreaterThan(59.5);
});

it("RG10 refuses accessor DTOs before getters run and never widens a read caller", async () => {
  const f = await fixture();
  let getters = 0;
  let drivers = 0;
  for (const field of ["body", "status"]) {
    const result = f.define({
      mutate: async () =>
        Object.defineProperty({ status: 201, body: null }, field, {
          enumerable: true,
          get() {
            getters++;
            assertNetworkAllowed();
            drivers++;
            return field === "status" ? 201 : "leak";
          },
        }),
    });
    await expect(f.run(result)).rejects.toThrow(/JSON DTO/);
    expect(getters).toBe(0);
    expect(drivers).toBe(0);
  }
  const policy = f.define({
    validate: () =>
      // biome-ignore lint/suspicious/noThenProperty: deliberately invalid accessor; assert it is never evaluated
      Object.defineProperty({}, "then", {
        enumerable: true,
        get() {
          getters++;
          return "leak";
        },
      }),
  });
  await expect(f.run(policy)).rejects.toMatchObject({ statusCode: 400 });
  expect(getters).toBe(0);
  const valid = f.define();
  await f.run(valid);
  await expect(withEffect("read", () => f.run(valid))).rejects.toMatchObject({
    code: "EFFECT_NOT_ALLOWED",
  });
});

it("RG10 refuses malformed account encodings before lookup while retaining valid Unicode scopes", async () => {
  const f = await fixture();
  const local = f.define();
  for (const subject of ["bad\u0000scope", "bad\ud800scope", "bad\udc00scope"])
    await expect(f.run(local, "key", { id: "one" }, subject)).rejects.toMatchObject({
      statusCode: 400,
    });
  expect(f.trace).toEqual([]);
  await f.run(local, "key", { id: "one" }, "acct-é");
  expect((await f.pg.query("SELECT scope_id FROM jeeves.idempotency_records")).rows).toEqual([
    { scope_id: "acct-é" },
  ]);
});
it("RG10 normalizes JSON numeric identity before callbacks", async () => {
  const f = await fixture();
  let effects = 0;
  const local = f.define({
    validate: (value: unknown) => value,
    mutate: async (input: unknown) => {
      effects++;
      expect(Object.is(input, -0)).toBe(false);
      return { status: 200, body: input };
    },
  });
  expect(await f.run(local, "zero", -0)).toEqual({ status: 200, body: 0 });
  expect(await f.run(local, "zero", 0)).toEqual({ status: 200, body: 0 });
  expect(effects).toBe(1);
});

it("RG10 hidden function effects stay under the product role and caught concurrent failure cannot commit replay", async () => {
  const f = await fixture();
  await f.pg.exec(
    "CREATE FUNCTION public.probe() RETURNS text LANGUAGE SQL AS $$ SELECT count(*)::text FROM jeeves.idempotency_records $$;",
  );
  f.files["infra/postgres/db/products/commands/insert.sql"] =
    "INSERT INTO p_app.items(id,account) VALUES($1,CASE WHEN $1 = 'probe' THEN probe() ELSE $2 END)";
  let failures: PromiseSettledResult<unknown>[] = [];
  const local = f.define({
    mutate: async (
      _input: unknown,
      commands: { call(name: string, values: unknown[]): Promise<unknown> },
    ) => {
      failures = await Promise.allSettled([
        commands.call("insert", ["allowed", "alice"]),
        commands.call("insert", ["probe", "alice"]),
      ]);
      return { status: 201, body: null };
    },
  });
  await expect(f.run(local)).rejects.toThrow(/permission denied/);
  expect(failures.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
  expect(
    f.trace.filter((row) => row.sql.startsWith("INSERT INTO p_app")).map((row) => row.role),
  ).toEqual(["product", "product"]);
  expect(f.trace.some((row) => row.sql.startsWith("UPDATE jeeves"))).toBe(false);
  expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toEqual([]);
  expect((await f.pg.query("SELECT * FROM jeeves.idempotency_records")).rows).toEqual([]);
});

it("RG10 refuses sparse/undefined/accessor scoped parameters before SQL and poisons caught failures", async () => {
  const f = await fixture();
  let getters = 0;
  const accessor = Object.defineProperty(["one", null], "1", {
    get() {
      getters++;
      return "alice";
    },
  });
  for (const parameters of [new Array(2), ["one", undefined], accessor]) {
    const local = f.define({
      mutate: async (
        _input: unknown,
        commands: { call(name: string, values: unknown[]): Promise<unknown> },
      ) => {
        await commands.call("insert", parameters).catch(() => {});
        return { status: 201, body: null };
      },
    });
    await expect(f.run(local)).rejects.toThrow(/Invalid product SQL parameters/);
  }
  expect(getters).toBe(0);
  expect(f.trace.some((row) => row.sql.startsWith("INSERT INTO p_app"))).toBe(false);
  expect((await f.pg.query("SELECT * FROM jeeves.idempotency_records")).rows).toEqual([]);
});

it("RG10 executes the emitted same-process dependency binding through the configured operation core", async () => {
  const f = await fixture();
  let admissions = 0;
  const local = f.define({
    admit: async () => {
      if (++admissions > 1) throw Error("new work unavailable");
    },
  });
  const expected = await f.run(local);
  const bundle = assembleV2(
    { designJson: JSON.stringify(localOperationDesign()) },
    loadLocalV2Registry(),
  );
  const source = new TextDecoder().decode(
    bundle.files.find((file) => file.path === "src/processes/items-api.ts")?.bytes,
  );
  const assignment = /dependencies\["item-caller"\] = \{[\s\S]*?\n\s*\};/.exec(source)?.[0];
  if (!assignment) throw Error("Missing emitted callable binding");
  const { moduleCall } = await import((await import("./operation.test.helpers.ts")).operationUrl);
  const { invokeLocalModule } = await import(load("local-operation"));
  const invoke = new Function(
    "CreateItemModule",
    "moduleCall",
    "invokeLocalModule",
    "createItem",
    "configuredSettings",
    "callee",
    `const dependencies={"create-item":callee};${stripTypeScriptTypes(assignment)};return dependencies["item-caller"].createItem;`,
  )(
    { localOperation: local },
    moduleCall,
    invokeLocalModule,
    async () => {
      throw Error("legacy entry must not run");
    },
    { "item-caller": {} },
    f.dependencies,
  );
  const running = operation({ maximumMs: 10000, caller: { subject: "alice" } });
  try {
    expect(
      await withOperation(running.context, () => invoke({ key: "key", input: { id: "one" } })),
    ).toEqual(expected);
  } finally {
    running.close();
  }
  expect(admissions).toBe(1);
});
