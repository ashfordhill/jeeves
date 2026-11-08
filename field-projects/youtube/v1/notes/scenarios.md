# Frozen observable scenarios

Scope version **youtube-core-v1**, frozen before any generator output/custom application code.
All scenarios below are **not run**; this is a future acceptance/benchmark checklist. Evaluate
each against untouched generated output, then completed v1, then the same stable scope in v2.
Classify supplied behavior as generated / partly supplied / custom / failed / not checked.
Configuration, empty scaffolding and placeholder media have no functional credit. Keep new
features separate instead of changing this denominator.

| ID | Mouse walkthrough and bounded success evidence |
| --- | --- |
| S01 local setup/sign-in | Copy the exported project outside this checkout; follow its documented build/start command. All required local containers become ready without a cloud account or Jeeves. Open the browser UI, sign in as the provisioned creator, see creator identity and a mouse sign-out control. Retain exact commands, versions, readiness output and UI image. No live/paid chat is involved. |
| S02 authenticated real multipart upload | Anonymous start/sign/complete requests refuse; the signed-in creator chooses the fixture, title and description by mouse. At least three actual part PUTs transfer real bytes to private originals. Retain part numbers/sizes/ETags, listed parts, completed object checksum and resulting stable video/job ID. A different creator cannot manage that upload; valid signed URLs are temporary bearer capabilities. |
| S03 bounded resume/abort | Interrupt after a nonfinal part; refresh, sign in if needed, reselect the same file and resume the same upload ID by mouse. ListParts discovers acknowledged parts and only missing parts are resent. Abort a separate unfinished upload by mouse and show it cannot complete. This tests a bounded refresh/resume, not arbitrary provider/fault recovery. |
| S04 real processing/publication | Status progresses through uploading/pending/processing to ready; errors are visible instead of hanging forever. Actual FFmpeg encoding produces H.264/AAC 360p and 720p HLS renditions, playlists, real segments and a thumbnail from the fixture. Retain encoder command/log, ffprobe codec/dimension/duration output and object list. No stream-copy/fake success. Automatically publish only a successful complete result, with no moderation click. |
| S05 real public playback | In a signed-out browser, open the ready video from the UI. Details/thumbnail/count render. Click play; time advances at least five seconds with decoded video and audible fixture tone, and mouse seek works. Observe playlist and segment GETs through the local edge; encoded media bytes differ from the original. Retain browser/media evidence. Failed or pending IDs do not yield a playable public watch result. |
| S06 public-only search | Search the unique fixture title, description keyword and creator/channel text through the UI. Within 60 seconds after committed ready publication, get the ready video and open it. A pending upload and a deliberately invalid-media upload with unique titles never appear as public hits or broken watch links. Do not count searching an in-memory fake list. Retain query/results and the matched committed metadata. |
| S07 basic eventual counts | Fetch details/search repeatedly without playback and observe no increment. Play beyond two cumulative seconds once, wait up to 10 seconds after event acceptance, refresh details and observe +1. Pause/resume/seek in that page session adds none. Retry the same event ID and observe no extra increment; open a new watch session, play again and observe a second increment. Retain accepted event IDs, counter state and eventual visible results. |
| S08 clear failures/independence | Invalid token, oversize/nonconforming file and invalid media produce visible finite errors, with no public search/watch publication. Stop/start the exported stack normally and show previously ready media remains watchable. Originals remain inaccessible anonymously. Record exact limitations/failures rather than asserting crash-safe guarantees. |

S01–S08 are the stable feature comparison set, not eight equal-sized engineering tasks or a
percentage score. Record partial evidence per scenario. Existing Jeeves regressions are separate
from these real-container field checks. Heavy provider matrices, fault campaigns, performance/
soak tests and broad template certification remain deferred.

## Bounded v1 policies

- **Upload:** authenticated creator control operations; signed part URLs expire after 15 minutes
  and can be renewed for the same owned active upload. Use 5 MiB parts except the last; accept
  1 byte–256 MiB at the transport boundary, then validate media before publication. Support MP4
  with H.264 video/AAC audio, landscape 720p–1080p, 1–600 seconds for the completed demo. Reject
  unsupported media clearly. No promise for arbitrary codecs, 4K, portrait, live streaming or
  high-volume upload. The fixture deliberately has several parts.
- **Resume:** same creator/file/upload ID within 24 hours, with local browser upload ID and
  authoritative storage ListParts; reselecting a file is acceptable. No cross-device transfer,
  byte-range edit, offline upload or recovery after an explicit abort. The custom phase must
  provide owned durable upload records and cleanup/expiry behavior; source prose alone supplies
  none. Do not lose ownership checks when renewing URLs.
- **Encoding/publication:** CPU encode two fixed renditions, 640×360 around 1 Mbit/s and
  1280×720 around 3 Mbit/s, H.264/yuv420p plus AAC, roughly 4-second HLS MPEG-TS segments and a
  master playlist. Keep aspect ratio, no upscaling, no GPU/DAG scheduler. Produce one full-size
  thumbnail. Exact FFmpeg flags are custom completion work. A failed/partial job must not become
  ready/public in metadata/search; publication ordering is G02, not currently guaranteed by the
  diagram. Application lifecycle and retry/idempotence are G01/G03.
- **Counts:** count one explicit playback event after **two cumulative played seconds** per
  watch page session, not metadata fetch, search, segment GET, autoplay attempt or play-button
  click alone. Repeated pause/resume/seek in the session reuses one event ID. Retried delivery of
  `(videoId,eventId)` is deduplicated transactionally with the increment; a new page session may
  count again. Only ready public videos accept events. Anonymous public playback is allowed.
  Aggregate asynchronously (target flush within two seconds, smoke visibility within ten after
  acceptance). No unique-viewer, bot/fraud, watch-time analytics, billing-grade or exact global
  counting claim. These are policies to implement, not behavior inferred from `counter-sum`.
- **Search:** match title/description/channel, return public ready videos only. Basic paged
  text search is enough; no relevance benchmark, recommendations, autocomplete or search SLA.
  Resolving independent completion-consumer ordering is mandatory before S06 can pass.
- **UI:** a functional sign-in/upload/progress or failure/search/watch interface using standard
  mouse controls. No polished YouTube clone, playlists management, follows/comments/likes,
  subscriptions, moderation, editing, deletion, privacy tiers, notifications or monetization.
  Layout/product expansion must not silently enter the stable v1/v2 comparison.

These are small reproducible demonstration bounds, not product/production capacity promises.
Pin changes or scope changes get a ledger entry. G01–G08 remain explicit planning inputs for
FP05 after the actual untouched baseline is committed.

## Reproducible media-fixture recipe

Do not commit the video. Later run this with the selected field FFmpeg build (or document a
different fixture-generation build), then record its FFmpeg version/configuration and SHA256.
It uses only synthetic video/audio; no external download or copyrighted clip is required.

```sh
ffmpeg -hide_banner -y \
  -f lavfi -i 'testsrc2=size=1280x720:rate=24' \
  -f lavfi -i 'sine=frequency=440:sample_rate=48000' \
  -t 20 -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset veryfast -pix_fmt yuv420p \
  -b:v 6M -minrate 6M -maxrate 6M -bufsize 12M \
  -x264-params 'nal-hrd=cbr:force-cfr=1' -g 48 \
  -c:a aac -b:a 128k -movflags +faststart youtube-v1-fixture.mp4
ffprobe -v error -show_streams -show_format youtube-v1-fixture.mp4
sha256sum youtube-v1-fixture.mp4
test "$(wc -c < youtube-v1-fixture.mp4)" -gt 10485760
```

Expected shape is 20 seconds, 1280×720/24 fps, H.264/AAC, approximately 15 MB, with at least three
5 MiB-or-smaller parts. The size assertion must pass; if it does not, record the failed recipe
and correction rather than pretending multipart was exercised. Pixel/byte equality across
FFmpeg/libx264 builds is not promised. Retain the actual fixture hash for comparisons; reuse
the same generated fixture bytes across v1/v2 when possible. For S08 make a small text file
named `invalid.mp4`; no video artifact needs to enter Git. This recipe has not run in FP01.
