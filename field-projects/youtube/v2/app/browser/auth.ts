declare global {
  interface Window {
    __LOCAL_VIDEO_CONFIG__: { issuer: string; clientId: string; callback: string };
  }
}
const { issuer, clientId, callback } = window.__LOCAL_VIDEO_CONFIG__;
const base = `${issuer}/protocol/openid-connect`;
interface Session {
  access: string;
  id: string;
  expiresAt: number;
}
interface Flow {
  state: string;
  nonce: string;
  verifier: string;
  created: number;
}
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
export function session(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem("auth") ?? "null") as Session | null;
    return s &&
      typeof s.access === "string" &&
      typeof s.id === "string" &&
      s.expiresAt > Date.now() + 5000
      ? s
      : null;
  } catch {
    return null;
  }
}
export function clearAuth() {
  sessionStorage.removeItem("auth");
}
export async function login() {
  const f: Flow = { state: random(), nonce: random(), verifier: random(), created: Date.now() };
  const challenge = encode(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(f.verifier))),
  );
  sessionStorage.setItem("oidc-flow", JSON.stringify(f));
  const u = new URL(`${base}/auth`);
  u.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    response_type: "code",
    scope: "openid profile",
    state: f.state,
    nonce: f.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  location.assign(u);
}
export async function finishLogin() {
  const q = new URLSearchParams(location.search);
  if (!q.has("code") && !q.has("error") && !q.has("state")) return;
  history.replaceState(null, "", "/");
  const raw = sessionStorage.getItem("oidc-flow");
  sessionStorage.removeItem("oidc-flow");
  clearAuth();
  let flow: Flow | undefined;
  try {
    flow = raw ? (JSON.parse(raw) as Flow) : undefined;
  } catch {}
  if (
    !flow ||
    flow.state !== q.get("state") ||
    !flow.verifier ||
    !flow.nonce ||
    Date.now() - flow.created > 600000 ||
    flow.created > Date.now()
  )
    throw new Error("Sign-in could not be verified. Please sign in again.");
  if (q.has("error") || !q.get("code"))
    throw new Error("Sign-in was cancelled or refused. Please try again.");
  const response = await fetch(`${base}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      redirect_uri: callback,
      grant_type: "authorization_code",
      code: q.get("code")!,
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Sign-in exchange failed. Please sign in again.");
  const t = (await response.json()) as {
    access_token: string;
    id_token: string;
    expires_in: number;
  };
  // Nonce binds this ID-token response to the one-use PKCE flow. /me verifies the access JWT server-side.
  let claims;
  try {
    claims = JSON.parse(atob(t.id_token.split(".")[1]!.replaceAll("-", "+").replaceAll("_", "/")));
  } catch {
    throw new Error("Sign-in response could not be verified.");
  }
  if (
    claims.nonce !== flow.nonce ||
    claims.iss !== issuer ||
    claims.aud !== clientId ||
    !claims.sub ||
    claims.exp * 1000 <= Date.now() ||
    typeof t.access_token !== "string" ||
    !Number.isFinite(t.expires_in) ||
    t.expires_in <= 0
  )
    throw new Error("Sign-in response could not be verified.");
  sessionStorage.setItem(
    "auth",
    JSON.stringify({
      access: t.access_token,
      id: t.id_token,
      expiresAt: Date.now() + t.expires_in * 1000,
    }),
  );
}
export function logout() {
  const s = session();
  clearAuth();
  sessionStorage.removeItem("oidc-flow");
  const u = new URL(`${base}/logout`);
  u.search = new URLSearchParams({
    client_id: clientId,
    post_logout_redirect_uri: callback,
    ...(s ? { id_token_hint: s.id } : {}),
  }).toString();
  location.assign(u);
}
