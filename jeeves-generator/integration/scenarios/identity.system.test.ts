import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { healthyCopies } from "../harness/activity.ts";
import { withApplication } from "../harness/application.ts";
import { inventory } from "../harness/cleanup.ts";
import { IdentityClient, identityTemplates, signedRequest, tampered } from "../harness/identity.ts";
import { command, hash } from "../harness/process.ts";

const required = "/api/account-api/modules/account-check/me";
const optional = "/api/viewer-api/modules/viewer-check/me";
const items = "/api/account-api/modules/favorite-items/items";
type Favorite = { itemId: string; addedAt: string };

test("B07: real PKCE identity guards, isolated idempotent favorites and user identities survive restart", async () => {
  await withApplication("identity", identityTemplates, async (app) => {
    expect(app.report.applicationComplete).toBe(false);
    expect(app.report.gaps.filter((row) => row.status === "custom" && row.required)).toHaveLength(
      2,
    );
    const identity = new IdentityClient(app);
    const accounts = await identity.provision();
    const [a, b] = accounts;
    if (!a || !b) throw new Error("Two disposable accounts required");
    expect(a.subject).not.toBe(b.subject);
    let tokenA = await identity.signIn(a);
    let tokenB = await identity.signIn(b);
    const invalid = tampered(tokenA);
    await identity.protect(invalid);
    for (const token of [undefined, "not-a-token", invalid]) {
      expect((await signedRequest(app, token, required)).status).toBe(401);
      for (const [method, path] of [
        ["GET", items],
        ["PUT", `${items}/amber`],
        ["GET", `${items}/amber`],
        ["DELETE", `${items}/amber`],
      ] as const)
        expect((await signedRequest(app, token, path, method)).status).toBe(401);
    }
    expect(await signedRequest(app, undefined, optional)).toEqual({
      status: 200,
      body: { signedIn: false },
    });
    for (const token of ["not-a-token", invalid])
      expect((await signedRequest(app, token, optional)).status).toBe(401);
    for (const [account, token] of [
      [a, tokenA],
      [b, tokenB],
    ] as const)
      for (const path of [required, optional])
        expect(await signedRequest(app, token, path)).toEqual({
          status: 200,
          body: { signedIn: true, subject: account.subject, username: account.username },
        });
    const call = (token: string, method = "GET", id = "") =>
      signedRequest(app, token, `${items}${id ? `/${id}` : ""}`, method);
    const rows = () =>
      app.sql(
        `SELECT account||'|'||item||'|'||to_char(added_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') FROM favorite_items.favorites ORDER BY account,item`,
        "d_favorites",
      );
    expect(await call(tokenA)).toEqual({ status: 200, body: { items: [], next: null } });
    expect(await call(tokenA, "GET", "amber")).toEqual({
      status: 404,
      body: { error: "NOT_FAVORITE", message: "This item isn't a favorite." },
    });
    const first = await call(tokenA, "PUT", "amber");
    expect(first.status).toBe(200);
    const favorite = first.body as Favorite;
    expect(favorite.itemId).toBe("amber");
    expect(favorite.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
    expect(await call(tokenA, "PUT", "amber")).toEqual(first);
    const expectedRow = `${a.subject}|amber|${favorite.addedAt}`;
    expect(await rows()).toBe(expectedRow);
    expect(await call(tokenA, "GET", "amber")).toEqual(first);
    expect(await call(tokenA)).toEqual({ status: 200, body: { items: [favorite], next: null } });
    expect(await call(tokenB)).toEqual({ status: 200, body: { items: [], next: null } });
    expect(await call(tokenB, "GET", "amber")).toEqual({
      status: 404,
      body: { error: "NOT_FAVORITE", message: "This item isn't a favorite." },
    });
    expect((await call(tokenB, "DELETE", "amber")).status).toBe(204);
    expect(await rows()).toBe(expectedRow);
    expect(await call(tokenA, "GET", "amber")).toEqual(first);
    for (const id of ["draft", "missing"]) {
      const refused = await call(tokenA, "PUT", id);
      expect(refused.status).toBe(404);
      expect(refused.body).toMatchObject({ error: "NOT_ELIGIBLE" });
    }
    expect(await rows()).toBe(expectedRow);
    expect(await signedRequest(app, tokenA, "/api/account-api/modules/catalog-writer")).toEqual({
      status: 200,
      body: [
        { id: "amber", title: "Amber lighthouse" },
        { id: "violet", title: "Violet harbor" },
      ],
    });
    expect(await app.sql("SELECT id FROM published.items ORDER BY id", "d_catalog")).toBe(
      "amber\nviolet",
    );

    // The unmodified runtime/history, secrets and provider volume must survive pnpm stop/start.
    const history = join(app.directory, ".runtime/local-setup.json");
    const historyBefore = hash(await readFile(history));
    const secretsBefore = hash(
      await command("find", [".runtime/secrets", "-type", "f", "-exec", "sha256sum", "{}", "+"], {
        cwd: app.directory,
      }),
    );
    const volumes = async () => {
      const ids = (await inventory(app.stack.project)).volumes;
      expect(ids).toHaveLength(1);
      const result = JSON.parse(await command("docker", ["volume", "inspect", ...ids])) as {
        Name: string;
        CreatedAt: string;
        Labels: Record<string, string>;
      }[];
      for (const row of result)
        expect(row.Labels["com.docker.compose.project"]).toBe(app.stack.project);
      return result;
    };
    const before = await volumes();
    const usersBefore = await app.sql(
      "SELECT id||'|'||username FROM user_entity WHERE username IN ('account-a','account-b') ORDER BY username",
      "i_sign_in",
    );
    expect(usersBefore).toBe(`${a.subject}|${a.username}\n${b.subject}|${b.username}`);
    await app.execute("ordinary-stop", "pnpm", ["stop"], 180_000);
    expect((await app.compose(["ps", "--status", "running", "-q"])).trim()).toBe("");
    await app.execute("ordinary-start", "pnpm", ["start"], 600_000);
    for (const service of ["identity-sign-in", "app-account-api", "app-viewer-api", "app-edge"])
      await healthyCopies(app, service, 1);
    const historyAfter = hash(await readFile(history));
    const secretsAfter = hash(
      await command("find", [".runtime/secrets", "-type", "f", "-exec", "sha256sum", "{}", "+"], {
        cwd: app.directory,
      }),
    );
    const after = await volumes();
    expect(historyAfter).toBe(historyBefore);
    expect(secretsAfter).toBe(secretsBefore);
    expect(after).toEqual(before);
    expect(
      await app.sql(
        "SELECT id||'|'||username FROM user_entity WHERE username IN ('account-a','account-b') ORDER BY username",
        "i_sign_in",
      ),
    ).toBe(usersBefore);
    tokenA = await identity.signIn(a);
    tokenB = await identity.signIn(b);
    expect(await signedRequest(app, tokenA, required)).toEqual({
      status: 200,
      body: { signedIn: true, subject: a.subject, username: a.username },
    });
    expect(await signedRequest(app, tokenB, required)).toEqual({
      status: 200,
      body: { signedIn: true, subject: b.subject, username: b.username },
    });
    expect(await rows()).toBe(expectedRow);
    expect(await call(tokenA, "GET", "amber")).toEqual(first);
    expect(await call(tokenA)).toEqual({ status: 200, body: { items: [favorite], next: null } });
    expect(await call(tokenB)).toEqual({ status: 200, body: { items: [], next: null } });
    const second = await call(tokenB, "PUT", "violet");
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ itemId: "violet" });
    expect((await rows()).split("\n").sort()).toEqual(
      [expectedRow, `${b.subject}|violet|${(second.body as Favorite).addedAt}`].sort(),
    );
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await call(tokenA, "DELETE", "amber")).toEqual({ status: 204, body: "" });
      expect(await call(tokenA, "GET", "amber")).toEqual({
        status: 404,
        body: { error: "NOT_FAVORITE", message: "This item isn't a favorite." },
      });
      expect(await call(tokenA)).toEqual({ status: 200, body: { items: [], next: null } });
    }
    expect(await call(tokenB, "GET", "violet")).toEqual(second);
    expect((await call(tokenB, "DELETE", "violet")).status).toBe(204);
    expect(await rows()).toBe("");
    await app.save("restart-preservation.json", {
      historyBefore,
      historyAfter,
      secretsBefore,
      secretsAfter,
      volumesBefore: before,
      volumesAfter: after,
      usersBefore,
      favorite,
    });
  });
});
