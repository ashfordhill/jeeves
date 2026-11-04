# Inspection procedure and safety boundary

A one-off script used the repository-installed @playwright/test Chromium driver. No Playwright
suite/config or app source was changed. All artifacts are direct captures. The app was already
serving on the documented loopback dev ports; UX01 did not restart or replace that server.

1. GET the existing project list and GET each design/layout, storing only ID/revision and SHA-256
   of JSON.stringify payloads. Retain key/array order. No project target snapshots or content are
   included in tracked JSON observations.
2. Before opening any page, install a browser-context route for all requests. Continue only GET,
   HEAD and OPTIONS; abort every other method and log method/path. This applies to all projects,
   layout writes, chat, generation and provider calls. Then create the page.
3. Open existing target 684f5790-df6b-4447-91d1-668cf7e1cc87 by URL at C2 and API C3; wait for
   architecture-graph aria-busy=false. Capture 1440×900 and 1280×800 PNGs and inspect their actual
   content. Open Editor actions by mouse for the menu capture. Record console warning/error events,
   page errors and HTTP status >=400. No mutation action is used. Close this context.
4. Materialize the public QRWTY target factory through installed tsx (plain Node strip-only cannot
   load an existing TypeScript parameter property). POST a newly named owned disposable project,
   POST its element/connection/architecture operations, and PUT its public layout. Record exact ID.
   GET the initialized design and hash it before browser gestures, so API normalization is not
   confused with a drag mutation. No source project is copied through a mutation endpoint.
5. Create another browser context with video recording and reduced motion. Install its guard before
   page load: allow read methods, and allow PUT only to /api/projects/<exact owned ID>/layout;
   abort all other non-read requests. Initialization above is separate, explicit owned-project setup.
   Wrap Worker creation/postMessage to count layout activity, retaining the native implementation.
6. Close Explorer, select the Workspace membership card and click Focus selection. Use its existing
   small grip and the mouse to move 12 steps of 9×4 screen pixels with 45ms sampling pauses. Capture
   card IDs/transforms, edge IDs/path strings/computed visibility, label coordinates, busy state and
   Worker counts before, at each step and after mouse-up plus 900ms acknowledgement wait. Capture
   before/mid/after screenshots and video. No app implementation instrumentation is added.
7. Compare the initialized semantic hash/revision after the gesture; inspect actual PUT status codes
   and persisted architecture positions. Compare changed paths against the public projection's
   actual incident relationships. Close the recording context/browser.
8. Re-GET every pre-existing project design/layout and compare all before/after hashes. DELETE only
   the exact owned disposable ID and verify subsequent GET 404. The first successful capture was
   repeated once to add the initialized before hash; both exact IDs and deletion statuses are in
   owned-project.json. Initial loader failures occurred before project creation.

This is bounded direct inspection, not a maintained test or benchmark. Twelve sampled DOM frames
cannot exclude a compositor-level flicker between samples. The preserved feedback GIF supplies the
historical visual report; this reproduction and source analysis do not claim a complete root cause.
The future studio fixtures remain data inputs until UX02a; no current import/parse success is claimed
for their proposed studio property. No provider task, generation job, integration request or paid
model call is part of this procedure.
