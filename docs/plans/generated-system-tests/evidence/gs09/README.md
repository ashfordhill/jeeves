# GS09 evidence

Local only (this WSL2 host); hosted CI has not run. The review is [review.md](../../review.md).

- `all/`: `pnpm test:generated --suite=all` on the final harness source (SHA-256
  `8c729e87f5919de86ed5623a67022715460ba79181ae2eb07ecf1e0ba1985990`, `source.json.gz`): 14/14
  in 8 files and 15 stacks, Vitest 1,210.9 s, CLI 1,229 s monotonic (1,366 s wall). Per-stack
  results, observations, boundaries, expiry files, original manifests/reports, scaffold hashes,
  `stack-cleanup.json` (now with image tags), `cleanup.json` and the matching `sanitized.json`.
- `deliberate-failure/`: `--suite=faults` with the Counter's kill omitted
  (`omitted-kill.patch`; source SHA-256 `d840296c…a51`): 4/5, exit 1, B09 counter failed at its
  first durable check; every stack released, scrub marker matching. The scenario was restored
  byte for byte afterwards.
- `clock/`: `wall-steps-100s.json` (wall-minus-monotonic steps over 100 s of monotonic time),
  `host-vs-windows.json` (WSL wall, uptime and the Windows clock over 70 s), and the new offline
  harness test failing on the old harness (`harness-test-before.log`) and passing after.

Logs and files over 16 KiB are gzip-compressed. The harness sanitized every file before copying;
no runtime secret, token or signed URL is kept.
