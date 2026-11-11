// YouTube v3's local accounts (V3-13): the realm role `creator`, the creators `creator` and
// `other-creator`, and `viewer` without the role, made through Keycloak's admin API. This is
// operator setup for the local demo, not an app feature: there is no sign-up. Run it after
// `pnpm first-run` with the stack up: `node scripts/accounts.mjs`. Passwords are generated here
// and kept only in `.runtime/secrets/<user>_password` (0600). Re-running keeps every account
// and password and only adds what is missing.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { plan } from "./common.mjs";

const ROLE = "creator";
const USERS = [
  { username: "creator", file: "creator_password", creator: true },
  { username: "other-creator", file: "other_creator_password", creator: true },
  { username: "viewer", file: "viewer_password", creator: false },
];

const statePath = ".runtime/local-setup.json";
if (!existsSync(statePath)) throw new Error("Run pnpm first-run first: no .runtime yet.");
const state = JSON.parse(readFileSync(statePath, "utf8"));
if (!state.done?.includes("initialized"))
  throw new Error("First initialization is incomplete; finish pnpm first-run first.");
if (plan.identity.length !== 1) throw new Error("Expected exactly one Identity in infra/local.json.");
const [identity] = plan.identity;
const realm = encodeURIComponent(identity.id);
const base = `http://127.0.0.1:${state.ports.LOCAL_IDENTITY_PORT}`;

async function call(path, options = {}, expected = [200]) {
  const response = await fetch(base + path, { ...options, signal: AbortSignal.timeout(10000) });
  if (!expected.includes(response.status))
    throw new Error(`${options.method ?? "GET"} ${path.split("?")[0]} answered ${response.status}`);
  return response;
}
const token = await call("/realms/master/protocol/openid-connect/token", {
  method: "POST",
  body: new URLSearchParams({
    client_id: "admin-cli",
    grant_type: "password",
    username: "admin",
    password: readFileSync(`.runtime/secrets/${identity.admin}`, "utf8").trim(),
  }),
}).then((r) => r.json());
const headers = {
  Authorization: `Bearer ${token.access_token}`,
  "Content-Type": "application/json",
};
const admin = `/admin/realms/${realm}`;
const json = (path) => call(admin + path, { headers }).then((r) => r.json());

// The role: created once, then reused.
const existingRole = await call(`${admin}/roles/${ROLE}`, { headers }, [200, 404]);
if (existingRole.status === 404)
  await call(
    `${admin}/roles`,
    { method: "POST", headers, body: JSON.stringify({ name: ROLE, description: "Uploads videos." }) },
    [201],
  );
const role = await json(`/roles/${ROLE}`);

const summary = [];
for (const user of USERS) {
  const passwordPath = `.runtime/secrets/${user.file}`;
  const found = await json(`/users?exact=true&username=${encodeURIComponent(user.username)}`);
  let id = found[0]?.id;
  let created = false;
  if (!id) {
    // A password file without its account is a run interrupted before the account: reuse it.
    if (!existsSync(passwordPath))
      writeFileSync(passwordPath, randomBytes(24).toString("base64url"), {
        mode: 0o600,
        flag: "wx",
      });
    const response = await call(
      `${admin}/users`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: user.username,
          enabled: true,
          emailVerified: true,
          email: `${user.username}@example.invalid`,
          firstName: "Local",
          lastName: user.username,
          credentials: [
            {
              type: "password",
              value: readFileSync(passwordPath, "utf8").trim(),
              temporary: false,
            },
          ],
        }),
      },
      [201],
    );
    id = response.headers.get("location")?.split("/").at(-1);
    if (!id) throw new Error(`Keycloak gave no ID for ${user.username}.`);
    created = true;
  } else if (!existsSync(passwordPath))
    throw new Error(
      `${user.username} exists without ${passwordPath}; set its password in the identity console.`,
    );
  const roles = (await json(`/users/${id}/role-mappings/realm`)).map((r) => r.name);
  if (user.creator && !roles.includes(ROLE))
    await call(
      `${admin}/users/${id}/role-mappings/realm`,
      { method: "POST", headers, body: JSON.stringify([role]) },
      [204],
    );
  if (!user.creator && roles.includes(ROLE))
    throw new Error(`${user.username} must not have the ${ROLE} role; remove it in the console.`);
  summary.push({ username: user.username, creator: user.creator, created, passwordPath });
}
console.log(JSON.stringify({ realm: identity.id, role: ROLE, users: summary }, null, 2));
