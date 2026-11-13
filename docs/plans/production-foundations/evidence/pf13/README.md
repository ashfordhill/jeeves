# PF13 evidence: v4 with faults and a throughput sample

2026-11-12 (UTC 2026-11-13). [Plan](../../units.md#pf13--run-v4-faults-and-a-throughput-sample) ·
[scenarios](../../../../../field-projects/youtube/v4/notes/scenarios.md#faults-and-throughput),
which hold the verdicts.

**Setup.** PF12's two-copy stack (`jeeves-pf12`, 45800–45802) and its scratch copy, with its
harness as PF12 left it ([`pf.mjs`](../pf12/pf.mjs) and [`env.sh`](../pf12/env.sh); V3-17's
`lib.mjs` and `upload.mjs`, unchanged). At the start `docker compose --profile '*' ps` showed 23
containers, every one healthy. [`reads.mjs`](reads.mjs) is the plan's text byte for byte
(SHA-256 `2e999f64…6c6f`; Biome passes it as written).
[`f3-catch.sh`](f3-catch.sh) is this unit's helper for F3: it uploads, polls the asset's state
every 0.5 s and, while it is `processing`, kills the transcoder whose `docker top` lists
`ffmpeg`, waits 5 s and starts it.

**Video IDs.** A `5eae0341-fffb-4bc7-afb4-1fd8004e5a36` (title word `pangolinsaffron`), C
`f3e2ccb1-2fab-4476-9d05-d6141e3edf79` (`axolotlindigo`). F3 was caught on the first upload, so
there is no C2, C3 or F3b.

**Machine (T1).** One computer, not a cluster: AMD Ryzen 5 7600X (12 logical CPUs), 31 GiB
memory (33,188,683,776 bytes), WSL2 (kernel 6.6.87.2), Docker 29.9.1 seeing 12 CPUs and the
same memory, Node 24.21.0. Every container of the stack and the load script ran on it
([`machine.txt`](runs/machine.txt)).

## Files

The JSON files are Biome-formatted (whitespace only; each parses to the same value as the file
the harness wrote, 13 of 13). No file is over 100 KB, so none is gzipped. No token, password,
secret or signed URL signature is in them (`grep -rniE 'bearer|eyJ|password|secret'` finds
nothing). Log files come from `docker logs --timestamps --since <boundary>`; an empty file
means the container wrote nothing in that window.

| File | What it is |
| --- | --- |
| [`docker-start-*.txt`](docker-start-containers.txt) | Containers, volumes, network IDs and images (with IDs) at the start of PF13: PF12's "before" plus its 23 containers, 5 volumes, one network and two images |
| [`docker-after-*.txt`](docker-after-containers.txt) | The same after the cleanup: equal to [PF12's "before"](../pf12/docker-before-containers.txt) (containers, volumes, networks), and the images equal PF12's before list |
| `runs/setup-ps.txt`, `machine.txt` | The 23 healthy containers at the start; the machine |
| `runs/f-a-upload.json`, `f-a-ids`, `f-a-ready.json`, `f-a-asset.txt` | Video A: the upload, its ID, the ready poll's last read, its lifecycle times |
| `runs/f1a-boundary`, `f1a-steps.txt`, `f1a.json`, `f1a-log-*.txt` | F1a: the cache stopped, 10 details reads, each Watch copy's log from the boundary to F1b's boundary |
| `runs/f1b-boundary`, `f1b-steps.txt`, `f1b.json`, `f1b-cache.txt`, `f1b-log-*.txt` | F1b: the cache started, A's key deleted, 2 details reads, `EXISTS`, each Watch copy's log since the boundary |
| `runs/f2a-boundary`, `f2a-steps.txt`, `f2a-ps.txt`, `f2a-inspect.txt`, `f2a.json`, `f2a-search.json`, `f2a-logs/` | F2a: the broker stopped; `ps -a` after 20 s; exit codes and times; the details and search reads; every `app-*` log since the boundary |
| `runs/f2b-boundary`, `f2b-steps.txt`, `f2b-start.log`, `f2b-ps-after-start.txt`, `f2b-ps-a-after-start.txt`, `f2b-images.txt` | F2b: the broker started; `pnpm start`'s output; `ps` after it; the images after it (new IDs for `jeeves-pf12-app` and `jeeves-pf12-media`) |
| `runs/f2b-scale.log`, `f2b-ps-scaled.txt`, `f2b-inspect.txt`, `f2b.json`, `f2b-logs/` | F2b: PF12's scale command again; `ps` with 23 healthy; each container's state, restarts and image; the plays; every `app-*` log since the boundary |
| `runs/f3-boundary`, `f3-catch.txt`, `f3-upload.out`, `f3-upload.json`, `f3-ids` | F3: the helper's record (each state read, the `docker top` lines, kill and start times) and the upload |
| `runs/f3-steps.txt`, `f3-ready.json`, `f3-search.json`, `f3-published.txt`, `f3-asset.txt`, `f3-netio.txt`, `f3-queues.txt`, `f3-logs/` | F3: ready, search, the `published.videos` count, C's asset row, both transcoders' network I/O, the broker's queues, every `app-*` log since the boundary |
| `runs/t1-1.json`, `t1-2.json`, `t1-3.json`, `t1-steps.txt`, `t1-netio.txt` | T1: the three samples, their start times, network I/O of both Watch copies and the cache after them |
| `runs/end-ps.txt` | 23 healthy, 0 restarts, before the cleanup |
| `runs/cleanup.txt`, `cleanup-down.log` | The cleanup: `down --volumes --remove-orphans`, the two image removals, the app copy's deletion, and the check that no `jeeves-pf12` container, volume, network or image is left and 45800–45802 are free |
| [`reads.mjs`](reads.mjs), [`f3-catch.sh`](f3-catch.sh) | The T1 script (the plan's) and the F3 helper |
