import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeLines, exclusionReason, retainedLines, sourceLocReport } from "./source-loc.ts";

describe("source LOC benchmark", () => {
  it("removes actual comments, preserving literals, regexes and Unicode offsets", () => {
    expect(
      codeLines(
        "src/a.ts",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Literal parser fixture.
        '// header\nconst url = "https://é.example"; // note\n/* block\n * comment */\nconst re = /https?:\\/\\//;\nconst sql = `\n// literal text\n${1 /* expression comment */}\n`;\n',
      ),
    ).toEqual([
      'const url = "https://é.example";',
      "const re = /https?:\\/\\//;",
      "const sql = `",
      "// literal text",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Expected literal source.
      "${1                         }",
      "`;",
    ]);
    expect(codeLines("src/a.ts", "// comment only\n\n/* comment */")).toEqual([]);
  });

  it("excludes tests/config/infrastructure rather than counting every generated file", () => {
    for (const path of [
      "Dockerfile",
      "config/app.json",
      "browser/main.ts",
      "src/a.test.ts",
      "src/__tests__/a.ts",
      "src/fixtures/a.ts",
      "src/test-support.ts",
      "src/env.ts",
      "src/lib/config.ts",
      "src/config/a.ts",
      "src/a.d.ts",
      "src/vendor/a.ts",
    ])
      expect(exclusionReason(path), path).not.toBeNull();
    expect(exclusionReason("src/services/watch.ts")).toBeNull();
    expect(exclusionReason("apps/api/src/contracts/video.ts")).toBeNull();
  });

  it("counts additions/replacements and does not reuse a line more than once", () => {
    expect(retainedLines(["a", "b", "c"], ["a", "replacement", "c", "new"])).toBe(2);
    expect(retainedLines(["}"], ["}", "}"])).toBe(1);
    expect(retainedLines(["removed"], [])).toBe(0);
  });

  it("uses committed source, verifies generated provenance and accounts for removed files", () => {
    const root = mkdtempSync(join(tmpdir(), "jeeves-source-loc-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    const put = (path: string, text: string) => {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), text);
    };
    const commit = () => {
      git("add", ".");
      git(
        "-c",
        "user.name=LOC check",
        "-c",
        "user.email=loc@example.invalid",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "--no-gpg-sign",
        "-m",
        "fixture",
      );
      return git("rev-parse", "HEAD");
    };
    try {
      git("init", "--quiet");
      const files = {
        "src/main.ts": "const a = 1;\nconst b = 2;\n",
        "src/removed.ts": "export const removed = 1;\n",
        "src/ui/view.ts": "export const view = 'original UI';\n",
      };
      for (const [path, source] of Object.entries(files)) put(`app/${path}`, source);
      put(
        "app/.jeeves/manifest.json",
        JSON.stringify({
          files: Object.entries(files).map(([path, text]) => ({
            path,
            sha256: createHash("sha256").update(text).digest("hex"),
          })),
        }),
      );
      const baseline = commit();
      put("app/src/main.ts", "  const a = 1; // unchanged\nconst b = 3;\n");
      put("app/src/new.ts", "export const custom = 1;\n");
      put("app/src/main.test.ts", "throw Error('excluded');\n");
      put("app/src/ui/view.ts", "export const view = 'custom UI';\n");
      put("app/frontend/src/main.ts", "document.title = 'UI in src';\n");
      rmSync(join(root, "app/src/removed.ts"));
      const completed = commit();
      put("app/src/main.ts", "not valid TypeScript in working tree");
      const scope = {
        version: 1,
        backendPaths: ["src"],
        uiPaths: ["src/ui", "frontend"],
      };
      const report = sourceLocReport(root, "app", baseline, completed, scope);
      expect(report.totals).toEqual({
        includedFiles: 3,
        baselineLoc: 3,
        finalLoc: 3,
        retainedTemplateLoc: 1,
        postTemplateLoc: 2,
        removedOrReplacedTemplateLoc: 2,
        templatePercent: 33.33,
      });
      expect(report).toEqual(sourceLocReport(root, "app", baseline, completed, { ...scope }));
      const configured = sourceLocReport(root, "app", baseline, completed, {
        ...scope,
        configurationPaths: ["src/new.ts", "src/ui"],
      });
      expect(configured.excluded).toContainEqual({
        path: "src/new.ts",
        reason: "configuration-or-build",
      });
      expect(configured.excluded).toContainEqual({ path: "src/ui/view.ts", reason: "ui-source" });
      expect(configured.included.some((file) => file.path === "src/new.ts")).toBe(false);
      expect(configured.scopeSha256).not.toBe(report.scopeSha256);
      expect(report.scope).toEqual(scope);
      expect(report.excluded).toContainEqual({ path: "src/ui/view.ts", reason: "ui-source" });
      expect(report.excluded).toContainEqual({ path: "frontend/src/main.ts", reason: "ui-source" });
      expect(() =>
        sourceLocReport(root, "app", baseline, completed, { ...scope, uiPaths: ["src/ui"] }),
      ).toThrow("Unclassified source: frontend/src/main.ts");
      expect(() => sourceLocReport(root, "app", baseline, completed, undefined)).toThrow();
      expect(() =>
        sourceLocReport(root, "app", baseline, completed, { ...scope, backendPaths: ["../src"] }),
      ).toThrow();
      expect(() => sourceLocReport(root, "app", completed, completed, scope)).toThrow(
        "Baseline source does not match",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
