# RG21 forwarding contract

Browser session callers can invoke only compiled route-operation roots on a declared Service
callee with a bearer Auth guard bound to the same installed Keycloak Identity. Both processes
also need their independent RG09 workload slots. Cookie-session callees, undeclared recipients,
missing/mismatched user verification, unavailable template operations and background user
authority refuse. Normal mouse/chat connections and export use the same identity refusal.
Display-label changes preserve target and operation IDs. There are no new normal controls.

`dependencies.<service>.operations.<module>.read(headers?)` is a generated GET root with no body
or key. Both caller and callee run under read effect authority; product SQL commands, publisher,
cache/object/search mutations and nested mutation capabilities refuse. `mutate(body, key?)` uses
POST. Existing API8 `call(operation: string, request)` bodies remain supported and dynamically
checked against the compiled operations, while new operation properties enumerate actual IDs.
Input/output share the existing bounded normalized JSON@1 contract:64KiB,4096 nodes,16 levels,
1024 array elements and16384-byte strings, with no accessors/nonfinite values/cycles. Product
DTO shape/policy remains application-owned in `src/contracts/` and the route's normal entrypoint.

The private Browser session bridge lives in a WeakMap against the runtime operation context.
It captures the authenticated cookie hash/authority, not browser credential headers. Nested
request budgets inherit it; independent process/work scopes do not. Access-token availability
uses RG20's existing coordinator and rechecks live session/authority/keys/store-time expiry.
Pinned JOSE validates the selected Keycloak access JWT against the exact HTTPS issuer, its
OIDC-discovered JWKS, compiled `<identity>-web` audience, stored subject and absence of workload
claims. Products receive immutable caller facts/results only; private access/refresh credentials
are never fields on hooks, public contexts or logs. Callee verifier/workload authentication
remain independent. Copied browser headers cannot establish workload identity.

Register the browser confidential client's audience mapper for `<identity>-web`. When supplied,
its optional authorization audience must match. Session callees require that compiled user
audience and an HTTPS `/realms/<identity>` issuer; configure both processes to the exact same
issuer. The selected Identity/client/HTTPS integration remains an explicit export gap. Local
plain-HTTP defaults do not satisfy it. Exact pins remain openid-client6.8.9/JOSE6.2.13 and scoped
oauth4webapi3.8.8. Access JWT verification uses JOSE's bounded32-pending private transport and
60s JWKS cache/30s unknown-key cooldown, without a new provider or hand-written protocol verifier.

Request headers are only Accept, If-Match, If-None-Match and If-Modified-Since. The optional key
is a separate bounded visible-ASCII field. Content-Type, Authorization, Cookie, Host, workload,
correlation and budget headers are generated and cannot be supplied by product/browser input.
Response headers are only ETag, Allow, JSON content-type and Retry-After. Values are printable
ASCII, at most2048 bytes each and8192 total; case-insensitive duplicate names, accessors, arrays
and controls refuse. Content-type is JSON framing; no redirects are followed. Unknown response
headers/credentials and private authentication/outcome markers never become product headers.

A genuine result is immutable. Product route maps and composite responses stay application-owned;
`serviceResponse(result, body?)` retains its status and verified finite metadata while composing
a bounded body. A fabricated result refuses. Directly returning a generated result or this
composed result preserves safe error metadata through the shared HTTP formatter. Definite503
admission preserves its Retry-After,405 preserves Allow, and auth errors retain finite headers;
product error bodies are sanitized. Arbitrary product429/503 cannot invent retry provenance.
Possibly performed POST5xx/malformed/lost transport responses remain outcome-unknown.

Only a generated pre-product user-verifier401 carrying private authentication-refusal provenance
is eligible for one GET refresh/retry. Workload401/403, product-crafted401, dependency refusal,
network/unknown outcomes and every POST remain single-attempt. A rejected fresh-looking generation
is passed to the per-session coordinator: exactly that generation is rotated, while an already
committed newer generation is reused. Durable pre-dispatch uncertainty/attempt markers, original
caller gate and independent bounded completion remain RG20's rules. There is no third attempt,
issuer callback retry or retry to another target. Every dispatch recomputes RG03 remaining time
after authentication, refresh and any internal preparation; no monotonic timestamp crosses hosts.

RG21 supplies no automatic mutation replay. A key on generic POST does not prove idempotency or
recovery. Supporting mutation refresh/retry would require an actual generated replay/recovery
binding; this unit makes no such claim. No QRWTY routes, subscription/deletion policy, generic
proxy, user delegation or background stored bearer is generated. Native composed two-copy and
process-kill proof remains at the later assigned checkpoint.
