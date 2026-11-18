# RG20 evidence

Completed on accepted RG19 `21fb6ca`, with one local explicit-path RG20 commit. No later unit, forwarding, native matrix, owner studio/database, live issuer, paid call, push or deployment work.

- [Private protocol](protocol.md): committed attempt before dispatch, bounded per-session row lock,
  exact generation/authority/attempt fence and independent completion. Local identity remains
  independent of provider-token availability. No forwarding consumer, public refresh route,
  product handle, new normal setting, global lock or new service is added.
- Append-only055 preserves applied054. A successful rotation followed by storage rollback/death
  leaves the durable attempt uncertain. An expired marker never authorizes another POST. Lost
  successful COMMIT recovers the committed generation; credentials lost at the issuer cannot be
  manufactured by a lock or version. Reauthentication may be required.
- [Final full check](check-complete.txt): lint/types and143files/1328tests pass, including49 browser/session cases. Earlier focused46/46 and45/45 logs preserve incremental ordering checks. Actual emitted runtime is loaded with controlled PGlite SQL, private issuer seams and
  independently expected results. Cases cover independent coordinators, winner reuse, transient/
  definitive/unknown failures, durable attempt across completion rollback/restart, commit loss,
  disconnect, current-key retained material, expiry/revocation/removal fences, lock failure,
  pending-slot retention, hard connection deadline and shutdown.
- [Final actual export](compile-final-bound.txt), [runner](compile.ts): combined browser/product export
  uses actual extension checker and pinned TypeScript7.0.2. [Final standalone](standalone-final-bound.txt),
  [runner](standalone.ts) also compiles and proves product import of private browser-refresh is
  refused. Scratch exports use real offline pinned installs, with exact generated paths/pins logged.
- [Primary API review](primary-api.md), [final actual SDK proof](sdk-final-bound.txt), [runner](protocol.mjs):
  actual openid-client6.8.9 with signed RS256 HTTPS stand-ins,50 token POSTs, no automatic grant
  retry, bounded actual pending32, timeout/recovery, optional ID tokens and identity/error binding.
- [Off pins](pins-complete.txt), [bounded updater](pins.ts):80/87/60 files, unchanged emitted paths;
  only private transaction bound and extension guide/manifest hashes change. Dependencies unchanged.
- [Final web build](build-final.txt), plain [offline chat](offline-chat.txt), [full browser](e2e.txt)86/86 (both long rebuilds/TinyURL) and [final session mouse/export](mouse-final.txt)1/1 pass. No normal UI/control/command changes were added.
- [Actual pinned pg timer proof](driver-bound-final.txt), [runner](driver-bound.mjs): private query5500ms overrides2500ms pool default; a subsequent ordinary query still uses2500ms. This is an unconnected real-driver proof, not native Postgres lock certification.
- [Final preservation](preservation-complete.txt), [reproducible comparison](preservation.py), [container triples](docker-after.json): six original non-README root hashes, original28-path owner patch/archive mapping, all42 original containers, applied050–054, receipt/counter builders, generated dependency assets and frozenv1 match. Ongoing owner README edits are preserved/excluded; HEAD stayed21fb6ca before this commit, index empty before explicit staging.
- [Project inventory](project-inventory.txt) preserves two e2e projects from11/06 and11/12. [Unit-period project count](project-cleanup-final.txt) is0; only harness-created projects were deleted. No owner database or services were touched.

Earlier failure logs remain. Initial scratch invocation used unavailable root tsx, then actual
compile exposed missing private asset registration and an optional union return; both were fixed
and actual checker/TS proofs pass. Initial SDK stand-in expected503 ResponseBodyError; inspecting
pinned primary SDK code identified its positive Response-cause status path and the corrected
adapter/proof now distinguish temporary outage. Earlier ordering logs reflect iterative recovery
improvements, not a claim that same-transaction uncertainty survives rollback. No accepted earlier
unit evidence or historical output was edited.

The first full check had one untouched Board selected-chrome mount race (1326/1327); its focused15/15 rerun and repeated full143/1327 then passed. Final review identified the ordinary pg2500ms client timeout would preempt the private4500ms lock wait. A private5500ms per-query override corrected that without changing pool defaults; the final143/1328 run and mouse/actual exports above pass. The QueryConfig declaration omits this supported driver property, so the actual runtime-supported configuration uses a structural variable, verified against the real pinned driver and real TypeScript. A temporary test normalization typo affected one trace assertion during the timeout correction; it was fixed without weakening the assertion. Full86 browser source was frozen; the subsequent private runtime change received final focused export/mouse verification. No accepted historical evidence was rewritten.

Limits: post-rotation lost credentials may require a new login; neither row locks nor generations manufacture them. Known pre-dispatch abandonment is conservative if its marker survives a crash. Temporary failures preserve local sessions; unknown provider availability never becomes anonymous. Native two-process/Postgres and process-kill proof remains assigned to the later checkpoint. These are controlled SQL/ordering and real SDK/driver protocol proofs, not a claim of native competing-process certification.

Only this unit's newly added text logs have trailing spaces and excess blank EOF lines removed for Git whitespace checks. Assertion/result text is preserved; no earlier evidence was edited. Own log inspection found no NUL padding or large data-URL addresses to sanitize.
