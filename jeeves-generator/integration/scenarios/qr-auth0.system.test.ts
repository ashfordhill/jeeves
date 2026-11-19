import { expect, test } from "vitest";
import { healthyCopies } from "../harness/activity.ts";
import type { Application } from "../harness/application.ts";
import { withApplication } from "../harness/application.ts";
import { auth0Login, auth0Mode, auth0Stats, prepareAuth0 } from "../harness/auth0.ts";
import { command } from "../harness/process.ts";
import { finish, native } from "../harness/rg-foundations.ts";

function browser(app: Application, path: string, headers = {}, id?: string, method = "GET") {
  return native<{ status: number; body: unknown }>(
    app,
    "app-browser-api",
    `
const response=await fetch('http://127.0.0.1:3000'+${JSON.stringify(path)},{method:${JSON.stringify(method)},headers:${JSON.stringify(headers)},redirect:'manual'});
const body=response.status===204?null:await response.json();
${finish("{status:response.status,body}")}
`,
    id,
  );
}

test("QR Auth0: generated browser, workload and user guards share identity across copies", async () => {
  await withApplication(
    "qr-auth0",
    ["browser-session", ...Array(3).fill("verified-identity"), ...Array(4).fill("module-stub")],
    async (app) => {
      await app.compose([
        "up",
        "-d",
        "--no-deps",
        "--scale",
        "app-browser-api=2",
        "app-browser-api",
      ]);
      const copies = await healthyCopies(app, "app-browser-api", 2);
      const [first, second] = copies;
      if (!first || !second) throw new Error("Two independent browser copies required");
      const guest = await browser(app, "/modules/account/link");
      expect(guest).toEqual({ status: 200, body: { subject: null } });
      expect((await browser(app, "/modules/account")).status).toBe(401);
      const invalidCookie = await browser(app, "/modules/account/link", {
        cookie: "__Host-jeeves-sign-in-session=invalid",
      });
      expect(invalidCookie.status).toBe(401);

      const alice = await auth0Login(app, "alice");
      const bob = await auth0Login(app, "bob");
      expect(alice.subject).toBe("auth0|alice");
      expect(bob.subject).toBe("auth0|bob");
      const owner = { status: 200, body: { subject: "auth0|alice", plan: "fixture" } };
      const aliceHeaders = { cookie: alice.cookie };
      expect(await browser(app, "/modules/account", aliceHeaders, first.Id)).toEqual(owner);
      expect(
        (await browser(app, "/modules/account", { cookie: bob.cookie }, second.Id)).status,
      ).toBe(404);
      expect(await browser(app, "/modules/account/link", aliceHeaders)).toEqual({
        status: 200,
        body: { subject: "auth0|alice" },
      });

      const matrix = await native<Record<string, number>>(
        app,
        "app-browser-api",
        `
const t=await(await fetch('http://auth0-issuer:9080/checks')).json();
async function check(machine,user,path='/internal/modules/billing-data') {
  const response=await fetch('http://app-billing-api:3000'+path,{headers:{
    ...(machine?{'x-jeeves-workload':'Bearer '+machine}:{}),...(user?{authorization:'Bearer '+user}:{})
  }});await response.arrayBuffer();return response.status;
}
const matrix={
  both:await check(t.allowedMachine,t.user),
  noUser:await check(t.allowedMachine),
  noMachine:await check(null,t.user),
  otherAudience:await check(t.allowedMachine,t.otherAudience),
  expired:await check(t.allowedMachine,t.expired),
  wrongCaller:await check(t.wrongCaller,t.user),
  wrongMachineAudience:await check(t.wrongAudienceMachine,t.user),
  machineAsUser:await check(t.allowedMachine,t.machineOnUserAudience),
  userAsMachine:await check(t.user,t.user),
  smallBearerUse:await check(null,t.user,'/modules/billing-api-user/me'),
};
${finish("matrix")}
`,
      );
      expect(matrix).toEqual({
        both: 200,
        noUser: 401,
        noMachine: 401,
        otherAudience: 401,
        expired: 401,
        wrongCaller: 403,
        wrongMachineAudience: 401,
        machineAsUser: 401,
        userAsMachine: 401,
        smallBearerUse: 200,
      });
      app.record({ name: "independent user and caller", matrix });

      const ageAlice = () =>
        app.sql(
          "UPDATE jeeves.browser_sessions SET access_expires_at=clock_timestamp()-interval '1 second' WHERE subject='auth0|alice' AND revoked_at IS NULL",
          "d_sessions",
        );
      await ageAlice();
      const before = await auth0Stats(app);
      const outcomes = await Promise.all(
        copies.map((copy) => browser(app, "/modules/account", aliceHeaders, copy.Id)),
      );
      expect(outcomes).toEqual([owner, owner]);
      const after = await auth0Stats(app);
      expect(after.refreshes - before.refreshes).toBe(1);
      expect(after.rotations - before.rotations).toBe(1);
      const generation = await app.sql(
        "SELECT refresh_generation||'|'||refresh_uncertain FROM jeeves.browser_sessions WHERE subject='auth0|alice'",
        "d_sessions",
      );
      expect(generation).toBe("1|false");
      app.record({
        name: "refresh shared between browser copies",
        copies: copies.map((copy) => copy.Id),
        refreshes: after.refreshes - before.refreshes,
        rotations: after.rotations - before.rotations,
        generation,
      });

      await command("docker", ["restart", second.Id], { timeoutMs: 30000 });
      await healthyCopies(app, "app-browser-api", 2);
      expect(await browser(app, "/modules/account", aliceHeaders, second.Id)).toEqual(owner);
      expect((await auth0Stats(app)).refreshes).toBe(after.refreshes);

      await ageAlice();
      await auth0Mode(app, "temporary");
      const unavailable = await browser(app, "/modules/account", aliceHeaders, first.Id);
      expect(unavailable.status).toBe(503);
      expect((await browser(app, "/modules/sign-in/session", aliceHeaders, second.Id)).status).toBe(
        200,
      );
      await auth0Mode(app, "normal");
      expect(await browser(app, "/modules/account", aliceHeaders, second.Id)).toEqual(owner);
      app.record({
        name: "restart and temporary issuer failure",
        restart: 200,
        issuerFailure: unavailable.status,
        recovered: 200,
      });

      const loggedOut = await native<{ status: number; provider: number; returnTo: string | null }>(
        app,
        "app-browser-api",
        `
const response=await fetch('http://127.0.0.1:3000/modules/sign-in/logout',{method:'POST',headers:${JSON.stringify(
          {
            ...aliceHeaders,
            origin: "https://browser.test",
            "x-csrf-token": alice.csrf,
          },
        )}});
const {logoutUrl}=await response.json();
const end=await fetch(logoutUrl,{redirect:'manual'});await end.arrayBuffer();
${finish("{status:response.status,provider:end.status,returnTo:end.headers.get('location')}")}
`,
        first.Id,
      );
      expect(loggedOut).toEqual({ status: 200, provider: 302, returnTo: "https://browser.test/" });
      expect((await auth0Stats(app)).logouts).toBe(1);
      expect((await browser(app, "/modules/account/link", aliceHeaders, second.Id)).status).toBe(
        401,
      );
      expect(
        await app.sql(
          "SELECT count(*) FROM jeeves.browser_sessions WHERE subject='auth0|alice' AND revoked_at IS NULL",
          "d_sessions",
        ),
      ).toBe("0");
      app.record({
        name: "logout shared revocation",
        loggedOut,
        retiredCookie: 401,
        activeSessions: 0,
      });

      // The issuer rotated Bob's credential but its reply omitted the replacement.
      await app.sql(
        "UPDATE jeeves.browser_sessions SET access_expires_at=clock_timestamp()-interval '1 second' WHERE subject='auth0|bob' AND revoked_at IS NULL",
        "d_sessions",
      );
      await auth0Mode(app, "missing-replacement");
      const beforeFault = await auth0Stats(app);
      const bobHeaders = { cookie: bob.cookie };
      expect((await browser(app, "/modules/account/link", bobHeaders, first.Id)).status).toBe(503);
      const afterFault = await auth0Stats(app);
      expect(afterFault.rotations - beforeFault.rotations).toBe(1);
      expect(
        await app.sql(
          "SELECT refresh_generation||'|'||refresh_uncertain FROM jeeves.browser_sessions WHERE subject='auth0|bob'",
          "d_sessions",
        ),
      ).toBe("0|true");
      await auth0Mode(app, "normal");
      expect((await browser(app, "/modules/account/link", bobHeaders, second.Id)).status).toBe(503);
      expect((await auth0Stats(app)).refreshes).toBe(afterFault.refreshes);
      app.record({
        name: "missing refresh replacement",
        rotations: 1,
        repeatedGrants: 0,
        durableUncertainty: true,
      });
    },
    "design.json",
    { beforeStart: prepareAuth0 },
  );
});
