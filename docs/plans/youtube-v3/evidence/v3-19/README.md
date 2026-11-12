# V3-19 evidence: chat's refusals and the Anthropic provider, by mouse

Checked 2026-11-11 on my own servers (API 4520 on a scratch database `jeeves_v319`, now dropped;
Vite 4530; both stopped), with the e2e scripted chat model, in Chromium at **1440×900** and
**1280×800**, by mouse (the keyboard only to type the message). Both runs passed with no page or
console error.

- A new project from the TinyURL extended study renders on the lane canvas: 11 tiles.
- **Chat:** "Archive the clicks" makes the scripted model send a batch with a command that
  doesn't exist. The turn's activity shows the refusal in red, naming the command and the one to
  use (`Command 2 (setOwner): There is no "setOwner" command; use editTile.`), and that nothing
  of the batch was kept. The model's second batch, the `addTile` alone in chat's own form (no ID
  or link ID), is prepared and saved as one edit: Click archive appears after Redirect service
  (12 tiles). One header Undo takes the whole turn back (11 tiles)
  ([1440×900](v3-19-chat-refusal-1440.png)).
- **Settings:** Connections lists Anthropic API with "No API key" (the server had none), "Set
  ANTHROPIC_API_KEY in the environment before starting Jeeves. Jeeves never stores it." and the
  copyable `export ANTHROPIC_API_KEY=`. Choosing Anthropic API as the design provider, picking
  `claude-haiku-5-5` from its suggestions and Save model saves the choice
  ([1280×800](v3-19-settings-anthropic-1280.png)). The e2e suite checks the same two flows
  (`blueprint-chat.spec.ts`).

The live model runs are in [docs/evals/v3-19](../../../../evals/v3-19/README.md).
