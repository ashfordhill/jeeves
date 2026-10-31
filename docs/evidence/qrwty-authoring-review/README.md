# QRWTY authoring review evidence

Read-only browser review on 2026-10-31, Chromium 153.0.8010.12, viewport 1440 × 1000. See the [findings and proposed plan](../../qrwty-authoring-review-2026-10-31.md).

- `qrwty-entry.png`: local QRWTY at port 5173 with a fresh anonymous browser context. `/login` and `/register` rendered the same headings/form as `/`.
- `jeeves-components.png`: actual saved QRWTY project, revision 4, API component scope after layout/camera settled. Eleven components, two actual relationships. Bounding-box inspection found both external containers partially outside the diagram viewport.
- `jeeves-frontend.png`: same saved project, frontend scope. Two components and the connected API; page navigation is not represented.

Navigation did not change the saved semantic revision. No existing browser session, private records, registration or application mutation was used. Source inspection established the signed-in page behavior and supported returning-account login; it did not reproduce the user's personal sign-in history.

An additional disposable browser probe used two Node HTTP servers bound to `127.0.0.1` on different ephemeral ports. Each `/set` route sent `Set-Cookie: jeeves_session=<fixture-value>; HttpOnly; SameSite=Strict; Path=/`; `/` echoed its received Cookie header. In one fresh Chromium context:

1. Visit A `/set`, then A `/`: `jeeves_session=fixture-a`.
2. Visit B `/set`, then A `/`: `jeeves_session=fixture-b`.

This proves cross-port replacement for the cookie shape in the current session runtime. Both servers and the browser were closed afterward. It demonstrates a sign-out mechanism, not the cause of the user's repeated account creation. No runtime patch is included in this review.
