# YouTube v3: independent review (V3-18)

Reviewed 2026-11-11 against the [plan](units.md)'s owner feedback 1–14, decisions D1–D8 and the
[contract](contract.md). Commits `5ee8c9d` (plan) to `a93c6a3` (V3-17), then `V3-18: review v3`.

**How.** I read the V3-01 to V3-17 evidence, then ran my own checks:

- **Browser:** my own API (4480, scratch database `jeeves_v318`, now dropped) and Vite (4490).
  Scripted Chromium, by mouse, at 1440×900 and 1280×800; keys only to type, and for feedback 1.
- **Projects:** a scratch copy of YouTube v3's saved design (the same document as
  `inputs/design.json`), plus seeded projects for fix 2.
- **No Docker run.** `app/` is unchanged. The generator's two changed files are now byte for
  byte `app/`'s, which V3-15 to V3-17 ran in Docker.
- **Owner's things untouched:** servers, stacks and projects (YouTube v3 included). The one
  Docker network I made for the flake experiment is removed.

Evidence: [v3-18](evidence/v3-18/README.md).

## The owner's feedback

| # | Feedback | Verdict | What I saw |
| --- | --- | --- | --- |
| 1 | Undo and redo keys | **Delivered** | Outside a field, Ctrl+Z, Ctrl+Shift+Z, Ctrl+Z and Ctrl+Y each moved Search API's description one step, at both sizes. In a field, Ctrl+Z left the design alone. |
| 2 | "Queue or topic" | **Delivered** | Upload jobs reads **Queue**. View events, Processing events and Publication events read **Topic**. |
| 3 | Kind labels | **Delivered** | Each tile checked shows its kind under its name (Database, Cache, Identity, Service, Uploads, Worker), and no name repeats it. The inspector and the link fan still say "Microservice" for a Service (follow-up 10). |
| 4 | A + inside the tile | **Delivered** | Detailed has 8 application containers and 8 `+`. Watch API's opens the menu (Template, Part of a template, Stub); a second click or Escape closes it. In Simple the selected tile has one ([1440](evidence/v3-18/v3-18-v3-module-menu-1440.png)). |
| 5 | The legend | **Delivered** | One dashed sample, "Async", and nothing to open. |
| 6 | Detailed and Simple | **Delivered** | The toggle reads Detailed, Simple; Detailed is the default. |
| 7 | Two tools | **Delivered** | Pointer and Connect; no Hand. |
| 8 | Watchers' identity | **Delivered** for YouTube | Viewer check's Sign-in is Optional; Account check and Creator check are Required. V3-17 saw signed-in and anonymous plays (S09). Marketplace's buyers and sellers: follow-up 3. |
| 9 | An inspector + | **Delivered** | The rail's `+` opens the same menu, fully left of the rail. A click away closes it and saves nothing. |
| 10 | A chat agent good at diagrams | **Partly** | The tools carry the knowledge (V3-09). The offline scripted runs still separate good from bad (100/100, 90.7, 1.7/5.6), and the recorded V3-10 report replays identically. Live, gpt-6-luna scored 0 and 50 (a malformed command failed its turn), and the build brief gives the answer away. V3-19 addresses both. |
| 11 | Two outputs | **Delivered** | `git diff d94b13a -- field-projects/youtube/v3/generated/` is empty. `app/` is the export plus 34 custom paths, which match `diff -rq` (V3-17). |
| 12 | YouTube v3 | **Delivered**, 3 scenarios partial | Simple shows 21 tiles (24 with the user and actions), 33 lines and 8 dashed ([1280](evidence/v3-18/v3-18-v3-simple-1280.png)). Preview gives 11 templates, 2 stubs, 0 findings, runnable, 112 files. S02, S04 and S08 are partial (gap 1). Listening to S05's tone is the owner's. |
| 13 | Favorites is generic | **Delivered** | Favorites is a Template in every Service's menu, with no YouTube words; Account API's Favorite videos uses it. Marketplace reuse is in the contract, not built (follow-up 3). |
| 14 | Chat makes or suggests edits, cheaply | **Partly** | As 10. Chat's surface is the mouse's (D6). |

## The decisions

| # | Decision | Verdict | What I saw |
| --- | --- | --- | --- |
| D1 | Writers own their tables; readers see `published` | **Delivered** | V3-05's Docker run. In v3, `published.videos` is the only read path: Watch API's and Account API's logins were refused on `assets` (V3-14). |
| D2 | Gates | **Held** | The off pin passes after one intended update (fix 1). Frozen v2: 70 of 72 files byte-identical, the manifest and report equal without inventory. v1 is byte-identical. The PNG gate was retired in V3-02. |
| D3 | The link fan by click | **Delivered** | Search API's "Add linked tile" opens the fan's 11 kinds; a second click closes it. Watch API, at the 5-link cap, offers none. |
| D4 | Optional sign-in and Favorites | **Delivered** | As 8 and 13. S09 and S10 were observed in full (V3-17). |
| D5 | Settings on process tiles | **Delivered**, now with a fix | A stub-only Service shows Request timeout and Concurrency limit while processes are on. An out-of-range saved value had no way back (fix 2). |
| D6 | Chat = mouse | **Delivered** for the surface | Same commands, kinds and catalog. Whether a cheap model is enough: V3-19. |
| D7 | The legend | **Delivered** | As 5. |
| D8 | The v3 layout | **Delivered** | `inputs/`, `diagrams/`, `notes/`, `generated/` and `app/`, as the contract says. |

## Fixes in this unit

1. **Template gap 6 is fixed in the generator.**
   - `module-clients.ts.template` and `dependencies.ts.template` now hold V3-15's two lines:
     `publish` takes an optional `messageId`, and `queuePublisher` sends it, else a fresh ID.
   - A fresh v3 export's two files are now byte for byte `app/`'s. `generated/` and `app/` are
     unchanged, and `custom-paths.md` and the notes say the generator matches.
   - Test: `module-clients.test.ts` sends one ID twice and gets the same message ID twice, and
     the emitted interface takes it. It fails on the old templates.
   - **Intended difference:** the processes-off pin changes `src/modules/dependencies.ts` (and
     the manifest's line for it) for the v2 module design and the stub stack. Frozen v2 doesn't
     emit that file and is unchanged.
2. **An out-of-range saved value can be put right by mouse and chat.** V3-10 found the dead
   end; it had two layers:
   - **The server wouldn't open the design.** Loading it threw (500), so neither the studio nor
     chat could reach it. `parseStoredDesign` (spec) now opens a stored design whose only
     problems are setting numbers outside their bounds. It keeps those values and shows their
     `CONFIG_INVALID` findings; anything else still fails loudly. Undo uses it too.
   - **The resolver hid every control,** this one included, because a refused model turned all
     controls off.
     - The control a finding names (an out-of-range, unsupported or disagreeing value) now
       stays, with its value. Process settings are worked out even without a model.
     - Every other control waits until the design is valid.
     - The edit still accepts only a supported value.
     - Chat's review now offers a checked command for a process's own setting: clear it, and
       the process runs its initial value.
   - **The allowlist holds** ([studio settings](../../studio-settings.md)): no new field or
     form. It is the same control, its value is preserved until the user changes it, and the
     same command serves mouse and chat.
   - **Tests:**
     - `process-settings.test.ts` +3: a process setting, a template's TTL with its mirror, and
       `parseStoredDesign`;
     - `studio-design-review.test.ts` +1;
     - `projects.test.ts` +1: a stored revision opens, is fixed, undone and still opens.
   - All the resolver and review tests fail without the fix.
   - **By mouse, at both sizes:** a seeded older revision with Links API's Request timeout at
     99999999 opens. Its Options show that field with "Too big: expected number to be
     <=300000" and nothing else ([before](evidence/v3-18/v3-18-out-of-range-before-1440.png)).
     Typing 5000 saved it, the finding went, and Concurrency limit came back
     ([after](evidence/v3-18/v3-18-out-of-range-after-1280.png)). Undo brought 99999999 back
     and it still opened; Redo fixed it again. No page or console error.
3. **The connection-dots flake: cause not proven.** The test is `connection-dots.spec.ts`'s "a
   dot drag held past the canvas edge pans", V3-15's `:208`, now `:223`.
   - **What I tried:**
     - **The camera wait (V3-16's change):** it can't be what fixed it. In this test Fit is a
       no-op: opening the inspector already refits the camera at once. In every run the camera
       after Fit equalled the final view, even with the old one-read wait and frames delayed by
       80 or 150 ms. The wheel zoom is immediate.
     - **Slow frames:** the edge pan moves at most 24 px a frame, and this geometry needs about
       100 px (5 frames). Under CPU throttling of 1×, 4×, 8× and 12× it always reached the
       target. Only frames over about 3 s would exhaust `holdPastEdge`'s 15 s.
     - **Real load:** the file's 3 tests 4 times each, beside 4 v2-rebuilds and 4 v3-builds,
       with 3 workers: 12 of 12 passed (4 of them this test). That run is otherwise void: I was
       editing spec files during it, and Vite reloaded the heavy builds' pages.
       A clean rerun, with no edits, passed 15 of 15: the file's 3 tests 3 times each, beside 3
       v3-builds and 3 v2-rebuilds.
     - **Host network changes:** I made and removed my own Docker network every 2 s during 8
       runs. Chromium aborted the page's own loopback module loads from Vite with
       `net::ERR_NETWORK_CHANGED`, and 1 run failed at page load. V3-15's own browser check saw
       that error during its Docker restarts. But this test makes no request during the drag;
       its only mid-test request is `/api/generation-support`, and aborting it doesn't stop the
       pan. So this explains one-off e2e failures in general, not this one.
   - **Repeat runs:** an instrumented copy of the test passed every run without the network
     flap (19). The real file passed 12 of 12 under load, then 15 of 15 (`--repeat-each=5`)
     after hardening, then the full run and 9 of 9 in the clean load rerun.
   - **Hardened, not weakened:**
     - Before aiming, it waits for still tiles (`stillBoard`, V3-14's remedy). The wheel zooms
       on the pointer only while the pointer is on a tile.
     - It asserts that the press lands on the module's dot inside the board, and that the move
       starts a connect drag.
     - So a recurrence names the step that broke, not just a 15 s pan timeout.

## Invariants

| Invariant | Result |
| --- | --- |
| Processes-off pin | **Passes after an intended update:** `dependencies.ts` and the manifest for the v2 module design and the stub stack (fix 1). Frozen v2 is unchanged. |
| Frozen v2 | **Holds:** a fresh `export:v2` gives 72 files, 70 byte-identical to `generic-export.tar.gz`, and the manifest and report equal under `provenanceWithoutInventory`. |
| v1 | **Byte-identical** (`assemble.test.ts`). |
| v3 `generated/` | **Unchanged.** A fresh export of `inputs/design.json` differs from it only in the two gap-6 files and their manifest lines. The report is equal without inventory, and both files equal `app/`'s. |
| v3 `app/` | **Unchanged**, so the benchmark (556 post-template lines, 91.75%) stands, and no new report was needed. |
| Offline chat evals | **Unchanged:** scripted good 100/100, patterns 90.7, bad 1.7/5.6. The recorded V3-10 report replays identically (21 cases). |
| Mouse and chat parity | **Holds:** the Options form and `getDesign.editableSettings` read the same `normalGenerationControls`, and both send `buildSupportedAuthoringCommand`. |

## The template gaps, ranked

Gaps 1–8 are in the [field project's notes](../../../field-projects/youtube/v3/notes/README.md#template-gaps-found-while-completing-app).

| Rank | Gap | Why this rank | The fix | Size |
| ---: | --- | --- | --- | --- |
| 1 | **1: multipart can't answer with the video's state** | The only gap that limits acceptance (S02, S04, S08) | Multipart's status, list and complete carry the asset lifecycle's state and failure code, for the upload's owner only, never through `published`. Complete answers 202. | Medium: two templates, wiring, tests and a Docker rerun of the three scenarios |
| 2 | **8: the export serves no browser** | Every field project with a user needs four scaffold edits | When a design has a user, emit a `public/` folder the edge serves at `/`, a browser build step, and the sign-in binding for the run's ports | Medium; it shapes the UI-builder direction |
| 3 | **5: a throwing hook while reporting a failure stops the Transcoder** | A bug in one hook takes the worker down and loops the job at every start | Catch it, dead-letter the job with the reason, and keep running | Small to medium |
| 4 | **2: a stuck completion blocks the next start** | "Application startup failed" with no reason | Log the reason, and mark the upload failed instead of failing startup | Small to medium |
| 5 | **3: the outbox retries a codec failure silently, for ever** | Invisible until someone looks at the table | Log each failure; dead-letter after the template's limit | Small |
| 6 | **4: lifecycle and Transcoder hooks get no key prefix** | Contracts repeat the compiled prefix | Pass `prefix` as multipart's hooks get it | Small |
| 7 | **7: the cache read's 404 can't be shaped** | Cosmetic: `NOT_FOUND` against v2's `VIDEO_NOT_READY` | An optional `missing` answer in the hooks | Small |
| — | **6: a stub publisher can't name its message ID** | **Fixed in V3-18** (fix 1) | — | — |

## Follow-ups, most important first

| # | Issue | Suggested next step | Owner decision? |
| --- | --- | --- | --- |
| 1 | **Template gap 1** (above). | Fix it in the template, then rerun S02, S04 and S08 by mouse. | No |
| 2 | **Chat on a cheap model** (feedback 10 and 14). Luna fails whole turns, and the brief leaks the design. | V3-19, as planned: neutral defaults, per-command errors, short-brief and non-YouTube cases, a leak check, Anthropic. Fix 2 makes the D5 case a usable review seed again. | Approved |
| 3 | **Marketplace revisit with buyer and seller accounts** (feedback 8, D4, contract §2–§3). The study refuses Runnable processes (pinned IDs). | Rebuild Marketplace by mouse as a module-built design: a Storefront API with an Optional guard; a Seller API with a Required guard whose hooks check a `seller` role; an Account API with Favorites over `published.listings`. Then run it as v3 was. | **Yes** (start it, and its scope) |
| 4 | **Template gap 8:** a browser in the export. | Generator work as ranked; decide with the UI builder. Until then UI stays outside the LOC measure. | **Yes** (with the UI builder) |
| 5 | **Gaps 5, 2 and 3:** failures that stop a process or retry silently. | One robustness unit: log the reason, dead-letter, and never fail startup on one bad row. | No |
| 6 | **Gaps 4 and 7.** | Small template changes, with gap 1's unit. | No |
| 7 | **Out-of-range values on two or more tiles** are still a dead end. Each tile edit carries the whole studio, and the operation schema refuses the other tile's value. One tile, or several values on one tile, now works. | Let an edit keep an existing out-of-range value it doesn't touch (refuse only new ones), or add a per-tile settings operation. Only older or hand-made designs reach it. | No |
| 8 | **The connection-dots flake** is unproven (fix 3), and host network changes break e2e runs. | Run e2e with Docker quiet: no compose up or down and no network changes until it finishes. If the dot test fails again, its new assertions name the step; keep its trace. | No |
| 9 | **Tiny targets at a large design's fit** (V3-11's first finding): v3's dots are 2–4 px and its `+` 6–9 px at the Detailed fit. | Grow the hit areas with zoom, or show `+` and dots larger on hover. | **Yes** (UX direction) |
| 10 | **"Microservice" against "Service":** the tile says Service, but the inspector and the fan say Microservice. | Use one word. | **Yes** (naming) |
| 11 | **S05's listening, and v1's encoder log** for S04's wording. | The owner listens ([review pack](../../../field-projects/youtube/v3/notes/review-pack.md)). The HLS template could log the encoder's command and stderr tail on failure. | Listening: owner |
| 12 | **TinyURL revisit** (tile-processes follow-up 9). | As Marketplace, after it. | **Yes** |

## Checks

- **`pnpm check`** exited 0: **754 tests in 104 files** (+6); lint shows only the existing info.
- **E2E: 80 passed (5.5 m)** on the first full run; `jeeves_e2e` holds only its TinyURL project.
- **Web build** passed (the existing chunk-size advisory).
- **Offline evals:** `pnpm eval:chat` is deterministic. Replaying `docs/evals/v3-10/scripted.json`
  gives identical designs and scores.
- **By mouse,** at 1440×900 and 1280×800, on my servers: the review pass above, 2 of 2, and
  fix 2's check, 2 of 2, with no page or console error. My scratch projects were deleted and the
  database dropped.

## Evidence

[v3-18](evidence/v3-18/README.md): four screenshots and the scripts behind them. Earlier units:
[v3-01](evidence/v3-01/) to [v3-17](evidence/v3-17/README.md).
