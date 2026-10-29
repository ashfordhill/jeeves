import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeProjectFiles } from "./harness/project.ts";
import { renderScaffold, renderText } from "./scaffold.ts";

const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "template-kit-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("renderScaffold", () => {
  it("renders every file, sorted, as scaffold-owned under the target directory", () => {
    const source = tempDir();
    mkdirSync(join(source, "src"));
    writeFileSync(join(source, "src/main.ts"), "// {{ name }} entry\n");
    writeFileSync(join(source, "README.md"), "# {{name}}\n");
    expect(renderScaffold(source, "services/api", { name: "API" })).toEqual([
      { path: "services/api/README.md", contents: "# API\n", ownership: "scaffold" },
      { path: "services/api/src/main.ts", contents: "// API entry\n", ownership: "scaffold" },
    ]);
  });

  it("throws on a placeholder with no value", () => {
    expect(() => renderText("{{missing}}", {}, "x.ts")).toThrow("x.ts: no value for {{missing}}");
  });
});

describe("writeProjectFiles", () => {
  it("overwrites generated files and leaves existing scaffold files alone", () => {
    const dir = tempDir();
    const files = [
      { path: "a/gen.txt", contents: "v1", ownership: "generated" as const },
      { path: "a/own.txt", contents: "v1", ownership: "scaffold" as const },
    ];
    expect(writeProjectFiles(dir, files)).toEqual(["a/gen.txt", "a/own.txt"]);
    const again = files.map((f) => ({ ...f, contents: "v2" }));
    expect(writeProjectFiles(dir, again)).toEqual(["a/gen.txt"]);
  });
});
