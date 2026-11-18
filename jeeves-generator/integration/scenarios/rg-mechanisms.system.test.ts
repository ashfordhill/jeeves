import assert from "node:assert/strict";
import { expect, test } from "vitest";
import { healthyCopies } from "../harness/activity.ts";
import { foundationScenario } from "../harness/foundation-scenario.ts";
import { IdentityClient } from "../harness/identity.ts";
import { catalogScenario } from "../harness/rg-catalog.ts";
import {
  finish,
  foundationTemplates,
  native,
  warmFoundationProbes,
} from "../harness/rg-foundations.ts";
import {
  browserLogin,
  issuerMode,
  issuerStats,
  prepareLinkFlow,
} from "../harness/rg-mechanisms.ts";

test("RG23: link/account sessions compose with foundation mechanisms in independent processes", async () => {
  await foundationScenario({
    fixture: "rg-link-flow",
    templates: [...foundationTemplates, "module-stub", "browser-session"],
    beforeStart: prepareLinkFlow,
    extra: async (app) => {
      await app.compose(["up", "-d", "--no-deps", "--scale", "app-browser=2", "app-browser"]);
      const copies = await healthyCopies(app, "app-browser", 2);
      const [firstBrowser, secondBrowser] = copies;
      assert(firstBrowser && secondBrowser);
      await app.compose([
        "up",
        "-d",
        "--no-deps",
        "--scale",
        "app-items-worker=2",
        "app-items-worker",
      ]);
      const workers = await healthyCopies(app, "app-items-worker", 2);
      await app.save("browser-worker-copies.json", {
        browser: copies.map((r) => r.Id),
        workers: workers.map((r) => r.Id),
      });
      const accounts = await new IdentityClient(app).provision("browser");
      const account = accounts[0];
      assert(account);
      // Foundation's unchanged account setup follows after this extension; use a distinct fixture user.
      const session = await browserLogin(app, account.username, account.password);
      const observations: unknown[] = [];
      const call = async (id: string, method = "GET", csrf = true) =>
        native<{ status: number; body: unknown }>(
          app,
          "app-browser",
          `
const r=await fetch('http://127.0.0.1:3000/modules/navigate',{method:${JSON.stringify(method)},headers:{cookie:${JSON.stringify(session.cookie)},origin:'https://browser.test',...( ${csrf} ? {'x-csrf-token':${JSON.stringify(session.csrf)}}:{}),...( ${JSON.stringify(method)}==='POST'?{'content-type':'application/json','idempotency-key':'browser-no-csrf'}:{})},...(${JSON.stringify(method)}==='POST'?{body:'{"id":"browser-no-csrf"}'}:{})});${finish("{status:r.status,body:await r.json()}")}
`,
          id,
        );
      expect((await call(firstBrowser.Id, "POST", false)).status).toBe(403);
      await app.sql(
        "UPDATE jeeves.browser_sessions SET access_expires_at=clock_timestamp()-interval '1 second'",
        "d_sessions",
      );
      const before = await issuerStats(app);
      const results = await Promise.all(copies.map((copy) => call(copy.Id)));
      expect(results.map((r) => r.status)).toEqual([404, 404]);
      const after = await issuerStats(app);
      expect(after.rotations - before.rotations).toBe(1);
      expect(
        await app.sql(
          "SELECT refresh_generation||'|'||refresh_uncertain FROM jeeves.browser_sessions",
          "d_sessions",
        ),
      ).toBe("1|false");
      observations.push({
        name: "concurrent refresh",
        expected: "one SDK rotation across two processes",
        actual: {
          copies: copies.map((c) => c.Id),
          statuses: results.map((r) => r.status),
          rotations: after.rotations - before.rotations,
          generation: 1,
        },
      });
      for (const mode of ["temporary", "unknown", "refused"]) {
        const fresh = await browserLogin(app, account.username, account.password);
        Object.assign(session, fresh);
        await app.sql(
          "UPDATE jeeves.browser_sessions SET access_expires_at=clock_timestamp()-interval '1 second' WHERE revoked_at IS NULL",
          "d_sessions",
        );
        await issuerMode(app, mode);
        const pre = await issuerStats(app);
        const result = await call(firstBrowser.Id);
        const post = await issuerStats(app);
        expect(result.status).toBe(mode === "refused" ? 401 : 503);
        const state = await app.sql(
          "SELECT refresh_uncertain||'|'||(revoked_at IS NOT NULL) FROM jeeves.browser_sessions ORDER BY created_at DESC LIMIT 1",
          "d_sessions",
        );
        expect(state).toBe(
          mode === "unknown" ? "true|false" : mode === "refused" ? "true|true" : "false|false",
        );
        if (mode === "refused")
          expect(
            await app.sql(
              "SELECT (revoked_at IS NOT NULL AND access_sealed IS NULL AND refresh_sealed IS NULL AND id_sealed IS NULL)::text FROM jeeves.browser_sessions ORDER BY created_at DESC LIMIT 1",
              "d_sessions",
            ),
          ).toBe("true");
        if (mode === "unknown") {
          await issuerMode(app, "normal");
          expect((await call(secondBrowser.Id)).status).toBe(503);
          expect((await issuerStats(app)).refreshes).toBe(post.refreshes);
        }
        if (mode === "temporary") {
          await issuerMode(app, "normal");
          expect((await call(secondBrowser.Id)).status).toBe(404);
        }
        const localIdentity = await native<{ status: number; signedIn: boolean }>(
          app,
          "app-browser",
          `const response=await fetch('http://127.0.0.1:3000/modules/session/session',{headers:{cookie:${JSON.stringify(session.cookie)}}});const value=await response.json();${finish("{status:response.status,signedIn:value.signedIn===true}")}`,
          secondBrowser.Id,
        );
        expect(localIdentity).toEqual(
          mode === "refused" ? { status: 401, signedIn: false } : { status: 200, signedIn: true },
        );
        observations.push({
          name: mode,
          expected: "distinct retained/uncertain/revoked state",
          actual: {
            status: result.status,
            state,
            localIdentity,
            dispatches: post.refreshes - pre.refreshes,
            rotations: post.rotations - pre.rotations,
          },
        });
        await issuerMode(app, "normal");
      }
      await app.save("session-assertions.json", observations);
      warmFoundationProbes(app);
    },
  });
});

test(
  "RG23: catalog events, remote recovery and queue receipts compose across native copies",
  catalogScenario,
);
