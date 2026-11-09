// Recount a fresh generic export with the existing source-loc-v2 parser and scope.
// The existing completed app is a retrospective reference, not a new completion experiment.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  codeLines,
  exclusionReason,
  retainedLines,
} from "../../../../../jeeves-generator/src/source-loc.ts";

const [directory, ...extra] = process.argv.slice(2);
if (!directory || extra.length) throw Error("Usage: tsx count-generic.ts /absolute/fresh-export");
const root = fileURLToPath(new URL("../../../../../", import.meta.url));
const scopePath = "field-projects/youtube/v2/notes/benchmarks/backend-scope.json";
const scopeBytes = readFileSync(resolve(root, scopePath));
const scope: { backendPaths: string[]; uiPaths: string[]; configurationPaths?: string[] } =
  JSON.parse(scopeBytes.toString());
const matches = (path: string, roots: string[]) =>
  roots.some((r) => path === r || path.startsWith(`${r}/`));
const reason = (path: string) =>
  matches(path, scope.uiPaths)
    ? "ui-source"
    : matches(path, scope.configurationPaths ?? [])
      ? "configuration-or-build"
      : exclusionReason(path);
const hash = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const manifestBytes = readFileSync(resolve(directory, ".jeeves/manifest.json"));
const manifest = JSON.parse(manifestBytes.toString());
const prior = JSON.parse(readFileSync(new URL("source-loc-v2.json", import.meta.url), "utf8"));
const finalCommit = prior.finalCommit as string;
const completed = new Map<string, { source: string; lines: string[]; sha256: string }>();
for (const file of prior.included as { path: string; finalSha256: string; finalLoc: number }[]) {
  const source = execFileSync("git", ["show", `${finalCommit}:${prior.app}/${file.path}`], {
    cwd: root,
    encoding: "utf8",
  });
  const lines = codeLines(file.path, source);
  if (hash(source) !== file.finalSha256 || lines.length !== file.finalLoc)
    throw Error(`Historical source mismatch: ${file.path}`);
  completed.set(file.path, { source, lines, sha256: hash(source) });
}
const completedBackendLoc = [...completed.values()].reduce((n, f) => n + f.lines.length, 0);
if (completedBackendLoc !== prior.totals.finalLoc) throw Error("Historical total differs");
const files = new Map<string, string>();
const excluded: { path: string; reason: string }[] = [];
for (const file of manifest.files as { path: string; bytes: number; sha256: string }[]) {
  const bytes = readFileSync(resolve(directory, file.path));
  if (bytes.length !== file.bytes || hash(bytes) !== file.sha256)
    throw Error(`Export differs from manifest: ${file.path}`);
  const why = reason(file.path);
  if (why) excluded.push({ path: file.path, reason: why });
  else {
    if (!matches(file.path, scope.backendPaths)) throw Error(`Unclassified source: ${file.path}`);
    files.set(file.path, bytes.toString());
  }
}
const included = [...files]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, source]) => {
    const lines = codeLines(path, source);
    const final = completed.get(path);
    return {
      path,
      sha256: hash(source),
      generatedLoc: lines.length,
      matchesCompletedLoc: retainedLines(lines, final?.lines ?? []),
      byteIdenticalToCompleted: source === final?.source,
    };
  });
const generatedBackendLoc = included.reduce((n, f) => n + f.generatedLoc, 0);
const matchingCompletedBackendLoc = included.reduce((n, f) => n + f.matchesCompletedLoc, 0);
const report = JSON.parse(readFileSync(resolve(directory, ".jeeves/report.json"), "utf8"));
console.log(
  JSON.stringify(
    {
      purpose:
        "Fresh generic-only export count; retrospective overlap with existing v2, not newly observed post-generation completion work.",
      method: prior.method,
      parser: prior.parser,
      scope,
      scopeFileSha256: hash(scopeBytes),
      input: manifest.input,
      manifestSha256: hash(manifestBytes),
      registrySha256: manifest.registry.sha256,
      exportFiles: manifest.files.length + 1,
      includedFiles: included.length,
      generatedBackendLoc,
      applicationComplete: report.applicationComplete,
      requiredCustomGaps: report.gaps.filter((g: { required: boolean }) => g.required),
      existingCompletion: {
        commit: finalCommit,
        backendLoc: completedBackendLoc,
        matchingCompletedBackendLoc,
        completionOnlyLoc: completedBackendLoc - matchingCompletedBackendLoc,
        generatedOnlyLoc: generatedBackendLoc - matchingCompletedBackendLoc,
        overlapPercent:
          Math.round((matchingCompletedBackendLoc / completedBackendLoc) * 10000) / 100,
        filesAbsentFromGenericExport: [...completed]
          .filter(([path]) => !files.has(path))
          .map(([path, file]) => ({ path, loc: file.lines.length, sha256: file.sha256 })),
      },
      included,
      excluded,
    },
    null,
    2,
  ),
);
