# Chat fixtures

`e2e-script.json` is the scripted fake model used by the Playwright smoke set.
`playwright.config.ts` points the server at it with `JEEVES_FAKE_MODEL_SCRIPT`, so chat never
calls a real provider.

The format is `scriptByMessage` from `@jeeves/providers`: the first turn whose `match` appears in
the person's latest message (case-insensitive) is replayed, one step per model round. The one
turn renames Redirect in a freshly created TinyURL project (revision 1).
