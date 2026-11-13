import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stubStackDesign } from "../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import { loadLocalV2Registry } from "../templates/local-v2/index.ts";
import { exportNewDirectory } from "./export.ts";
import { canonicalJson, sha256 } from "./json.ts";
import {
  type ManifestFile,
  planUpdate,
  type UpdateActionKind,
  type UpdateResult,
  updateDirectory,
} from "./update.ts";
import { assembleV2 } from "./v2/assemble.ts";

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

describe("updateDirectory", () => {
  const bundle = assembleV2(
    { designJson: canonicalJson(stubStackDesign()) },
    loadLocalV2Registry(),
  );
  const files = bundle.manifest.files.length;
  const stub = "src/modules/links-api/redirector.ts",
    deleted = "scripts/status.mjs",
    older = "compose.yaml",
    edited = "tsconfig.json",
    replaced = "README.md";
  const generated = (path: string) => {
    const file = bundle.files.find((item) => item.path === path);
    if (!file) throw new Error(`No generated ${path}`);
    return Buffer.from(file.bytes);
  };
  const quiet: UpdateResult = {
    directory: "",
    check: false,
    refused: [],
    counts: { create: 0, replace: 0, unchanged: files, keep: 0 },
    keepChanged: [],
    override: [],
    remove: [],
    orphan: [],
  };
  let scratch = "";
  beforeEach(async () => {
    scratch = await realpath(await mkdtemp(join(tmpdir(), "jeeves-update-test-")));
  });
  afterEach(async () => {
    await rm(scratch, { recursive: true, force: true });
  });

  it("names files of the stub stack with the ownership the tests assume", () => {
    const ownership = (path: string) =>
      bundle.manifest.files.find((file) => file.path === path)?.ownership;
    expect(ownership(stub)).toBe("generated-extension");
    for (const path of [deleted, older, edited, replaced])
      expect(ownership(path)).toBe("generated-scaffold");
  });

  const exported = async () => {
    const directory = join(scratch, "app");
    await exportNewDirectory(bundle.files, directory);
    return directory;
  };
  /** Every file and symlink under the directory: its SHA-256, or where the link points. */
  const snapshot = async (directory: string) => {
    const found: Record<string, string> = {};
    const walk = async (relative: string) => {
      for (const item of await readdir(join(directory, relative), { withFileTypes: true })) {
        const path = relative ? `${relative}/${item.name}` : item.name;
        if (item.isDirectory()) await walk(path);
        else if (item.isSymbolicLink())
          found[path] = `symlink ${await readlink(join(directory, path))}`;
        else found[path] = sha256(await readFile(join(directory, path)));
      }
    };
    await walk("");
    return found;
  };
  const editManifest = async (directory: string, edit: (files: ManifestFile[]) => void) => {
    const path = join(directory, ".jeeves/manifest.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    edit(manifest.files);
    await writeFile(path, `${JSON.stringify(manifest)}\n`);
  };
  const setHash = (directory: string, path: string, hash: string) =>
    editManifest(directory, (records) => {
      const record = records.find((item) => item.path === path);
      if (!record) throw new Error(`No record for ${path}`);
      record.sha256 = hash;
    });
  /** The scaffold file changed as an older export left it: a replace. */
  const makeOlder = async (directory: string) => {
    await writeFile(join(directory, older), "older bytes\n");
    await setHash(directory, older, sha256("older bytes\n"));
  };
  const overrides = (directory: string, ...paths: string[]) =>
    writeFile(
      join(directory, ".jeeves/overrides.json"),
      JSON.stringify({ overrides: paths.map((path) => ({ path, reason: "template gap" })) }),
    );
  const update = (directory: string, check = false) =>
    updateDirectory(bundle, directory, { check });
  const read = (directory: string, path: string) => readFile(join(directory, path));
  const exists = (directory: string, path: string) =>
    lstat(join(directory, path)).then(
      () => true,
      () => false,
    );

  it("1. leaves an export unchanged when the design is the same", async () => {
    const directory = await exported();
    const before = await snapshot(directory);
    expect(await update(directory)).toEqual({ ...quiet, directory });
    expect(await snapshot(directory)).toEqual(before);
  });

  it("2. keeps a stub body, recreates a deleted file and replaces an older one", async () => {
    const directory = await exported();
    await writeFile(join(directory, stub), "export const mine = true;\n");
    await rm(join(directory, deleted));
    await makeOlder(directory);
    await writeFile(join(directory, "notes.md"), "the application's own\n");
    // A generated file the new export no longer has.
    await writeFile(join(directory, "src/dropped.ts"), "export {};\n");
    await editManifest(directory, (records) => {
      records.push({
        path: "src/dropped.ts",
        sha256: sha256("export {};\n"),
        ownership: "generated-scaffold",
      });
    });
    expect(await update(directory)).toEqual({
      ...quiet,
      directory,
      counts: { create: 1, replace: 1, unchanged: files - 3, keep: 1 },
      remove: ["src/dropped.ts"],
    });
    expect(await read(directory, stub)).toEqual(Buffer.from("export const mine = true;\n"));
    expect(await read(directory, deleted)).toEqual(generated(deleted));
    expect(await read(directory, older)).toEqual(generated(older));
    expect(await read(directory, "notes.md")).toEqual(Buffer.from("the application's own\n"));
    expect(await read(directory, ".jeeves/manifest.json")).toEqual(
      generated(".jeeves/manifest.json"),
    );
    // No temporary file is left behind.
    expect(Object.keys(await snapshot(directory)).sort()).toEqual(
      [...bundle.files.map((file) => file.path), "notes.md"].sort(),
    );
  });

  it("3. refuses a hand-edited generated file and changes nothing", async () => {
    const directory = await exported();
    await writeFile(join(directory, edited), "{}\n");
    await rm(join(directory, deleted));
    await makeOlder(directory);
    const before = await snapshot(directory);
    expect(await update(directory)).toEqual({
      ...quiet,
      directory,
      refused: [edited],
      counts: { create: 1, replace: 1, unchanged: files - 3, keep: 0 },
    });
    expect(await snapshot(directory)).toEqual(before);
  });

  it("4. keeps an override and writes its new bytes under .jeeves/generated", async () => {
    const directory = await exported();
    await writeFile(join(directory, edited), "{}\n");
    await overrides(directory, edited);
    expect(await update(directory)).toEqual({
      ...quiet,
      directory,
      counts: { create: 0, replace: 0, unchanged: files - 1, keep: 0 },
      override: [edited],
    });
    expect(await read(directory, edited)).toEqual(Buffer.from("{}\n"));
    expect(await read(directory, `.jeeves/generated/${edited}`)).toEqual(generated(edited));
    // Once the file equals the generated bytes again, its shadow goes.
    await writeFile(join(directory, edited), generated(edited));
    await overrides(directory);
    expect(await update(directory)).toEqual({ ...quiet, directory });
    expect(await exists(directory, ".jeeves/generated")).toBe(false);
  });

  it("5. writes nothing with check", async () => {
    const directory = await exported();
    await rm(join(directory, deleted));
    await makeOlder(directory);
    await writeFile(join(directory, stub), "export const mine = true;\n");
    await setHash(directory, stub, sha256("an older stub\n"));
    const before = await snapshot(directory);
    expect(await update(directory, true)).toEqual({
      ...quiet,
      directory,
      check: true,
      counts: { create: 1, replace: 1, unchanged: files - 3, keep: 0 },
      keepChanged: [stub],
    });
    expect(await snapshot(directory)).toEqual(before);
  });

  it("6. refuses a directory that is not a Jeeves v2 export", async () => {
    const empty = join(scratch, "empty");
    await mkdir(empty);
    await expect(update(empty)).rejects.toThrow(`Not a Jeeves v2 export: ${empty}`);
    const directory = await exported();
    await expect(update("app")).rejects.toThrow("Not a Jeeves v2 export: app");
    await symlink(directory, join(scratch, "link"));
    await expect(update(join(scratch, "link"))).rejects.toThrow("Not a Jeeves v2 export");
    await writeFile(join(directory, ".jeeves/manifest.json"), '{"format":"jeeves-v1"}\n');
    await expect(update(directory)).rejects.toThrow(`Not a Jeeves v2 export: ${directory}`);
  });

  it("7. refuses a symlink in place of a file before writing anything", async () => {
    const directory = await exported();
    await makeOlder(directory);
    // Followed, the link's target would make the README a replace.
    await writeFile(join(scratch, "outside.txt"), "outside\n");
    await rm(join(directory, replaced));
    await symlink(join(scratch, "outside.txt"), join(directory, replaced));
    await setHash(directory, replaced, sha256("outside\n"));
    await expect(update(directory)).rejects.toThrow(`Unsafe update path: ${replaced}`);
    expect(await read(directory, older)).toEqual(Buffer.from("older bytes\n"));
    expect(await readFile(join(scratch, "outside.txt"), "utf8")).toBe("outside\n");
    // A symlinked parent directory is refused too.
    await rm(join(directory, replaced));
    await writeFile(join(directory, replaced), generated(replaced));
    await rm(join(directory, "scripts"), { recursive: true });
    await mkdir(join(scratch, "scripts"));
    await symlink(join(scratch, "scripts"), join(directory, "scripts"));
    await expect(update(directory)).rejects.toThrow("Unsafe update path: scripts/");
    expect(await read(directory, older)).toEqual(Buffer.from("older bytes\n"));
    expect(await readdir(join(scratch, "scripts"))).toEqual([]);
  });

  it("8. refuses a manifest record that is a directory of a generated file", async () => {
    const directory = await exported();
    await makeOlder(directory);
    await editManifest(directory, (records) => {
      records.push({
        path: "src/runtime",
        sha256: "0".repeat(64),
        ownership: "generated-scaffold",
      });
    });
    await expect(update(directory)).rejects.toThrow("Invalid .jeeves/manifest.json");
    // Without the files under it, the old manifest is valid but collides with the new one.
    await editManifest(directory, (records) => {
      records.splice(
        records.findIndex((record) => record.path === "src/runtime/local.ts"),
        1,
      );
    });
    await expect(update(directory)).rejects.toThrow("OUTPUT_COLLISION at src/runtime");
    expect(await read(directory, older)).toEqual(Buffer.from("older bytes\n"));
  });

  it("9. keeps a pending shadow across updates until the application deletes it", async () => {
    const directory = await exported();
    await writeFile(join(directory, stub), "export const mine = true;\n");
    await setHash(directory, stub, sha256("an older stub\n"));
    const keepChanged = {
      ...quiet,
      directory,
      counts: { create: 0, replace: 0, unchanged: files - 1, keep: 0 },
      keepChanged: [stub],
    };
    expect(await update(directory)).toEqual(keepChanged);
    expect(await read(directory, `.jeeves/generated/${stub}`)).toEqual(generated(stub));
    expect(await update(directory)).toEqual(keepChanged);
    expect(await read(directory, `.jeeves/generated/${stub}`)).toEqual(generated(stub));
    await rm(join(directory, `.jeeves/generated/${stub}`));
    expect(await update(directory)).toEqual({
      ...quiet,
      directory,
      counts: { create: 0, replace: 0, unchanged: files - 1, keep: 1 },
    });
    expect(await read(directory, stub)).toEqual(Buffer.from("export const mine = true;\n"));
    // Once no shadow is left, the folder goes too.
    expect(await exists(directory, ".jeeves/generated")).toBe(false);
  });

  it("10. keeps an edited override the export no longer has, twice", async () => {
    const directory = await exported();
    await editManifest(directory, (records) => {
      records.push({
        path: "extra.txt",
        sha256: sha256("from an older export\n"),
        ownership: "generated-scaffold",
      });
    });
    await writeFile(join(directory, "extra.txt"), "the application's\n");
    await overrides(directory, "extra.txt");
    const orphan = { ...quiet, directory, orphan: ["extra.txt"] };
    expect(await update(directory)).toEqual(orphan);
    expect(await update(directory)).toEqual(orphan);
    expect(await read(directory, "extra.txt")).toEqual(Buffer.from("the application's\n"));
    expect(await exists(directory, ".jeeves/generated")).toBe(false);
  });

  it("refuses an invalid manifest or overrides file before writing anything", async () => {
    const directory = await exported();
    await makeOlder(directory);
    const manifest = await readFile(join(directory, ".jeeves/manifest.json"), "utf8");
    const record = (value: object) => async () => {
      await writeFile(join(directory, ".jeeves/manifest.json"), manifest);
      await editManifest(directory, (records) => {
        records.push(value as ManifestFile);
      });
    };
    for (const setUp of [
      record({ path: "a.txt", sha256: "A".repeat(64), ownership: "generated-scaffold" }),
      record({ path: "a.txt", sha256: "0".repeat(64), ownership: "scaffold" }),
      record({ path: "../a.txt", sha256: "0".repeat(64), ownership: "generated-scaffold" }),
      record({ path: "COMPOSE.yaml", sha256: "0".repeat(64), ownership: "generated-scaffold" }),
      record({
        path: ".jeeves/generated/a.txt",
        sha256: "0".repeat(64),
        ownership: "generated-scaffold",
      }),
    ]) {
      await setUp();
      await expect(update(directory)).rejects.toThrow("Invalid .jeeves/manifest.json");
    }
    await writeFile(join(directory, ".jeeves/manifest.json"), manifest);
    for (const value of [
      { overrides: [{ path: edited, reason: "" }] },
      { overrides: [{ path: ".jeeves/report.json", reason: "mine" }] },
      {
        overrides: [
          { path: edited, reason: "mine" },
          { path: edited, reason: "again" },
        ],
      },
      { override: [] },
    ]) {
      await writeFile(join(directory, ".jeeves/overrides.json"), JSON.stringify(value));
      await expect(update(directory)).rejects.toThrow("Invalid .jeeves/overrides.json");
    }
    expect(await read(directory, older)).toEqual(Buffer.from("older bytes\n"));
  });
});
