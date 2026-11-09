import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { parseSync } from "rolldown/utils";
import { z } from "zod";

export const SOURCE_LOC_VERSION = "source-loc-v2";

const relativePath = z
  .string()
  .regex(/^[\w.-]+(?:\/[\w.-]+)*$/)
  .refine(
    (path) => !path.split("/").some((part) => part === "." || part === ".."),
    "Scope paths must be relative to the application without dot segments.",
  );
const backendScopeSchema = z.strictObject({
  version: z.literal(1),
  backendPaths: z.array(relativePath).min(1),
  uiPaths: z.array(relativePath),
  configurationPaths: z.array(relativePath).optional(),
});
const matchesPath = (path: string, roots: readonly string[]) =>
  roots.some((root) => path === root || path.startsWith(`${root}/`));

/** Explicit scope: production JS/TS under any src directory, excluding configuration and tests. */
export function exclusionReason(path: string): string | null {
  const parts = path.split("/");
  const name = parts.at(-1) ?? "";
  if (!parts.includes("src")) return "outside-src";
  if (
    parts.some((p) =>
      /^(tests?|__tests__|__mocks__|mocks?|fixtures?|e2e|checks|coverage|test-support)$/.test(p),
    ) ||
    /(?:^|[.-])(?:test|spec|stories|test-support|test-utils|setup-tests)(?:[.-]|$)/.test(name)
  )
    return "test-or-fixture";
  if (
    parts.some((p) => /^(config|configuration|settings|node_modules|vendor|dist|build)$/.test(p)) ||
    /(?:^|[.-])(?:config|settings|env|environment)(?:[.-]|$)/.test(name)
  )
    return "configuration-or-build";
  if (/\.d\.[cm]?ts$/.test(name)) return "declaration-file";
  if (!/\.[cm]?[jt]sx?$/.test(name)) return "not-js-or-ts-source";
  return null;
}

/** Use the locked parser so comment-like text in strings, templates and regexes remains code. */
export function codeLines(path: string, text: string): string[] {
  const parsed = parseSync(path, text);
  if (parsed.errors.length) throw new Error(`Cannot count ${path}: ${parsed.errors[0]?.message}`);
  let withoutComments = text;
  for (const comment of [...parsed.comments].sort((a, b) => b.start - a.start)) {
    withoutComments =
      withoutComments.slice(0, comment.start) +
      text.slice(comment.start, comment.end).replace(/[^\r\n]/g, " ") +
      withoutComments.slice(comment.end);
  }
  return withoutComments
    .replace(/^#![^\r\n]*/, "")
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Longest ordered exact-line match, within the same file; indentation is already removed. */
export function retainedLines(before: readonly string[], after: readonly string[]): number {
  const row = new Uint32Array(after.length + 1);
  for (const line of before) {
    let diagonal = 0;
    for (let j = 1; j <= after.length; j++) {
      const above = row[j] ?? 0;
      row[j] = line === after[j - 1] ? diagonal + 1 : Math.max(above, row[j - 1] ?? 0);
      diagonal = above;
    }
  }
  return row[after.length] ?? 0;
}

const baselineManifestSchema = z.object({
  files: z.array(z.object({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })),
});
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

type FileSourceLoc = {
  path: string;
  baselineSha256: string | null;
  finalSha256: string | null;
  baselineLoc: number;
  finalLoc: number;
  retainedTemplateLoc: number;
  postTemplateLoc: number;
  removedOrReplacedTemplateLoc: number;
};

export function sourceLocReport(
  repo: string,
  app: string,
  baselineRef: string,
  finalRef: string,
  scopeInput: unknown,
) {
  const scope = backendScopeSchema.parse(scopeInput);
  if (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(app) || app.split("/").some((p) => p === ".." || p === "."))
    throw new Error("Supply an application directory relative to the repository root.");
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const commit = (ref: string) =>
    git("rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`).trim();
  const baselineCommit = commit(baselineRef);
  const finalCommit = commit(finalRef);
  const tree = (revision: string) => {
    const files = new Map<string, { blob: string; mode: string }>();
    for (const entry of git("ls-tree", "-rz", "--full-tree", revision, "--", app).split("\0")) {
      if (!entry) continue;
      const tab = entry.indexOf("\t");
      const [mode, kind, blob] = entry.slice(0, tab).split(" ");
      const path = entry.slice(tab + 1);
      if (!path.startsWith(`${app}/`) || kind !== "blob" || !mode || !blob)
        throw new Error(`Unsupported tree entry: ${path}`);
      files.set(path.slice(app.length + 1), { blob, mode });
    }
    return files;
  };
  const baseline = tree(baselineCommit);
  const final = tree(finalCommit);
  const manifestText = git("show", `${baselineCommit}:${app}/.jeeves/manifest.json`);
  const manifest = baselineManifestSchema.parse(JSON.parse(manifestText));
  const generated = new Map(manifest.files.map((f) => [f.path, f.sha256]));
  if (generated.size !== manifest.files.length)
    throw new Error("Duplicate baseline manifest paths.");
  const included: FileSourceLoc[] = [];
  const excluded = [];
  for (const path of [...new Set([...baseline.keys(), ...final.keys()])].sort()) {
    // UI exclusions win even inside a backend directory or outside src/. Names such as
    // "clients" can mean backend service adapters, so classify by reviewed paths, not guesses.
    const reason = matchesPath(path, scope.uiPaths)
      ? "ui-source"
      : matchesPath(path, scope.configurationPaths ?? [])
        ? "configuration-or-build"
        : exclusionReason(path);
    if (reason) {
      excluded.push({ path, reason });
      continue;
    }
    if (!matchesPath(path, scope.backendPaths))
      throw new Error(`Unclassified source: ${path}. Declare it in backendPaths or uiPaths.`);
    const read = (files: ReturnType<typeof tree>) => {
      const entry = files.get(path);
      if (!entry) return "";
      if (entry.mode !== "100644" && entry.mode !== "100755")
        throw new Error(`Source must be a regular file: ${path}`);
      return git("cat-file", "blob", entry.blob);
    };
    const before = read(baseline);
    const after = read(final);
    if (baseline.has(path) && generated.get(path) !== sha256(before))
      throw new Error(`Baseline source does not match its generated manifest: ${path}`);
    const initial = codeLines(path, before);
    const completed = codeLines(path, after);
    const retained = retainedLines(initial, completed);
    included.push({
      path,
      baselineSha256: baseline.has(path) ? sha256(before) : null,
      finalSha256: final.has(path) ? sha256(after) : null,
      baselineLoc: initial.length,
      finalLoc: completed.length,
      retainedTemplateLoc: retained,
      postTemplateLoc: completed.length - retained,
      removedOrReplacedTemplateLoc: initial.length - retained,
    });
  }
  if (!included.length) throw new Error("No eligible src files in either committed application.");
  const total = (
    key:
      | "baselineLoc"
      | "finalLoc"
      | "retainedTemplateLoc"
      | "postTemplateLoc"
      | "removedOrReplacedTemplateLoc",
  ) => included.reduce((sum, file) => sum + file[key], 0);
  const finalLoc = total("finalLoc");
  const retainedTemplateLoc = total("retainedTemplateLoc");
  return {
    method: SOURCE_LOC_VERSION,
    parser: "rolldown@1.2.15",
    app,
    baselineCommit,
    finalCommit,
    baselineManifestSha256: sha256(manifestText),
    scope,
    scopeSha256: sha256(JSON.stringify(scope)),
    rules: {
      scope:
        "Backend production JS/TS in src directories, classified by an explicit scope. UI is excluded regardless of location; unclassified eligible source refuses the report. Tests, fixtures, configuration, declarations and build/vendor output excluded.",
      lines:
        "Physical nonblank lines after parsed comments are removed; indentation ignored, other code and wrapping preserved.",
      attribution:
        "Longest ordered matching lines in the same path are retained template lines; other final lines are post-template. New paths are entirely post-template; renames are not inferred.",
      interpretation:
        "Source composition only. Includes boilerplate and stubs; does not measure working behavior, quality, labor saved or agent versus human authorship.",
    },
    totals: {
      includedFiles: included.length,
      baselineLoc: total("baselineLoc"),
      finalLoc,
      retainedTemplateLoc,
      postTemplateLoc: total("postTemplateLoc"),
      removedOrReplacedTemplateLoc: total("removedOrReplacedTemplateLoc"),
      templatePercent: finalLoc ? Math.round((retainedTemplateLoc / finalLoc) * 10000) / 100 : null,
    },
    included,
    excluded,
  };
}
