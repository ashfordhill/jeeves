# FP07a committed search and actual-playback counts

Base **75d6275c38eeb114f74de524759cac5d341abf55**. Only this sequential unit on primary `main`;
[actual evidence](evidence/fp07a/README.md), [runtime instructions](../app/README.md).
All14 long-running containers now run in retained **jeeves-youtube-v1**, same6volumes and local
credentials. Endpoints remain **http://127.0.0.1:4400/**, Identity4401, S3 signing4402. Read creator
password locally at `app/.runtime/secrets/creator_password` (username`creator`); other creator at
`other_creator_password`. No credentials in evidence. Normal `pnpm stop`/`pnpm start` now includes
Search/indexer/Counter and keeps setup record/volumes/media. No bootstrap/reset/purge was used.

New ready demo: **fdd51924-5a94-4e45-be02-a77b3c82d1a7**, title
**FP07a marigoldquartz public fixture**, description keyword`saffroncobalt`, channel`creator`.
Open `http://127.0.0.1:4400/?watch=fdd51924-5a94-4e45-be02-a77b3c82d1a7` or search by mouse.
Ready commit06:28:28.089 UTCNov8; first observed actual search06:28:29.245 (**1,156ms**).
Its final count is **3**: first legitimate event during a failed CDP suspension harness attempt,
then one successful tested page event and one new-session event. Explicit retries add0. See safe
UUID/acceptedAt/receipt/total evidence, not a relabeled zero baseline. The original ready demo
**fdbbc43f-78a0-4be2-9910-a383de70acf6** remains ready/searchable with0views. Fresh invalid
**023291a9-47ba-4955-ba42-7e9787a63baa** is INVALID_MEDIA/public404/search0; original invalid and
both elapsed FP06b jobs remain retained. Fixture bytes/mtime stay15,584,953B/SHA16587281…68aebf9.

`src/lib/search-schema.ts` owns a strict public projection/mapping with indexed title/description/
channel, ready/public filters, stable relevance/publishedAt/videoId sorting, page1–100/size20 and
bounded text. `scripts/search-init.mjs` and Search/indexer startup assert settings/mapping; empty
historical settings-only index receives compatible fields. No destructive migration/reset occurs;
incompatible field/type/index/analyzer/subfield or nonempty incomplete mapping refuses precisely.
`extensions/indexer-writer.ts` uses `_id=videoId`, external_gte publicationVersion1. Only strict
VideoPublished on `publication-events`→`search-indexer` is consumed, no SQL or raw processing input.
Ack follows durable upsert. Two repeated publications preserve1document/version1/same source hash.

`services/watch.ts` POST `/videos/:videoId/views` accepts only `{eventId:UUID}`, checks the same
positive ready reader, stamps server occurredAt/acceptedAt and version1, and awaits persistent
broker confirm with matching messageId before202/accepted:true. All dependency work is inside
awaited handlers. Watch1000ms/concurrency2000 and Search1000ms/concurrency1000 remain enforced;
late admitted work still drains without silently releasing its slot. Metadata/count SQL grants
remain scoped. Counter has only counts_writer and no metadata CONNECT. `counter-sum` reuses the
FP06a transaction/recordView API to commit receipt+increment atomically, ack afterward. Workers use
strict envelopes, mandatory messageId, existing terminal/failure/closed APIs and bounded retries.
The small generated HTTP helper repair replaces inherited unknown-route501 with finite404 while
unused shell startup still refuses explicitly. No business handler remains a placeholder.

Plain DOM browser adds search/results and stable per-mounted-session playback policy. The250ms
sample needs advancing media, normal speed, visible/playing/not waiting/seeking, and wall delta≤500ms.
Inactive events discard only the sample, not prior qualifying time or random session event ID.
After2 cumulative seconds, retries and mouse retry reuse that event ID. Details/count polling every2s
updates text only; it never remounts, resets or republishes. Tested uncertain-confirm retry adds1;
first visible count1,023ms after first acceptance. Pause/resume/seek adds0, explicit retry adds0,
reload/new session adds1. Actual2.6s main-thread block (media advances2.70s) and controlled visibility
signal/2x playback advance media without an event. Controlled visibility is **not an OS tab-hide
observation**; CDP lifecycle frozen did not suspend active-media callbacks, so its failed assumption
and legitimate first count remain retained. No product policy weakening was needed.

Original S05 automated unmuted decoded PCM440.085Hz/124frames/seek evidence remains; **no human
listening** occurred. Remote partial/orphan object prefixes remain; no S3 cleanup/atomic ACL claim.
No heavy provider/fault/load/performance campaign or template certification. Retained studio source/config/native010,
frozen005 inputs, historical manifest/app`.jeeves`, generator/templates/pins/locks stay immutable.
No actual architectural/presentation decision changed, so no duplicate011 snapshot is warranted.
Modified-generated service integration/helper repair and planned custom business extensions/new
browser/schema files are distinguished in provenance; no retroactive generated feature credit,
measured effort/cost/savings claim or automatic v2.

Next **FP07b only**: follow implementation-plan independent all-service S01–S08 outside-checkout
walkthrough. Copy final tracked app sources without dependencies/dist/runtime; own frozen install/
build and isolated named scratch runtime. Stop this owned4400–4402 stack normally if needed,
preserve its runtime/6volumes/credentials/fixture, run the separate copy, clean only that scratch
runtime and restart this original stack. Verify retained ready/search/count state. Include all
finite failures/private-original403/restart/creator controls by mouse, reconcile source/native010
and write owner walkthrough/fresh review checklist. Retain the audio/background/orphan limitations
unless new evidence resolves them. Do not start v2 before owner review. No broader provider campaign
or heavy template certification is a prerequisite to that assigned walkthrough.
