import type { NormalizedGenerationSelection, NormalizedProcess } from "@jeeves/spec";
import {
  camel,
  type Lead,
  type ProcessMount,
  resource,
  resources,
  service,
  text,
} from "./http-wiring.ts";

/** Append-only protected state. Applied050..053 and existing builders remain unchanged. */
export const browserSessionMigration = {
  id: "054-jeeves-browser-session.sql",
  sql: `CREATE SCHEMA IF NOT EXISTS jeeves;
REVOKE ALL ON SCHEMA jeeves FROM PUBLIC;
CREATE TABLE jeeves.browser_sessions (
 namespace text NOT NULL, authority text NOT NULL, cookie_hash text NOT NULL, subject text NOT NULL,
 email text, name text, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(), absolute_expires_at timestamptz NOT NULL,
 idle_seconds integer NOT NULL CHECK(idle_seconds BETWEEN 60 AND 86400), revoked_at timestamptz,
 access_sealed text, refresh_sealed text, id_sealed text, access_expires_at timestamptz,
 PRIMARY KEY(namespace,cookie_hash)
);
CREATE INDEX ON jeeves.browser_sessions(namespace,subject);
CREATE INDEX ON jeeves.browser_sessions(namespace,absolute_expires_at);
CREATE TABLE jeeves.browser_logins (
 namespace text NOT NULL, authority text NOT NULL, state_hash text NOT NULL, binding_hash text NOT NULL,
 sealed text NOT NULL, return_to text NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(namespace,state_hash)
);
CREATE INDEX ON jeeves.browser_logins(namespace,expires_at);
`,
};
/** Append-only refresh state;054 remains an immutable applied migration. */
export const browserRefreshMigration = {
  id: "055-jeeves-browser-refresh.sql",
  sql: `ALTER TABLE jeeves.browser_sessions ADD COLUMN refresh_generation bigint NOT NULL DEFAULT 0;
ALTER TABLE jeeves.browser_sessions ADD COLUMN refresh_uncertain boolean NOT NULL DEFAULT false;
ALTER TABLE jeeves.browser_sessions ADD COLUMN refresh_attempt text;
ALTER TABLE jeeves.browser_sessions ADD COLUMN refresh_attempt_until timestamptz;
`,
};
export function browserSessionMount(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
): ProcessMount {
  const name = camel(selection.id),
    state = resource(selection, "state");
  const namespace = JSON.stringify([
    state,
    selection.owner,
    "browser-v1",
    lead.module,
    selection.identity?.element,
  ]);
  const policy = {
    signIn: selection.inputs["session.signIn"],
    idleSeconds: selection.inputs["session.idleSeconds"],
    absoluteSeconds: selection.inputs["session.absoluteSeconds"],
    guestContext: selection.inputs["session.guestContext"],
    offlineAccess: selection.inputs["session.offlineAccess"],
  };
  const make = (pool: string, settings: string, issuer: string) =>
    `createBrowserSession({namespace:${text(namespace)},module:${text(lead.module)},scope,pool:${pool},settings:${settings},issuer:${issuer}})`;
  return {
    imports: [
      { from: "../runtime/browser-session.ts", name: "createBrowserSession" },
      { from: "../runtime/browser-settings.ts", name: "browserSettings" },
      { from: "../runtime/browser-oidc.ts", name: "createBrowserIssuer" },
      { from: resources, name: "selected" },
      { from: resources, name: "pool" },
    ],
    validation: [
      `const ${name}Settings = browserSettings(${text(lead.module)}, ${JSON.stringify({ realm: selection.identity?.element, client: `jeeves-browser-${process.tile}-${lead.module}` })}, ${JSON.stringify(policy)});`,
    ],
    setup: [
      `const ${name} = ${make(`pool(scope, selected("browser-session", ${text(selection.id)}), "state")`, `${name}Settings`, `createBrowserIssuer(${name}Settings)`)};`,
    ],
    configure: [`${name}.mount(open);`],
    initialize: [`await ${name}.start();`],
    started: [],
    guard: name,
    config: [selection.id, { template: "browser-session", lead: lead.module, ...policy }],
    routes: [
      {
        method: "GET",
        path: `/modules/${lead.module}/login`,
        answers: "302 OIDC code+PKCE; bounded relative returnTo",
      },
      {
        method: "GET",
        path: `/modules/${lead.module}/callback`,
        answers: "One-use browser/state/nonce-bound callback; fresh secure session",
      },
      {
        method: "GET",
        path: `/modules/${lead.module}/session`,
        answers: "Identity facts and CSRF only; supplied invalid/expired cookie401 and clear",
      },
      {
        method: "POST",
        path: `/modules/${lead.module}/logout`,
        answers: "CSRF-protected local session revocation204",
      },
    ],
    loops: [],
    template: {
      selection: selection.id,
      template: "browser-session",
      level: "mounted",
    },
    startup: {
      module: lead.module,
      checks: [
        "protected schema/grants",
        "HTTPS OIDC discovery; issuer outage refuses startup readiness/login",
      ],
    },
    service: { ...service(), sql: [state] },
    local: {
      logins: [{ resource: state, host: process.tile }],
      migrations: [browserSessionMigration, browserRefreshMigration].map((migration) => ({
        resource: state,
        ...migration,
      })),
      grants: ["browser_sessions", "browser_logins"].map((relation) => ({
        resource: state,
        host: process.tile,
        schema: "jeeves",
        relation,
        kind: "table",
        privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
      })),
    },
    operations: [
      {
        path: `src/operations/${process.tile}-${lead.module}-revoke-subject.ts`,
        ownership: "generated-scaffold",
        sourcePaths: ["/generation/processes"],
        content: `// Owning-service subject revocation. No account deletion or issuer administration.
import {createProcessLifecycle} from "../runtime/process.ts";
import {transaction} from "../runtime/transaction.ts";
import {browserSubject} from "../runtime/browser-session.ts";
import {selected,pool,validateTemplateSettings} from "../features/service-resources.ts";
const subject=process.argv[2];
if(!browserSubject(subject)||process.argv.length!==3)throw new Error("Expected one bounded subject");
const lifecycle=createProcessLifecycle({mark:()=>{}});
try {await lifecycle.start(async(scope)=>{validateTemplateSettings(${text(process.tile)});const db=pool(scope,selected("browser-session",${text(selection.id)}),"state");await transaction(db,tx=>tx.query("UPDATE jeeves.browser_sessions SET revoked_at=clock_timestamp(),access_sealed=NULL,refresh_sealed=NULL,id_sealed=NULL WHERE namespace=$1 AND subject=$2 AND revoked_at IS NULL",[${text(namespace)},subject]));});} finally {await lifecycle.close();}
`,
      },
    ],
  };
}
