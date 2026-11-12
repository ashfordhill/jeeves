# V3-18 evidence: review v3

The [review](../../review.md) holds the verdicts, fixes, ranked gaps and follow-ups. This page
records how they were observed.

## Where

- **Servers:** my own API on 4480 (scratch database `jeeves_v318`, now dropped) and Vite on 4490.
  Both are stopped. Scripted Chromium, by mouse.
- **Projects** (all in the scratch database):
  - a copy of YouTube v3's saved design. It was seeded through my API with `seed-v3.mts`, and the
    saved document equalled `inputs/design.json`.
  - two stub-stack projects with Runnable processes on, built through my API. Each got one
    older-style revision written into the scratch database (`seed.mts`): Links API's Request
    timeout at 99999999, which the schema's bound refuses.
- **Not used:** the owner's servers, database and projects, and the owner's Docker stacks.
- **Docker:** one network of my own, `jeeves-v318-net`, for the flake experiment. The owner's 43
  containers, 18 volumes, 9 networks and 31 image rows match the record taken before.

## Screenshots

| File | What |
| --- | --- |
| [v3-18-out-of-range-before-1440.png](v3-18-out-of-range-before-1440.png) | The older revision opens. Links API's Options show only Request timeout, at 99999999, with "Too big: expected number to be <=300000". |
| [v3-18-out-of-range-after-1280.png](v3-18-out-of-range-after-1280.png) | After typing 5000: the finding is gone, and Concurrency limit is back with its placeholder 1000. |
| [v3-18-v3-module-menu-1440.png](v3-18-v3-module-menu-1440.png) | The v3 copy in Detailed: Watch API's `+` menu, grouped Template, Part of a template and Stub. |
| [v3-18-v3-simple-1280.png](v3-18-v3-simple-1280.png) | The v3 copy in Simple at 1280×800: 24 tiles, 33 lines, 8 dashed, and Watch API selected with its `+`. |

## The mouse passes

**`review.spec.ts`, 2 of 2 (1440×900, 1280×800), no page or console error.** It recorded:

```json
{"boardPluses":8,"menuGroups":3,"signIn":{"viewer":"Optional","account":"Required","creator":"Required"},
 "inspectorMenuLeftOfRail":true,"watchApiAtCapOffersNoLinkedTile":true,"fanItems":11,
 "undoRedoKeys":true,"ctrlZInFieldLeftDesign":true,"simple":{"tiles":24,"lines":33,"dashed":8},
 "simplePlus":1,"preview":{"findings":0,"runnable":true,"templates":11,"stubs":2,"files":112}}
```

Both sizes gave the same values.

**`out-of-range.spec.ts`, 2 of 2, no page or console error.** At each size, on its own seeded
project:

1. The project opens, and only Request timeout shows, at 99999999, with the reason.
2. Typing 5000 saves one revision, and the finding is gone.
3. Concurrency limit returns, with its placeholder 1000.
4. Undo restores 99999999, and the project still opens. Redo fixes it again.

## The flake experiment

`flake-instrumented.spec.ts` is the dot edge-pan test with logging. The scratch spec was in
`jeeves/apps/web/e2e/` while it ran, and was deleted after.

- **CPU throttling (whole test):**

  | Throttle | Pan, including the 8-step move and polling | Frames a second |
  | --- | --- | --- |
  | 1× | 0.6 s | 52 |
  | 4× | 2.7 s | 19 |
  | 8× | 9–10 s | 5 |
  | 12× | 14.8 s | 3.5 |

  Every run reached the target. The pan moves at most 24 px a frame. About 100 px were needed.
- **Delayed frames:** 0, 80 and 150 ms, with the old and the new camera wait. The camera after
  Fit equalled the final view every time, because opening the inspector had already refit it.
  The pointer was on the dot before the wheel, the press was the module's, and a connect drag
  started.
- **Docker network flap** (`netflap.mjs`, my network every 2 s): 8 runs, and 1 failed at page
  load. 22 requests to Vite on 127.0.0.1 failed with `net::ERR_NETWORK_CHANGED`.
- **What the test requests mid-test:** after load, only `GET /api/generation-support` when the
  inspector opens, then the operation `POST` on release. Aborting the first doesn't stop the pan.
- **Real load:** 12 of 12 passed beside v2-rebuild and v3-build, with 3 workers. That run's
  heavy-build failures were mine: I edited spec files while it ran, and Vite reloaded their
  pages. A clean rerun with no edits passed 15 of 15, the heavy builds included (5.5 m).
- **Hardened spec:** 15 of 15 with `--repeat-each=5`.

## Scripts

[scripts.tar.gz](scripts.tar.gz) holds:

- the two mouse passes and their Playwright config;
- the two seeding scripts;
- the instrumented flake spec and the network flap;
- `repin.ts`, which rewrote the processes-off pin and listed which files changed;
- `prov.ts`, which compares provenance without inventory.

They point at my scratch ports and database. No secret is in them.
