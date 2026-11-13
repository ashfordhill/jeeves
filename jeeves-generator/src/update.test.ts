import { describe, expect, it } from "vitest";
import { type ManifestFile, planUpdate, type UpdateActionKind } from "./update.ts";

const NEW = "sha-new",
  OLD = "sha-old",
  HAND = "sha-edited-by-hand";
const path = "src/runtime/http.ts",
  hook = "src/modules/upload/upload-multipart.hooks.ts";
const generated = (path: string, sha256: string): ManifestFile => ({
  path,
  sha256,
  ownership: "generated-scaffold",
});
const extension = (path: string, sha256: string): ManifestFile => ({
  path,
  sha256,
  ownership: "generated-extension",
});

type Input = {
  next?: ManifestFile[];
  previous?: ManifestFile[];
  disk?: Record<string, string>;
  overrides?: string[];
  pendingShadows?: string[];
};
function plan({ next = [], previous = [], disk = {}, overrides = [], pendingShadows = [] }: Input) {
  return planUpdate({
    next,
    previous,
    disk: new Map(Object.entries(disk)),
    overrides,
    pendingShadows,
  });
}

describe("planUpdate", () => {
  const rows: {
    row: string;
    input: Input;
    on: string;
    action?: UpdateActionKind;
    refused?: string[];
    shadows?: string[];
  }[] = [
    {
      row: "ownership: an application's file never becomes generated",
      input: {
        next: [generated(path, NEW)],
        previous: [extension(path, OLD)],
        disk: { [path]: OLD },
      },
      on: path,
      action: "edited",
      refused: [`ownership changed: ${path}`],
    },
    {
      row: "G1: overridden",
      input: {
        next: [generated(path, NEW)],
        previous: [generated(path, OLD)],
        disk: { [path]: HAND },
        overrides: [path],
      },
      on: path,
      action: "override",
      shadows: [path],
    },
    {
      row: "G2: absent on disk",
      input: { next: [generated(path, NEW)], previous: [generated(path, OLD)] },
      on: path,
      action: "create",
    },
    {
      row: "G3: not in the previous manifest",
      input: { next: [generated(path, NEW)], disk: { [path]: HAND } },
      on: path,
      action: "edited",
      refused: [path],
    },
    {
      row: "G4: disk equals the new bytes",
      input: {
        next: [generated(path, NEW)],
        previous: [generated(path, OLD)],
        disk: { [path]: NEW },
      },
      on: path,
      action: "unchanged",
    },
    {
      row: "G5: disk equals the previous bytes",
      input: {
        next: [generated(path, NEW)],
        previous: [generated(path, OLD)],
        disk: { [path]: OLD },
      },
      on: path,
      action: "replace",
    },
    {
      row: "G6: edited by hand",
      input: {
        next: [generated(path, NEW)],
        previous: [generated(path, OLD)],
        disk: { [path]: HAND },
      },
      on: path,
      action: "edited",
      refused: [path],
    },
    {
      row: "E1: absent on disk",
      input: { next: [extension(hook, NEW)], previous: [extension(hook, OLD)] },
      on: hook,
      action: "create",
    },
    {
      row: "E2: disk equals the new bytes",
      input: {
        next: [extension(hook, NEW)],
        previous: [extension(hook, OLD)],
        disk: { [hook]: NEW },
      },
      on: hook,
      action: "unchanged",
    },
    {
      row: "E3: the template did not change it",
      input: {
        next: [extension(hook, NEW)],
        previous: [extension(hook, NEW)],
        disk: { [hook]: HAND },
      },
      on: hook,
      action: "keep",
    },
    {
      row: "E4: the template changed it",
      input: {
        next: [extension(hook, NEW)],
        previous: [extension(hook, OLD)],
        disk: { [hook]: HAND },
      },
      on: hook,
      action: "keep-changed",
      shadows: [hook],
    },
    { row: "R1: already gone", input: { previous: [generated(path, OLD)] }, on: path },
    {
      row: "R2: overridden",
      input: { previous: [generated(path, OLD)], disk: { [path]: HAND }, overrides: [path] },
      on: path,
      action: "orphan",
    },
    {
      row: "R3: the application's file, even unchanged",
      input: { previous: [extension(hook, OLD)], disk: { [hook]: OLD } },
      on: hook,
      action: "orphan",
    },
    {
      row: "R4: disk equals the previous bytes",
      input: { previous: [generated(path, OLD)], disk: { [path]: OLD } },
      on: path,
      action: "remove",
    },
    {
      row: "R5: edited by hand",
      input: { previous: [generated(path, OLD)], disk: { [path]: HAND } },
      on: path,
      action: "edited",
      refused: [path],
    },
    {
      row: "U1: an override the export dropped earlier",
      input: { disk: { [path]: HAND }, overrides: [path] },
      on: path,
      action: "orphan",
    },
    {
      row: "U2: an override with no file",
      input: { overrides: [path] },
      on: path,
      refused: [`unknown override: ${path}`],
    },
  ];
  it("has one case per row", () => expect(rows).toHaveLength(18));
  it.each(rows)("$row", ({ input, on, action, refused = [], shadows = [] }) => {
    expect(plan(input)).toEqual({
      actions: action ? [{ path: on, action }] : [],
      refused,
      shadows,
    });
  });

  it("refuses an unknown file in the way even with the same bytes (G3)", () => {
    expect(plan({ next: [generated(path, NEW)], disk: { [path]: NEW } })).toEqual({
      actions: [{ path, action: "edited" }],
      refused: [path],
      shadows: [],
    });
  });

  it("lets an override win over equal hashes (G1, R2)", () => {
    const override = {
      previous: [generated(path, OLD)],
      disk: { [path]: NEW },
      overrides: [path],
    };
    expect(plan({ ...override, next: [generated(path, NEW)] })).toEqual({
      actions: [{ path, action: "override" }],
      refused: [],
      shadows: [path],
    });
    expect(plan({ ...override, disk: { [path]: OLD } })).toEqual({
      actions: [{ path, action: "orphan" }],
      refused: [],
      shadows: [],
    });
  });

  it("never recreates an overridden file the application deleted (G1)", () => {
    expect(
      plan({ next: [generated(path, NEW)], previous: [generated(path, OLD)], overrides: [path] }),
    ).toEqual({ actions: [{ path, action: "override" }], refused: [], shadows: [path] });
  });

  it("applies the ownership rule before an override", () => {
    const result = plan({
      next: [{ path, sha256: NEW, ownership: "generator-metadata" }],
      previous: [extension(path, OLD)],
      disk: { [path]: NEW },
      overrides: [path],
    });
    expect(result).toEqual({
      actions: [{ path, action: "edited" }],
      refused: [`ownership changed: ${path}`],
      shadows: [],
    });
  });

  it("lists refused paths in path order, then unknown overrides", () => {
    const result = plan({
      next: [generated("src/c.ts", NEW), generated("src/b.ts", NEW)],
      previous: [
        generated("src/c.ts", OLD),
        extension("src/b.ts", OLD),
        generated("src/a.ts", OLD),
      ],
      disk: { "src/c.ts": HAND, "src/b.ts": OLD, "src/a.ts": HAND },
      overrides: ["src/z.ts", "src/0.ts"],
    });
    expect(result.refused).toEqual([
      "src/a.ts",
      "ownership changed: src/b.ts",
      "src/c.ts",
      "unknown override: src/0.ts",
      "unknown override: src/z.ts",
    ]);
  });

  it("shadows only override and keep-changed paths", () => {
    const result = plan({
      next: [
        extension("src/modules/b/b.ts", NEW),
        generated("src/runtime/c.ts", NEW),
        extension("src/modules/a/a.ts", NEW),
        extension("src/modules/d/d.ts", NEW),
        generated("src/runtime/e.ts", NEW),
      ],
      previous: [
        extension("src/modules/b/b.ts", OLD),
        generated("src/runtime/c.ts", OLD),
        extension("src/modules/a/a.ts", NEW),
        extension("src/modules/d/d.ts", OLD),
        generated("src/runtime/e.ts", OLD),
      ],
      disk: {
        "src/modules/b/b.ts": HAND,
        "src/runtime/c.ts": HAND,
        "src/modules/a/a.ts": HAND,
        // The application made its file equal to the new bytes: its pending shadow goes.
        "src/modules/d/d.ts": NEW,
        "src/runtime/e.ts": OLD,
      },
      overrides: ["src/runtime/c.ts"],
      pendingShadows: ["src/modules/d/d.ts"],
    });
    expect(result).toEqual({
      actions: [
        { path: "src/modules/a/a.ts", action: "keep" },
        { path: "src/modules/b/b.ts", action: "keep-changed" },
        { path: "src/modules/d/d.ts", action: "unchanged" },
        { path: "src/runtime/c.ts", action: "override" },
        { path: "src/runtime/e.ts", action: "replace" },
      ],
      refused: [],
      shadows: ["src/modules/b/b.ts", "src/runtime/c.ts"],
    });
  });

  it("sorts actions by path in code-point order, whichever rule decided them", () => {
    const result = plan({
      next: [
        generated("src/z.ts", NEW),
        extension("src/Z.ts", NEW),
        { path: ".jeeves/manifest.json", sha256: NEW, ownership: "generator-metadata" },
      ],
      previous: [
        generated("src/z.ts", OLD),
        generated("src/a.ts", OLD),
        { path: ".jeeves/manifest.json", sha256: OLD, ownership: "generator-metadata" },
      ],
      disk: { "src/z.ts": OLD, "src/a.ts": OLD, "src/m.ts": HAND, ".jeeves/manifest.json": OLD },
      overrides: ["src/m.ts"],
    });
    expect(result.actions).toEqual([
      { path: ".jeeves/manifest.json", action: "replace" },
      { path: "src/Z.ts", action: "create" },
      { path: "src/a.ts", action: "remove" },
      { path: "src/m.ts", action: "orphan" },
      { path: "src/z.ts", action: "replace" },
    ]);
  });

  describe("two consecutive updates", () => {
    it("keeps an edited override the export dropped as orphan, never an unknown override", () => {
      const dropped = "src/runtime/dropped.ts";
      const next = [generated(path, NEW)];
      const disk = { [path]: NEW, [dropped]: HAND };
      const first = plan({
        next,
        previous: [generated(path, OLD), generated(dropped, OLD)],
        disk,
        overrides: [dropped],
      });
      expect(first).toEqual({
        actions: [
          { path: dropped, action: "orphan" },
          { path, action: "unchanged" },
        ],
        refused: [],
        shadows: [],
      });
      // PF10 leaves the first update's manifest, `next`, in the directory.
      const second = plan({ next, previous: next, disk, overrides: [dropped] });
      expect(second).toEqual(first);
    });

    it("keeps an edited extension as keep-changed while its shadow is pending, then keep", () => {
      const next = [extension(hook, NEW)];
      const disk = { [hook]: HAND };
      const first = plan({ next, previous: [extension(hook, OLD)], disk });
      expect(first).toEqual({
        actions: [{ path: hook, action: "keep-changed" }],
        refused: [],
        shadows: [hook],
      });
      expect(plan({ next, previous: next, disk, pendingShadows: first.shadows })).toEqual(first);
      // The application deleted the shadow, accepting its file as it is.
      expect(plan({ next, previous: next, disk, pendingShadows: [] })).toEqual({
        actions: [{ path: hook, action: "keep" }],
        refused: [],
        shadows: [],
      });
    });
  });
});
