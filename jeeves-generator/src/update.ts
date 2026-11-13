export type UpdateActionKind =
  // generated files
  | "create"
  | "replace"
  | "unchanged"
  // the application's own files
  | "keep"
  | "keep-changed"
  // a generated file the application declared as its own
  | "override"
  // files the new export no longer has
  | "remove"
  | "orphan"
  // a generated file edited by hand: refuses the update
  | "edited";
export type UpdateAction = { path: string; action: UpdateActionKind };
export type ManifestFile = { path: string; sha256: string; ownership: string };

/** Hook files, stub bodies and product SQL; every other ownership is generated. */
const extension = "generated-extension";
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Decides, file by file, what regenerating into an existing export does. It never deletes,
 * overwrites or takes over a file the application owns, and a shadow under `.jeeves/generated/`
 * stays until the application's file equals the new bytes or the application deletes it. It
 * reads nothing from disk and writes nothing.
 */
export function planUpdate(input: {
  /** The new export's files, each with its ownership from the new manifest. */
  next: readonly ManifestFile[];
  /** The files of the manifest already in the directory. */
  previous: readonly ManifestFile[];
  /** SHA-256 of each file now on disk, for every path in `next`, `previous` or `overrides` that exists. */
  disk: ReadonlyMap<string, string>;
  /** Generated paths the application keeps as its own (`.jeeves/overrides.json`). */
  overrides: readonly string[];
  /** Paths that already have a file under `.jeeves/generated/` from an earlier update. */
  pendingShadows: readonly string[];
}): { actions: UpdateAction[]; refused: string[]; shadows: string[] } {
  const next = new Map(input.next.map((file) => [file.path, file]));
  const previous = new Map(input.previous.map((file) => [file.path, file]));
  const overrides = new Set(input.overrides);
  const pending = new Set(input.pendingShadows);
  const actions: UpdateAction[] = [];
  const ownershipChanged = new Set<string>();
  const unknownOverrides: string[] = [];
  const add = (path: string, action: UpdateActionKind) => actions.push({ path, action });

  for (const [path, file] of next) {
    const onDisk = input.disk.get(path);
    const before = previous.get(path);
    if (file.ownership !== extension) {
      // An application's file never becomes generated.
      if (before?.ownership === extension) {
        ownershipChanged.add(path);
        add(path, "edited");
      } else if (overrides.has(path)) add(path, "override");
      else if (onDisk === undefined) add(path, "create");
      // An unknown file is in the way, even with the same bytes.
      else if (before === undefined) add(path, "edited");
      else if (onDisk === file.sha256) add(path, "unchanged");
      else if (onDisk === before.sha256) add(path, "replace");
      else add(path, "edited");
    } else if (onDisk === undefined) add(path, "create");
    else if (onDisk === file.sha256) add(path, "unchanged");
    else if (before?.sha256 === file.sha256 && !pending.has(path)) add(path, "keep");
    else add(path, "keep-changed");
  }

  for (const [path, file] of previous) {
    if (next.has(path)) continue;
    const onDisk = input.disk.get(path);
    if (onDisk === undefined) continue;
    if (overrides.has(path) || file.ownership === extension) add(path, "orphan");
    else if (onDisk === file.sha256) add(path, "remove");
    else add(path, "edited");
  }

  for (const path of overrides) {
    if (next.has(path) || previous.has(path)) continue;
    // An override the export dropped earlier is still the application's.
    if (input.disk.get(path) !== undefined) add(path, "orphan");
    else unknownOverrides.push(path);
  }

  actions.sort((a, b) => compare(a.path, b.path));
  const refused = [
    ...actions
      .filter(({ action }) => action === "edited")
      .map(({ path }) => (ownershipChanged.has(path) ? `ownership changed: ${path}` : path)),
    ...unknownOverrides.sort(compare).map((path) => `unknown override: ${path}`),
  ];
  const shadows = actions
    .filter(({ action }) => action === "override" || action === "keep-changed")
    .map(({ path }) => path);
  return { actions, refused, shadows };
}
