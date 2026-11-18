# Generic Jeeves webhook v1

This protocol is generated only by `webhook-receiver` in a Service with writable owned database
state and Runnable processes. Every Service copy runs its lifecycle-owned durable processor even
without new HTTP requests. A Required-user Auth guard in that Service refuses composition; use a
separate Service. This is generic HMAC, not Stripe or another provider's signature protocol.

## Exact signed envelope

POST only to `/modules/<stable-module-id>` (through the local public edge, `/api/<service-id>/modules/<module-id>`).
Send one each of these headers; names are HTTP case-insensitive, values are exact:

| Header | Value |
| --- | --- |
| `X-Jeeves-Timestamp` | Positive Unix seconds, canonical decimal, 1–12 digits, no leading zero, sign, fraction or whitespace. |
| `X-Jeeves-Signature` | `v1=` followed by exactly 64 lowercase hexadecimal characters. |

Repeated/combined/array headers refuse. The receiver accepts a timestamp only when its absolute
past/future difference from `floor(Date.now()/1000)` is at most the configured 30–300 seconds
(default 300). Keep sender/receiver clocks synchronized within that window.

The RG08 private ring contains 1–8 unique `{id,key}` entries; key is canonical unpadded base64url
for 32–4096 high-entropy bytes, and the entire file is at most 64 KiB. For each retained key, derive 32
bytes using HKDF-SHA256 with input key material equal to those decoded key bytes, salt equal to
UTF-8 `jeeves.keys.v1`, and info equal to these exact UTF-8 bytes:

```text
["sign","jeeves.webhook.v1"]
```

HMAC-SHA256 with that derived key signs this byte concatenation:

```text
UTF8("jeeves-webhook-v1\n" + stableModuleId + "\n" + exactTimestampHeader + "\n") || rawBodyBytes
```

The `\n` represents a single LF byte (`0a`). No trailing delimiter is added. No JSON
canonicalization, whitespace/number rewriting, Unicode normalization, decompression or BOM removal
occurs. The sender uses one chosen ring key; the receiver computes every retained key's digest
and constant-time compares all 32 digest bytes without a matching-key early exit. Removing a key
refuses its signatures. Rotation takes a private-file update and restart of each copy.

For `receive-events`, provision `SECRET_DIR/jeeves-webhook-receive-events-keys`
(`/run/secrets/jeeves-webhook-receive-events-keys` by default), or set the absolute-path override
`JEEVES_SECRET_JEEVES_WEBHOOK_RECEIVE_EVENTS_KEYS_FILE`. Other module names uppercase and replace
hyphens with underscores for the setting name `JEEVES_WEBHOOK_<MODULE>_KEYS`; default filenames
lowercase and replace underscores with hyphens. Add the private secret/file mount in a local
Compose override. No key is exported in diagram settings, product dependencies or generated files.
Receiver-ID framing prevents another module accepting a signature merely because it shares a ring.

[The fixed vector](../../../../../field-projects/generator-system/fixtures/rg-webhook/signed-vector.json)
was computed independently in Python using HMAC-based HKDF extraction/expansion. The focused test
compares its UTF-8/CRLF/whitespace/1.0 bytes and digest, and rejects reserialized JSON.

## Acceptance, conflicts and processing

The finite Body limit choices are 1024,16384 and65536 raw bytes (default 65536). The HTTP parser bounds
buffering, including streamed bodies. Authentication precedes UTF-8 decoding, JSON parsing and the
pure synchronous `.mapping.hooks.ts` mapper. The mapper validates product data and returns exact
`{id,type,payload}`: id is 1–255 printable ASCII without spaces, type is 1–128 letters/digits/dot/
underscore/colon/hyphen beginning with a letter/digit, and payload is bounded JSON. Shared DTO limits
also apply: 64 KiB serialized,16KiB per string,4096 nodes,16 levels,1024 array members.

The opaque `defineWebhookWork` declaration exposes no `accept`/`status` method. Its engine bridge,
verifier, raw-content hash, database, ACK and retry bookkeeping remain private generated code.
Only the authenticated route admits work. The mapper gets no dependency/client/key/ACK/lease
handle. `complete` gets immutable mapped event facts, scoped registered same-database commands,
empty account facts and optional safe declared remote results. Existing product roles, command
actual-promise drain and final holder/fence/unexpired DB-time lease checks commit atomically.

| Outcome | Response/state |
| --- | --- |
| Bad/tampered/stale/missing envelope |401 `WEBHOOK_AUTHENTICATION`, `WWW-Authenticate: Jeeves-HMAC`; no decoding/mapping/storage. |
| Body over configured limit |413 before mapper/storage. |
| Signed invalid UTF-8/JSON/event/mapper |400; no acceptance. |
| Durable acceptance COMMIT succeeds |202 `{accepted:true,id}`; business completion may follow later. |
| Same retained event identity and same raw bytes/mapping |Same202 acceptance, including after completion/failure; no new work generation. |
| Changed raw bytes/mapping/declared remote input under retained identity |409 `WORK_IDENTITY_CONFLICT`; original row remains unchanged. No quarantine copy of the conflicting body. |
| Storage outage or ambiguous COMMIT |503, never an early2xx; retry the same body/id. A committed ambiguous insert is found on redelivery. |
| Processing transient failure |Generated bounded backoff and reclaim/retry, up to four attempts. |
| Exhausted processing failure |Durable `failed` / `WORK_ATTEMPTS_EXHAUSTED`; fixed safe failure logs. |

Signature timestamp is excluded from raw-content identity. A legitimate delivery retry outside the
signature window must use a fresh timestamp/signature over unchanged body bytes. Even equivalent
JSON encoded with different whitespace/number spelling conflicts under one retained ID.

The inbox is the existing protected052 `jeeves.work_records` namespace bound to database/logical
owner/private `webhook-v1` domain/compiled receiver-module ID/application work ID. The private
registration cannot be selected by public generic work; copying its ID cannot insert/claim an
inbox. Two receiver modules also remain distinct when their application work IDs are copied.
Ordinary RG15/16 namespaces/configurations stay unchanged. No accepted052 migration is changed and no parallel inbox/lease framework
is introduced. Accepted/unfinished/failed/unknown rows survive cleanup. Completed rows retain
identity for seven days after completion; bounded independent sweeps may delete them afterward.
A subsequent delivery can then create a fresh acceptance generation/effect. Limit the sender's
replay/delivery horizon to this retention or supply application-owned permanent product dedupe;
this is not forever dedupe. Terminal recovery/configuration changes require explicit operator
reconciliation/draining/migration, with no public reset/replay/admin UI.

Remote work is supported only through RG15's actual authenticated generated workload target and
explicit workload-only callee opt-in. Execution/recovery stays bound to the compiled executing
Service process identity; another logical-owner role cannot take over its remote authority.
Tickets/canonical input persist before dispatch; selected missing/expired tickets never reopen
mutation after replay cleanup. Required-user targets, arbitrary providers and declared secret
checkpoint results refuse under the existing limits. No separate receiver-to-Worker handoff,
credential merging, account impersonation, cross-database atomicity or exactly-once remote claim.
