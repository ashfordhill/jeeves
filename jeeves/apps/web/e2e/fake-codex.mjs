#!/usr/bin/env node
// The e2e server's stand-in for the `codex` CLI: `playwright.config.ts` points the server's
// JEEVES_CODEX_PATH here, so no e2e test runs the real one. It reads and writes no file and
// signs no one in. `login` prints a made-up sign-in URL, waits eight seconds and fails; anything
// else fails at once.
const [command] = process.argv.slice(2);

if (command === "login") {
  console.log("Starting local login server on http://localhost:1455.");
  console.log("If your browser did not open, navigate to this URL to authenticate:");
  console.log("");
  console.log("https://auth.example.invalid/oauth/authorize?client_id=jeeves-e2e-fake-codex");
  setTimeout(() => {
    console.error("The e2e stand-in for Codex signs no one in.");
    process.exit(1);
  }, 8000);
} else {
  console.error(`The e2e stand-in for Codex doesn't run "${command ?? ""}".`);
  process.exit(1);
}
