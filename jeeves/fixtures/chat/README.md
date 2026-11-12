# Chat fixtures

`e2e-script.json` is the scripted fake model used by the Playwright smoke set.
`playwright.config.ts` points the server at it with `JEEVES_FAKE_MODEL_SCRIPT`, so chat never
calls a real provider.

The format is `scriptByMessage` from `@jeeves/providers`: the first turn whose `match` appears in
the person's latest message (case-insensitive) is replayed, one step per model round. Both turns
edit a freshly created TinyURL project (revision 1); sent to any other revision, the command is
refused as a revision conflict and nothing changes (the scripted reply still follows).

| Message contains | Steps |
| --- | --- |
| "Rename the redirect service to Redirector" | `applyStudioCommands` with an `edit` renaming `redirect`, then a reply. |
| "Add a cache after the redirect service" | `getDesign`, then `applyStudioCommands` with an `addTile` after `redirect` (tile `cache`, "Cache", link `redirect-cache-2`: what Redirect's `+` → Cache makes on the canvas), then a reply. |
| "Archive the clicks" | `applyStudioCommands` with an `addTile` after `redirect` and a `setOwner` that doesn't exist (refused, nothing kept), then the `addTile` alone in chat's own form (no ID or link ID: they follow the name, `click-archive`), then a reply (V3-19). |
