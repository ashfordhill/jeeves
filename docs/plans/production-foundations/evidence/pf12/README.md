# PF12 evidence: v4 with one and two copies

2026-11-12 (UTC 2026-11-13). [Plan](../../units.md#pf12--run-v4-acceptance-by-api-then-two-copies) ·
[scenarios](../../../../../field-projects/youtube/v4/notes/scenarios.md), which hold the verdicts.

**Setup.** `git archive HEAD:field-projects/youtube/v4/app` at `8e6bfbc` (134 files) in the
session scratchpad, with V3-17's [operator harness](../../../youtube-v3/evidence/v3-17/operator-harness.tar.gz)
beside it (`lib.mjs` and `upload.mjs` unchanged), [`pf.mjs`](pf.mjs) as the plan gives it and
[`env.sh`](env.sh) as the plan's four lines. Node 24.21.0, pnpm 12.16.1; Compose project
`jeeves-pf12` on 45800–45802, all free before. Media: v1's fixture (15,584,953 bytes, SHA-256
`16587281…aebf9`), copied read only.

**Video IDs.** A `5a074d41-736c-4736-aa05-865edc3f0e2b` (title word `quokkamber`), B
`20c9fdd3-5f7b-45fd-b266-9b1d8baf4a04` (`wombatcobalt`).

## Files

The JSON files are Biome-formatted (whitespace only; each parses to the same value as the file
the harness wrote). No file is over 100 KB, so none is gzipped. No token, password or signed URL
signature is in them.

| File | What it is |
| --- | --- |
| [`docker-before-*.txt`](docker-before-containers.txt), [`docker-after-*.txt`](docker-after-containers.txt) | Container names, volume names and network IDs before and after. After adds only the 23 `jeeves-pf12-*` containers, 5 `jeeves-pf12_*` volumes and the `jeeves-pf12_default` network (and the images `jeeves-pf12-app` and `jeeves-pf12-media`); the owner's are unchanged |
| `runs/setup-install.log`, `setup-build.log`, `setup-first-run-start`, `setup-first-run.log`, `setup-accounts.log` | Setup step 4's output (first-run 03:07:43 → 03:09:54 UTC) |
| `runs/setup-ps.txt`, `setup-ps-raw.txt` | `docker compose --profile '*' ps` after setup: 15 healthy |
| `runs/a1.json` | A1: the nine `me` reads |
| `runs/a2-upload.json`, `a2-ids`, `a2-ready.json`, `a2-asset.txt` | A2: the upload (signed URLs without signatures), A's ID, the ready poll's last read, A's lifecycle times |
| `runs/a3.json`, `a3-cache.txt` | A3: two details reads; the cache's `EXISTS` |
| `runs/a4.json`, `a5.json`, `a6.json` | A4 plays, A5 search, A6 favorites |
| `runs/part-a-end-ps.txt` | Status before the scale-up |
| `runs/part-b-scale-start`, `part-b-scale.log`, `part-b-ps.txt` | The scale-up command's output and `ps` showing 23 healthy |
| `runs/b1.json`, `b1-search-1…20.json`, `b1-fav-1…20.json`, `b1-loop.txt`, `b1-tally.json` | B1: 20 details reads, 20 searches, 20 favorites runs, and every status counted |
| `runs/b1-netio.txt`, `b3-netio.txt`, `b4-netio.txt` | `docker stats` network I/O per `app-*` container after B1, B3 and B4: which copies received traffic |
| `runs/b2-steps.txt`, `b2-1.json`, `b2-2.json` | B2: stop and start times and health, and the 20 reads with each copy stopped |
| `runs/b3.json`, `b3-db.txt` | B3: 50 plays sent twice; receipts and the total in the database |
| `runs/b4-upload.json`, `b4-ids`, `b4-ready.json`, `b4-search.json`, `b4-published.txt`, `b4-assets.txt`, `b4-outbox.txt` | B4: the upload, B's ID, ready, search, the `published.videos` count, both assets' lifecycle times and the outbox's send times |
| `runs/end-ps.txt`, `end-log-errors.txt` | At the end: 23 healthy, and the count of "error" lines per `app-*` log (0 each) |
| [`pf.mjs`](pf.mjs), [`env.sh`](env.sh) | The harness step script and environment used |
