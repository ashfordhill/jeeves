// Accidental-misuse check for cooperative application authors. This is not a JS sandbox.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createScanner, SyntaxKind } from "typescript/unstable/ast";

const root = resolve(process.argv[2] ?? fileURLToPath(new URL("../", import.meta.url)));
const errors = new Set();
const report = (file, api) =>
  errors.add(`${relative(root, file).split(sep).join("/")}: forbidden ${api}`);
const manifest = JSON.parse(await readFile(resolve(root, ".jeeves/manifest.json"), "utf8"));
const generated = new Set();
for (const row of manifest.files) {
  if (row.ownership !== "generated-scaffold") continue;
  generated.add(row.path);
  try {
    const bytes = await readFile(resolve(root, row.path));
    if (createHash("sha256").update(bytes).digest("hex") !== row.sha256)
      report(resolve(root, row.path), "write to template-owned file; regenerate it");
  } catch {
    report(resolve(root, row.path), "missing template-owned file; regenerate it");
  }
}
const files = async (directory) => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(resolve(directory, entry.name))
          : entry.name.endsWith(".ts")
            ? [resolve(directory, entry.name)]
            : [],
      ),
    )
  ).flat();
};
const all = await files(resolve(root, "src"));
const visited = new Set();
const noEffect = new Set([
  "fetch",
  "WebSocket",
  "XMLHttpRequest",
  "EventSource",
  "require",
  "eval",
  "Function",
  "setTimeout",
  "setInterval",
  "setImmediate",
]);
const policyMethods = new Set([
  "query",
  "execute",
  "transaction",
  "idempotent",
  "publish",
  "request",
  "consume",
  "connect",
  "close",
  "commit",
  "rollback",
  "ack",
  "nack",
]);
const safePackages = new Set(["zod", "node:crypto", "node:buffer", "node:url"]);
async function inspect(file, policy, service) {
  const visitKey = `${file}:${policy}:${service}`;
  if (visited.has(visitKey)) return;
  visited.add(visitKey);
  const source = await readFile(file, "utf8");
  // The pinned TS7 compiler exposes its scanner; no extra parser/lint dependency is needed.
  // Strings/comments are tokens, so a quoted example cannot masquerade as an executable API.
  const scanner = createScanner(true, undefined, source);
  const tokens = [];
  for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan())
    tokens.push({ kind, text: scanner.getTokenValue() || scanner.getTokenText() });
  const imports = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i],
      next = tokens[i + 1],
      previous = tokens[i - 1];
    if (token.kind === SyntaxKind.ImportKeyword) {
      if (next?.kind === SyntaxKind.OpenParenToken) report(file, "dynamic import");
      else if (next?.kind === SyntaxKind.StringLiteral) imports.push(next.text);
      else
        for (
          let j = i + 1;
          j < tokens.length && tokens[j].kind !== SyntaxKind.SemicolonToken;
          j++
        ) {
          if (tokens[j].text === "from" && tokens[j + 1]?.kind === SyntaxKind.StringLiteral) {
            imports.push(tokens[j + 1].text);
            break;
          }
          if (tokens[j].kind === SyntaxKind.EqualsToken) {
            report(file, "import = require");
            break;
          }
        }
    }
    if (token.kind === SyntaxKind.ExportKeyword) {
      // Only export-from clauses; ordinary exported function bodies are checked below.
      if (
        next?.kind === SyntaxKind.AsteriskToken ||
        next?.kind === SyntaxKind.OpenBraceToken ||
        next?.text === "type"
      )
        for (let j = i + 1; j < tokens.length && tokens[j].kind !== SyntaxKind.SemicolonToken; j++)
          if (tokens[j].text === "from" && tokens[j + 1]?.kind === SyntaxKind.StringLiteral) {
            imports.push(tokens[j + 1].text);
            break;
          }
    }
    if (token.kind === SyntaxKind.Identifier) {
      if (noEffect.has(token.text)) report(file, token.text);
      if (["process", "global", "globalThis", "Deno", "Bun"].includes(token.text))
        report(file, token.text);
      if (
        policy &&
        previous?.kind === SyntaxKind.DotToken &&
        next?.kind === SyntaxKind.OpenParenToken &&
        policyMethods.has(token.text)
      )
        report(file, `policy effect API ${token.text}`);
    }
  }
  for (const specifier of imports) {
    if (!specifier.startsWith(".")) {
      if (!safePackages.has(specifier)) report(file, `driver/runtime import ${specifier}`);
      continue;
    }
    const target = resolve(dirname(file), specifier.replace(/\.js$/, ".ts"));
    const path = relative(root, target).split(sep).join("/");
    if (path === "src/extension-api/index.ts") continue;
    if (
      path.startsWith("src/runtime/") ||
      path.startsWith("src/features/") ||
      path.startsWith("src/processes/") ||
      path.startsWith("../")
    ) {
      report(file, `private runtime import ${specifier}`);
      continue;
    }
    const own = `src/modules/${service}/`;
    if (
      !(
        path.startsWith("src/contracts/") ||
        path.startsWith("src/helpers/") ||
        path.startsWith(own)
      )
    ) {
      report(file, `private cross-service import ${specifier}`);
      continue;
    }
    // Generated .slots files are checked by hash; they use only the generated public contract.
    if (generated.has(path)) continue;
    if (all.includes(target)) await inspect(target, policy, service);
    else report(file, `unresolved shared import ${specifier}`);
  }
}
for (const file of all) {
  const path = relative(root, file).split(sep).join("/");
  const match = /^src\/modules\/([^/]+)\/.*\.ts$/.exec(path);
  if (path === "src/http-errors.hooks.ts") {
    await inspect(file, true, "__http_error_policy__");
    continue;
  }
  if (!match || generated.has(path)) continue;
  const source = await readFile(file, "utf8");
  const policy = file.endsWith(".hooks.ts") && !source.includes("@jeeves-extension: operation");
  await inspect(file, policy, match[1]);
}
if (errors.size) {
  console.error([...errors].sort().join("\n"));
  process.exitCode = 1;
} else
  console.log("Extension boundaries passed (cooperative misuse check; no hostile-code sandbox).");
