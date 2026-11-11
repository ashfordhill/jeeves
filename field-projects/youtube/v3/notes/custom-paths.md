# YouTube v3: custom paths in `app/`

`app/` started as a byte-for-byte copy of `generated/` in the commit `V3-12: v3 generated output`
([contract](../../../../docs/plans/youtube-v3/contract.md) §6). This table has one row for each
path that a later unit adds to or changes in `app/`. It says the area, the unit that made the
change, and what was written and why.

- **Areas:** hook, stub body, product SQL, UI or integration, plus test (product unit tests,
  outside `src/` and outside the LOC metric).
- **Not listed:** `generated/` (it is never edited), and the build and runtime output that
  `.gitignore` keeps out of Git (`node_modules`, `dist`, `dist-public` and `.runtime`).
- **Check (V3-17):** the rows must match `diff -rq generated app` with those four left out.
- **Scaffold edits:** none. No generated scaffold (`src/processes/`, `src/runtime/`,
  `src/features/`, `entry.ts`, `dependencies.ts`, `infra/`, `scripts/` assets) has been changed.

| Path in `app/` | Area | Unit | What and why |
| --- | --- | --- | --- |
| `src/modules/video-contract.ts` | hook (new, shared) | V3-13 | The product's upload contract, shared by Upload API's multipart hooks and the Lifecycle writer's hooks so the two tiles can't drift (V3-14's Transcoder `job` codec can use it too). From v2's `youtube-contract.ts`, `youtube-events.ts` and `video-paths.ts`: video metadata (title 1–200, description up to 5,000, channel), the start request (an `.mp4`, `video/mp4`, 1 byte–256 MiB, SHA-256), the completion answer, the original's key `upload-api-multipart-uploads/<videoId>/<uploadId>/source.mp4` (`ORIGINALS_PREFIX` is the multipart template's compiled prefix, because the lifecycle and Transcoder hooks get no prefix), the `VideoProcessingRequested` job bound to its original and to its stable event ID (v1's `youtube-v1` namespace, as v2 kept it), and `wireEvent`, which binds an event to its broker message ID. |
| `src/modules/upload-api/upload-api-multipart-uploads.hooks.ts` | hook | V3-13 | All of multipart's hooks. `principal` wraps the guard's `require` with v2's creator check: the realm role `creator`, else 403 `CREATOR_REQUIRED` (contract §2, question 5). `validate` is v2's policy: 413 `FILE_SIZE`, 422 `UNSUPPORTED_FILE`, 400 `INVALID_UPLOAD`, and the channel from the account's username. `metadata` and `response` are the contract's codecs. `originalKey` is the contract's key, and the factory refuses to start if the compiled prefix ever differs. `job` is the contract's job codec, for the outbox relay. `reserve`, `complete` and `closed` still delegate to the lifecycle, as generated. The unused `NotImplemented` import is gone. |
| `src/modules/video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts` | hook | V3-13 | The lifecycle hooks that an upload reaches: `metadata` (the same codec as the upload's), `identities.request` (the job's stable event ID), `job.codec` and `job.construct` (the job, built in the completion transaction from the verified original, refusing an original under another key), and `response` (`{uploadId, videoId, jobId, attemptId, state: "pending"}`). `event`, `result`, `failure`, `publication.*`, `identities.result` and `identities.publication` are V3-14's and still throw "Not implemented". |
| `scripts/accounts.mjs` | integration | V3-13 | The account script (contract §7): after `pnpm first-run`, `node scripts/accounts.mjs` creates the realm role `creator` and the users `creator` and `other-creator` (with it) and `viewer` (without it) through Keycloak's admin API, on the identity port that `.runtime/local-setup.json` recorded. Passwords are generated at run time into `.runtime/secrets/{creator,other_creator,viewer}_password` (0600), as v2's were; none is in Git. Re-running keeps every account and password. It is operator setup, not an app feature (no sign-up). |
| `test/upload.test.ts` | test | V3-13 | Five offline tests of the hooks above with Node's own runner (`node --test "test/*.test.ts"` after `pnpm install`; Node 24 runs TypeScript directly, so the export needs no test setup and `package.json` is unchanged): 401 then 403 at `principal`, `validate`'s bounds, the key and its prefix check, the job and both codecs, and the completion answer. |
