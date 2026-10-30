import type { Resource, ResourceConfig } from "@jeeves/spec";
import type { OutputFile } from "@jeeves/template-kit";

/** Independent HTTP assertions, emitted outside project/agent-owned directories. */
export function resourceTests(
  service: string,
  resource: Resource,
  model: ResourceConfig,
): OutputFile {
  const q = JSON.stringify;
  const seedLines: string[] = [];
  let seedNumber = 0;
  const seedInput = (r: Resource, variable: string) => {
    const input = Object.fromEntries(
      r.fields
        .filter((f) => f.type !== "timestamp")
        .map((f) => [
          f.name,
          f.type === "http-url"
            ? "https://example.test/original"
            : "sample".slice(0, f.type === "text" ? f.maxLength : 6),
        ]),
    );
    seedLines.push("  const " + variable + " = " + q(input) + ";");
    for (const b of r.belongsTo) {
      const parent = model.resources.find((p) => p.id === b.resource)!;
      const key = q(parent.name + "Id");
      if (parent.access === "owner" && parent.operations.includes("create")) {
        const name = "parent" + seedNumber++;
        seedInput(parent, name);
        seedLines.push(
          "  const " +
            name +
            "Response=await fetch(base+" +
            q("/api/" + parent.name) +
            ',{method:"POST",headers:alice,body:JSON.stringify(' +
            name +
            ")}); assert.equal(" +
            name +
            "Response.status,201);",
          "  " + variable + "[" + key + "]=(await " + name + "Response.json()).id;",
        );
      } else
        seedLines.push(
          "  " +
            variable +
            "[" +
            key +
            "]=process.env[" +
            q("JEEVES_TEST_PARENT_" + b.resource.toUpperCase().replaceAll("-", "_")) +
            "]; assert.ok(" +
            variable +
            "[" +
            key +
            '],"Provide the isolated related-resource fixture");',
        );
    }
  };
  seedInput(resource, "input");
  const source = [
    "// Generated standard behavior checks. Run only on disposable local fixtures.",
    'import assert from "node:assert/strict";',
    'import { randomUUID } from "node:crypto";',
    'import test from "node:test";',
    "test(" +
      q(service + "/" + resource.id + ": CRUD, isolation, validation and logout") +
      ", async () => {",
    '  assert.equal(process.env.JEEVES_TEST_ISOLATED, "1", "Requires a disposable fixture");',
    "  const base = process.env.JEEVES_TEST_URL;",
    '  assert.ok(base, "Set JEEVES_TEST_URL");',
    '  assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));',
    "  const origin = process.env.JEEVES_TEST_PUBLIC_ORIGIN;",
    '  assert.ok(origin, "Set JEEVES_TEST_PUBLIC_ORIGIN to the fixture origin");',
    "  const register = async () => {",
    '    const res = await fetch(base + "/auth/register", {method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify({email:randomUUID()+"@example.test",password:"isolated-test-password"})});',
    "    assert.equal(res.status,201); const user=await res.json();",
    '    return {cookie:res.headers.get("set-cookie").split(";")[0],"x-csrf-token":user.csrfToken,origin,"content-type":"application/json"};',
    "  };",
    "  const alice=await register(); const bob=await register();",
    ...seedLines,
    "  const path = " + q("/api/" + resource.name) + ";",
    "  const ops = " + q(resource.operations) + ";",
    "  const assertRow = row => { assert.match(row.id,/^[a-f0-9-]{36}$/); assert.ok(Number.isFinite(Date.parse(row.createdAt))); assert.equal(row.ownerId,undefined);",
    ...resource.fields
      .filter((f) => f.type !== "timestamp")
      .map((f) => "    assert.equal(row[" + q(f.name) + "], input[" + q(f.name) + "] ?? null);"),
    ...resource.fields
      .filter((f) => f.type === "timestamp")
      .map((f) => "    assert.ok(Number.isFinite(Date.parse(row[" + q(f.name) + "])));"),
    ...resource.belongsTo.map((b) => {
      const name = model.resources.find((r) => r.id === b.resource)!.name + "Id";
      return "    assert.equal(row[" + q(name) + "],input[" + q(name) + "]);";
    }),
    "  };",
    "  let id=process.env.JEEVES_TEST_RESOURCE_ID;",
    '  if (ops.includes("create")) {',
    '    assert.equal((await fetch(base+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)})).status,401);',
    '    const invalids=[{...input,ownerId:randomUUID()},{...input,id:randomUUID()},{...input,unknown:"forbidden"},{...input,createdAt:new Date().toISOString()}];',
    ...resource.fields
      .filter((f) => f.type === "http-url")
      .map(
        (f) =>
          "    invalids.push({...input," +
          q(f.name) +
          ':"ftp://example.test"},{...input,' +
          q(f.name) +
          ':"https://user:password@example.test"});',
      ),
    ...resource.fields
      .filter((f) => f.type !== "timestamp" && f.required)
      .map(
        (f) =>
          "    { const missing={...input}; delete missing[" +
          q(f.name) +
          "]; invalids.push(missing); }",
      ),
    ...resource.fields
      .filter((f) => f.type === "text")
      .map(
        (f) =>
          "    invalids.push({...input," +
          q(f.name) +
          ":" +
          q("x".repeat(f.type === "text" ? f.maxLength + 1 : 1)) +
          "});",
      ),
    '    for (const invalid of invalids) assert.equal((await fetch(base+path,{method:"POST",headers:alice,body:JSON.stringify(invalid)})).status,400);',
    '    const created=await fetch(base+path,{method:"POST",headers:alice,body:JSON.stringify(input)}); assert.equal(created.status,201);',
    "    const row=await created.json(); assertRow(row); id=row.id;",
    "  }",
    '  assert.ok(id,"Set JEEVES_TEST_RESOURCE_ID for a resource without create");',
    '  if (ops.includes("read")) {',
    '    assert.equal((await fetch(base+path+"/"+id)).status,401);',
    '    assert.equal((await fetch(base+path+"/"+id,{headers:bob})).status,404);',
    '    const row=await (await fetch(base+path+"/"+id,{headers:alice})).json(); assert.equal(row.id,id); assertRow(row);',
    "  }",
    '  if (ops.includes("list")) {',
    "    const own=await (await fetch(base+path,{headers:alice})).json(); assert.ok(own.items.some(row => row.id === id));",
    "    const other=await (await fetch(base+path,{headers:bob})).json(); assert.ok(!other.items.some(row => row.id === id));",
    '    assert.equal((await fetch(base+path+"?limit=101",{headers:alice})).status,400);',
    '    assert.equal((await fetch(base+path+"?cursor=invalid",{headers:alice})).status,400);',
    "  }",
    '  if (ops.includes("update")) {',
    ...resource.fields
      .filter((f) => f.type !== "timestamp")
      .slice(0, 1)
      .map(
        (f) =>
          "    input[" +
          q(f.name) +
          "]=" +
          q(
            f.type === "http-url" ? "https://example.test/updated" : "update".slice(0, f.maxLength),
          ) +
          ";",
      ),
    '    assert.equal((await fetch(base+path+"/"+id,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(input)})).status,401);',

    '    assert.equal((await fetch(base+path+"/"+id,{method:"PATCH",headers:bob,body:JSON.stringify(input)})).status,404);',
    '    const updated=await fetch(base+path+"/"+id,{method:"PATCH",headers:alice,body:JSON.stringify(input)}); assert.equal(updated.status,200); assertRow(await updated.json());',
    '    if (ops.includes("read")) assertRow(await (await fetch(base+path+"/"+id,{headers:alice})).json());',
    '    assert.equal((await fetch(base+path+"/"+id,{method:"PATCH",headers:{...alice,"x-csrf-token":"wrong"},body:JSON.stringify(input)})).status,403);',
    "  }",
    '  assert.equal((await fetch(base+"/auth/logout",{method:"POST",headers:alice,body:"{}"})).status,204);',
    '  assert.equal((await fetch(base+"/auth/session",{headers:alice})).status,401);',
    "});",
    "",
  ].join("\n");
  return {
    path: "tests/generated/" + service + "/" + resource.id + ".test.ts",
    ownership: "generated",
    contents: source,
  };
}

export function sessionTests(service: string): OutputFile {
  return {
    path: `tests/generated/${service}/_session.test.ts`,
    ownership: "generated",
    contents: `// Generated session behavior, run only in a disposable fixture.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
test("session registration, login, identity, CSRF and logout", async () => {
  assert.equal(process.env.JEEVES_TEST_ISOLATED, "1");
  const base = process.env.JEEVES_TEST_URL;
  assert.ok(base && ["127.0.0.1", "localhost"].includes(new URL(base).hostname));
  const origin = process.env.JEEVES_TEST_PUBLIC_ORIGIN;
  assert.ok(origin);
  const credentials = { email: randomUUID()+"@example.test", password: "isolated-test-password" };
  const headers = { origin, "content-type": "application/json" };
  const call = (path, body, extra = {}) => fetch(base+path, {method:"POST",headers:{...headers,...extra},body:JSON.stringify(body)});
  assert.equal((await fetch(base+"/auth/session")).status, 401);
  assert.equal((await call("/auth/register", {...credentials, ownerId: randomUUID()})).status,400);
  const registration = await call("/auth/register", credentials);
  assert.equal(registration.status,201);
  const user = await registration.json();
  assert.ok(user.id && user.csrfToken);
  assert.equal((await call("/auth/login", {...credentials, password:"incorrect-password"})).status,401);
  const login = await call("/auth/login", credentials);
  assert.equal(login.status,200);
  const identity = await login.json();
  assert.equal(identity.id, user.id);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const session = await fetch(base+"/auth/session", {headers:{cookie}});
  assert.equal(session.status,200);
  assert.equal((await session.json()).id, user.id);
  assert.equal((await call("/auth/logout", {}, {cookie, "x-csrf-token":"wrong"})).status,403);
  assert.equal((await call("/auth/logout", {}, {cookie, "x-csrf-token":identity.csrfToken})).status,204);
  assert.equal((await fetch(base+"/auth/session", {headers:{cookie}})).status,401);
});
`,
  };
}
