// Test infrastructure only: trusted TLS ingress to the task's native Keycloak and finite faults.

import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const root = "/rg";
const issuer = "https://rg-issuer:8443";
const credential = readFileSync(root + "/browser-secret", "utf8").trim();
let rotations = 0,
  refreshes = 0,
  healthy = false;
const controller = () => JSON.parse(readFileSync(root + "/control.json", "utf8"));
async function provision() {
  const admin = readFileSync("/run/secrets/identity-admin-sign-in", "utf8").trim();
  const tokenReply = await fetch(
    "http://identity-sign-in:8080/realms/master/protocol/openid-connect/token",
    {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "admin-cli",
        username: "admin",
        password: admin,
      }),
    },
  );
  if (tokenReply.status !== 200) throw Error("Task admin issuance failed");
  const token = (await tokenReply.json()).access_token;
  const headers = { authorization: "Bearer " + token, "content-type": "application/json" };
  const base = "http://identity-sign-in:8080/admin/realms/sign-in";
  const update = await fetch(base, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      revokeRefreshToken: true,
      refreshTokenMaxReuse: 0,
      accessTokenLifespan: 300,
    }),
  });
  if (update.status !== 204) throw Error("Task realm rotation policy failed");
  const result = await fetch(base + "/clients", {
    method: "POST",
    headers,
    body: JSON.stringify({
      clientId: "jeeves-browser-browser-session",
      publicClient: false,
      secret: credential,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: false,
      redirectUris: ["https://browser.test/modules/session/callback"],
      webOrigins: ["https://browser.test"],
      attributes: { "pkce.code.challenge.method": "S256" },
      protocolMappers: [
        {
          name: "browser-audience",
          protocol: "openid-connect",
          protocolMapper: "oidc-audience-mapper",
          config: {
            "included.custom.audience": "sign-in-web",
            "id.token.claim": "false",
            "access.token.claim": "true",
          },
        },
      ],
    }),
  });
  if (![201, 409].includes(result.status)) throw Error("Task browser client registration failed");
  healthy = true;
}
const proxy = https.createServer(
  { key: readFileSync(root + "/server.key"), cert: readFileSync(root + "/server.crt") },
  async (req, res) => {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      const rotating =
        req.url.endsWith("/token") &&
        new URLSearchParams(body.toString()).get("grant_type") === "refresh_token";
      const mode = controller().mode;
      if (rotating) {
        refreshes++;
        if (mode === "temporary") {
          res.writeHead(503, { "content-type": "application/json" });
          res.end('{"error":"temporarily_unavailable"}');
          return;
        }
        if (mode === "refused") {
          res.writeHead(400, { "content-type": "application/json" });
          res.end('{"error":"invalid_grant"}');
          return;
        }
      }
      const target = "http://identity-sign-in:8080" + req.url;
      const response = await fetch(target, {
        method: req.method,
        headers: {
          ...req.headers,
          host: "rg-issuer:8443",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "rg-issuer:8443",
        },
        ...(body.length ? { body } : {}),
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (rotating && response.status === 200) {
        rotations++;
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
      if (rotating && mode === "unknown") {
        req.socket.destroy();
        return;
      }
      const headers = Object.fromEntries(response.headers);
      delete headers["transfer-encoding"];
      delete headers["content-encoding"];
      delete headers["content-length"];
      if (response.headers.getSetCookie().length)
        headers["set-cookie"] = response.headers.getSetCookie();
      res.writeHead(response.status, headers);
      res.end(bytes);
    } catch {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    }
  },
);
proxy.listen(8443, "0.0.0.0");
http
  .createServer((_req, res) => {
    res.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ healthy, refreshes, rotations, issuer }));
  })
  .listen(9080, "0.0.0.0");
await provision();
