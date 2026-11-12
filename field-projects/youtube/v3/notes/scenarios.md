# YouTube v3: S01–S10 as observed

The scenarios are [contract](../../../../docs/plans/youtube-v3/contract.md) §7: v1/v2's frozen
[S01–S08](../../v1/notes/scenarios.md), plus S09 (signed-in and anonymous watching) and S10
(Favorites).

**The run:** V3-17, 2026-11-11, on a fresh copy of `app/` at `3409af2` outside the checkout
(`jeeves-v317-accept`, 45700–45702). Each row was observed by mouse in Chromium and by API.
Details, timings and the attempts are in the
[evidence](../../../../docs/plans/youtube-v3/evidence/v3-17/README.md).

The **gap** numbers refer to the [template gaps](README.md#template-gaps-found-while-completing-app).
No app or generated file was changed for this run.

| ID | Verdict | By mouse | By API | Not observed |
| --- | --- | --- | --- | --- |
| S01 Setup and sign-in | **Observed** | Sign in through Keycloak; "Signed in as creator" and Sign out; after signing out, the next sign-in asks for the password | install 0.3 s, build 0.5 s, first-run 120.7 s, all exit 0; 9 `app-*` and 6 providers healthy, 0 restarts; creator check `me` gives `username:"creator"` | — |
| S02 Multipart upload | **Partial** (gap 1) | The fixture, title and description, then Upload video. Resumed (S03) to "Upload received", then the badge read "uploaded · not ready yet" and "ready" 4.8 s later | Anonymous 401, viewer 403 `CREATOR_REQUIRED`; three real part PUTs (5,242,880 / 5,242,880 / 5,099,193 bytes) with ETags; ListParts; the original's SHA-256 equals the fixture's; other-creator 404 and an empty list; complete gives `videoId` and `jobId` | **Complete answers 200, not 202**, and the page never says "pending" |
| S03 Resume and abort | **Observed** | Pause in part 2, refresh, reselect, Resume: only parts 2 and 3 sent, the same upload ID. A second upload aborted with Abort upload | ListParts before the resume was `[1]`; complete after abort is 410 `UPLOAD_CLOSED` | — |
| S04 Processing and publication | **Partial** (gap 1; v1's encoder-log criterion) | Only uploading → "uploaded · not ready yet" → ready | The lifecycle's rows: pending → processing → ready (also polled every 0.25 s for a held video), and → failed `INVALID_MEDIA`; Processing events for each. ffprobe: H.264/AAC HLS at 640×360 and 1280×720, 5 × 4 s segments each, one 1280×720 thumbnail. `published.videos` had no row while pending, one once ready, and never a failed video | Pending, processing and "failed" with its message, by mouse. The encoder's command line and stderr (not logged by the template) |
| S05 Playback | **Observed, except listening** | Signed out, from search: details, thumbnail (1280×720), "0 views". More than 5 s of play: 217 frames decoded, 0 dropped, and decoded audio peaking at 440.08 Hz (RMS 0.062). A timeline seek kept playing | Playlists and segments under `/cdn/video-delivery/` at the edge (200, and 206 for ranges); segment bytes are not the original's (about 1.2 and 3.4 Mbit/s against 6); pending, failed and unfinished IDs are 404 from the details (`NOT_FOUND`, gap 7) | **Human listening** (Playwright's Chromium runs with `--mute-audio`) |
| S06 Search | **Observed** | Title, description keyword and channel each found the ready video, which opened; a just-ready video was found 1.7 s after its ready commit. The pending, failed and unfinished titles gave 0 results | Only ready videos are hits; the pending, invalid, unfinished and aborted words give `total: 0`; bad input 400 `SEARCH_QUERY` | — |
| S07 Counts | **Observed** | Searches and opens added nothing; a 1.1 s play with a pause and a seek sent nothing; 2 cumulative seconds gave "1 views" 0.3 s after the 202; seeks, pauses and resumes added none; a new page session gave "2 views" | The same event ID sent again: 202, one receipt, the count unchanged; on another video two plays and their retries gave +2; the public totals kept their counts after the restart | — |
| S08 Failures and independence | **Partial** (gap 1) | A refused token: "Your sign-in expired or was refused. Sign in again.", signed out, and not retried anonymously. Over 256 MiB and not an MP4 are refused in the page, with no request sent | 401; 413 `FILE_SIZE`; 422 `UNSUPPORTED_FILE`; invalid media failed with no publication, no search hit and a 404 from the details; an anonymous original GET 403. `pnpm stop` (8.0 s) and `pnpm start` (64.0 s) gave an identical snapshot, 15 healthy and 0 restarts | Invalid media shown as failed, by mouse: it stays "uploaded · not ready yet" |
| S09 Signed-in and anonymous watching | **Observed** | Signed out: no sign-in asked, and the play counted. Then Sign in as `viewer` on the watch page returned to the video, and the viewer's play counted (3 views) | `me`: `{signedIn:false}`, then `username:"viewer"`, and 401 for a bad token. A scratch queue on View events got `viewer: null` and the viewer's subject, each adding 1 | — |
| S10 Favorites | **Observed** | ☆ → ★, and My favorites lists the video; Remove in the list empties it, and the toggle returns to ☆. Signed out: no toggle, no list, only Sign in | PUT 200, and again with the same `addedAt`; GET 200; list; DELETE 204, then 404 `NOT_FAVORITE`; 401 without a token; 404 `NOT_ELIGIBLE` for pending, failed, unfinished, unknown and upper-case IDs; 400 `ITEM_ID` for a bad ID; the list survives stop and start | — |

**What it takes to close the partial rows.** Gap 1 lets a creator see only the upload's own
state. Closing it means giving the upload's status route the video's state: pending, processing,
ready, or failed with its code. That would make S02's "pending", S04's sequence and S08's "failed"
visible in the page. It would also let complete answer 202. v1's frozen S04 also asks for the
encoder's log, which the HLS template doesn't keep. Human listening is the owner's to do.
