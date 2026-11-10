/**
 * Target-keyed drafts. Persistence uses the project store's one serialized mutation chain. A
 * change that re-keys a target's ID (IDs follow names) moves its draft to the new ID, values,
 * flight and timers included, so editing carries on.
 */
import type { DesignDocument, OperationInput, Rekey } from "@jeeves/spec";

export type DraftValues = Record<string, unknown>;
export type DraftErrors = Record<string, string>;
export type DraftSpec = {
  projectId: string;
  target: string;
  definition: string;
  label: string;
  read(design: DesignDocument): DraftValues | undefined;
  validate(values: DraftValues): DraftErrors;
  build(design: DesignDocument, values: DraftValues, paths: readonly string[]): OperationInput[];
  /** The spec for the target's new ID, when `renamed` (old → new) re-keyed it; else undefined. */
  follow?(renamed: ReadonlyMap<string, string>, design: DesignDocument): DraftSpec | undefined;
};
export type DraftIntent = {
  projectId: string;
  rebuild(design: DesignDocument): OperationInput[] | undefined;
};
export type DraftResult =
  | { status: "saved"; design: DesignDocument; written?: DesignDocument; renamed?: Rekey[] }
  | { status: "conflict"; design: DesignDocument }
  | { status: "failed"; message: string };
export type FormDraft = {
  key: string;
  spec: DraftSpec;
  baseline: DraftValues;
  values: DraftValues;
  paths: Set<string>;
  errors: DraftErrors;
  revision: number;
  pending: boolean;
  problem?: { kind: "failed" | "conflict"; message: string };
  timer?: ReturnType<typeof setTimeout>;
  pendingTimer?: ReturnType<typeof setTimeout>;
  flight?: { values: DraftValues; promise: Promise<void> };
  flushAgain?: boolean;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const draftKey = (spec: Pick<DraftSpec, "projectId" | "target" | "definition">) =>
  JSON.stringify([spec.projectId, spec.target, spec.definition]);

class FormDrafts {
  private entries = new Map<string, FormDraft>();
  private listeners = new Set<() => void>();
  private version = 0;
  private transport?: (intent: DraftIntent) => Promise<DraftResult>;

  configure(transport: (intent: DraftIntent) => Promise<DraftResult>) {
    this.transport = transport;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  snapshot = () => this.version;
  private emit() {
    this.version++;
    for (const listener of this.listeners) listener();
  }
  forProject(projectId: string) {
    return [...this.entries.values()].filter((entry) => entry.spec.projectId === projectId);
  }
  open(spec: DraftSpec, design: DesignDocument) {
    const key = draftKey(spec);
    const existing = this.entries.get(key);
    if (existing) {
      existing.spec = spec;
      this.sync(existing, design);
      return existing;
    }
    const values = structuredClone(spec.read(design) ?? {});
    const entry: FormDraft = {
      key,
      spec,
      baseline: values,
      values: structuredClone(values),
      paths: new Set(),
      errors: spec.validate(values),
      revision: design.revision,
      pending: false,
    };
    this.entries.set(key, entry);
    return entry;
  }
  /**
   * Moves the project's drafts whose target `renamed` re-keyed to its new ID (their spec's
   * `follow`). Values, flight and timers move with the draft. Applying the same renames twice
   * changes nothing.
   */
  follow(projectId: string, renamed: readonly Rekey[], design: DesignDocument) {
    if (!renamed.length) return;
    const ids = new Map(renamed.map((item) => [item.from, item.to]));
    let moved = false;
    for (const entry of this.forProject(projectId)) {
      const spec = entry.spec.follow?.(ids, design);
      if (!spec) continue;
      const key = draftKey(spec);
      entry.spec = spec;
      if (key === entry.key) continue;
      const stale = this.entries.get(key);
      if (stale) clearTimeout(stale.timer);
      this.entries.delete(entry.key);
      entry.key = key;
      this.entries.set(key, entry);
      moved = true;
    }
    if (moved) this.emit();
  }
  /** Clean fields track accepted changes; dirty baselines remain intact for comparison. */
  private sync(entry: FormDraft, design: DesignDocument) {
    if (design.revision < entry.revision || entry.flight) return;
    const incoming = entry.spec.read(design);
    if (!incoming) return;
    for (const path of new Set([...Object.keys(entry.values), ...Object.keys(incoming)])) {
      if (!entry.paths.has(path)) {
        entry.values[path] = incoming[path];
        entry.baseline[path] = incoming[path];
      }
    }
    entry.revision = design.revision;
    entry.errors = entry.spec.validate(entry.values);
  }
  change(key: string, changes: DraftValues, immediate = false) {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.values = { ...entry.values, ...changes };
    for (const path of Object.keys(changes)) {
      if (same(entry.values[path], entry.baseline[path])) entry.paths.delete(path);
      else entry.paths.add(path);
    }
    entry.errors = entry.spec.validate(entry.values);
    // A failed intent requires an explicit Retry/Discard, even if editing continues.
    if (entry.problem?.kind === "conflict") entry.problem = undefined;
    clearTimeout(entry.timer);
    if (
      !Object.keys(entry.errors).length &&
      !entry.problem &&
      (entry.paths.size || (entry.flight && !same(entry.values, entry.flight.values)))
    )
      // The timer holds the draft itself: a rename may move it to another key meanwhile.
      entry.timer = setTimeout(() => void this.flushEntry(entry), immediate ? 0 : 500);
    this.emit();
  }
  flush(key: string): Promise<void> {
    const entry = this.entries.get(key);
    return entry ? this.flushEntry(entry) : Promise.resolve();
  }
  private flushEntry(entry: FormDraft): Promise<void> {
    if (this.entries.get(entry.key) !== entry) return Promise.resolve();
    clearTimeout(entry.timer);
    if (entry.flight) {
      entry.flushAgain = true;
      return entry.flight.promise;
    }
    if (entry.problem || !entry.paths.size || Object.keys(entry.errors).length || !this.transport)
      return Promise.resolve();
    const values = structuredClone(entry.values);
    const baseline = structuredClone(entry.baseline);
    const paths = [...entry.paths];
    const spec = entry.spec;
    const intent: DraftIntent = {
      projectId: spec.projectId,
      rebuild(design) {
        const current = spec.read(design);
        if (!current || paths.some((path) => !same(current[path], baseline[path]))) return;
        return spec.build(
          design,
          { ...current, ...Object.fromEntries(paths.map((path) => [path, values[path]])) },
          paths,
        );
      },
    };
    entry.pendingTimer = setTimeout(() => {
      entry.pending = true;
      this.emit();
    }, 800);
    const promise = this.transport(intent).then((result) => {
      clearTimeout(entry.pendingTimer);
      entry.pending = false;
      entry.flight = undefined;
      if (result.status === "failed") {
        entry.problem = { kind: "failed", message: result.message };
      } else {
        // A save that re-keyed this target reads it under its new ID (the store usually moved
        // it already, when it adopted the change).
        if (result.status === "saved" && result.renamed)
          this.follow(spec.projectId, result.renamed, result.design);
        const current = entry.spec;
        const incoming = current.read(result.design) ?? {};
        const written =
          result.status === "saved" ? (current.read(result.written ?? result.design) ?? {}) : {};
        // A follow-up local edit was based on the flight's values. A newer accepted peer edit
        // of that same field cannot become its baseline merely because the old save completed.
        const changedAgainElsewhere =
          result.status === "saved" &&
          Object.keys(entry.values).some(
            (path) =>
              !same(entry.values[path], values[path]) && !same(incoming[path], written[path]),
          );
        if (result.status === "conflict" || changedAgainElsewhere) {
          entry.values = structuredClone(incoming);
          entry.problem = { kind: "conflict", message: "Changed elsewhere; reopen to edit" };
        } else {
          for (const path of new Set([...Object.keys(values), ...Object.keys(incoming)]))
            if (same(entry.values[path], values[path])) entry.values[path] = incoming[path];
        }
        entry.baseline = structuredClone(incoming);
        entry.revision = result.design.revision;
        entry.paths = new Set(
          Object.keys(entry.values).filter((path) => !same(entry.values[path], incoming[path])),
        );
        entry.errors = current.validate(entry.values);
      }
      const again = entry.flushAgain;
      entry.flushAgain = false;
      this.emit();
      if (again && !entry.problem) return this.flushEntry(entry);
    });
    entry.flight = { values, promise };
    this.emit();
    return promise;
  }
  leave(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return;
    if (Object.keys(entry.errors).length && !entry.problem) {
      clearTimeout(entry.timer);
      // Only the unsent invalid part is abandoned. Never cancel an accepted flight.
      entry.values = structuredClone(entry.flight?.values ?? entry.baseline);
      entry.paths = new Set(
        Object.keys(entry.values).filter((path) => !same(entry.values[path], entry.baseline[path])),
      );
      entry.errors = entry.spec.validate(entry.values);
      this.emit();
    } else void this.flush(key);
  }
  async flushProject(projectId: string, leave = false) {
    const entries = this.forProject(projectId);
    if (leave) for (const entry of entries) this.leave(entry.key);
    await Promise.all(entries.map((entry) => this.flush(entry.key)));
  }
  retry(key: string) {
    const entry = this.entries.get(key);
    if (entry?.problem?.kind !== "failed") return;
    entry.problem = undefined;
    void this.flushEntry(entry);
  }
  discard(key: string) {
    const entry = this.entries.get(key);
    if (!entry || entry.flight) return;
    clearTimeout(entry.timer);
    entry.values = structuredClone(entry.baseline);
    entry.paths.clear();
    entry.errors = entry.spec.validate(entry.values);
    entry.problem = undefined;
    this.emit();
  }
  hasProblems(projectId: string) {
    return this.forProject(projectId).some((entry) => entry.problem?.kind === "failed");
  }
}

export const formDrafts = new FormDrafts();
