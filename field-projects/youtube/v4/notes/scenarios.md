# YouTube v4: acceptance by API, then two copies

**The run:** PF12 of the [production foundations plan](../../../../docs/plans/production-foundations/units.md),
2026-11-12 (UTC 2026-11-13), on `git archive` of `app/` at `8e6bfbc` outside the checkout
(`jeeves-pf12`, loopback 45800 HTTP, 45801 identity, 45802 objects). Every step was taken by API
through the edge with `pf.mjs` and V3-17's `upload.mjs`. The raw outputs are in the
[evidence](../../../../docs/plans/production-foundations/evidence/pf12/README.md). No app or
generated file was changed for this run.

**Setup.** `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm build`, `pnpm first-run`
(131 s, building both images) and `node scripts/accounts.mjs` (creator, other-creator and viewer
created) all exit 0. 15 containers healthy: the 9 `app-*` and 6 providers.

**Result.** Every step of both parts was observed. The stack was left running with two copies
of each of the eight application processes (23 containers, all healthy, 0 restarts) for PF13.

## Part A — one copy of each process

| Step | Verdict | What was seen |
| --- | --- | --- |
| A1 Sign-in routes | **Observed** | With the creator's and the viewer's token, all three `me` routes answer 200 with that `username`. Without a token, Watch's answers 200 `{"signedIn":false}`; Upload's and Account's answer 401 `SIGN_IN_REQUIRED` |
| A2 Upload to ready | **Observed** (the 404s not recorded) | Start 200, three signed part URLs 200, three part PUTs 200 (5,242,880 / 5,242,880 / 5,099,193 bytes), complete 200 with `state: "pending"`. Details 200 after 4,055 ms (reads every 2 s). `pf.mjs`'s `poll` keeps only its last read, so the earlier reads are known only not to be 200. The asset went pending 03:10:35.06 → processing 03:10:35.82 → ready 03:10:38.68. This video is **A** |
| A3 Details and cache | **Observed** | 200, 200; `EXISTS ready-video:v1:<A>` prints 1 |
| A4 One play, sent twice | **Observed** | Both POSTs 202 (`playStatuses` `[202]`); `before` 0, `expected` 1, `after` 1 (visible after 255 ms), `settled` 1: the resent play counted once |
| A5 Search | **Observed** | 200 with A as the one hit (`found` 1, `total` 1) after 989 ms |
| A6 Favorites | **Observed** | PUT 200, GET 200, the list 200 with A (`listed` true), DELETE 204; PUT without a token 401 |

## Part B — two copies

The plan's `docker compose --profile application up -d --no-recreate --no-deps --scale …=2 …`
exits 0 and starts eight new containers; no setup job ran again. `docker compose --profile '*' ps`
showed 23 containers, every one healthy, 11 s after the command started.

| Step | Verdict | What was seen |
| --- | --- | --- |
| B1 Repeated reads | **Observed** | Details 20 × 200. 20 searches: each 200 with A as the one hit, found on the first read (27–37 ms). 20 favorites runs: each PUT 200, GET 200, list 200 with A, DELETE 204, anonymous PUT 401. Both copies of Watch, Search and Account received traffic (network I/O of the second copies: 26, 34 and 116 kB) |
| B2 One Watch copy stopped | **Observed** | `docker stop jeeves-pf12-app-watch-api-1` took under a second; 11 s later, details 20 × 200. Started again; stopping `-2` at once (while `-1` was still `starting`), then 11 s later, details 20 × 200. Started again; both healthy, 0 restarts |
| B3 Fifty plays, each sent twice | **Observed** | 100 POSTs, all 202. `before` 1, `expected` 51, `after` 51 (visible after 260 ms), `settled` 51. The database holds 51 receipts and a total of 51. Both View counter copies received traffic |
| B4 A new upload | **Observed** | The upload's 200s as in A2, so **B** is created; details 200 after 4,050 ms; search 200 with B as the one hit (`found` 1) after 1,028 ms; `select count(*) from published.videos where video_id='<B>'` prints 1. Transcoder copy 1 encoded B (and A); copy 2 took no job |

**At the end:** 23 containers, all healthy, 0 restarts, and no line containing "error" in any
`app-*` container's log.

**Not shown by this run:** the details' 404 while a video is not yet ready (above), and a job on
the second Transcoder copy. Faults and a throughput sample are PF13's.
