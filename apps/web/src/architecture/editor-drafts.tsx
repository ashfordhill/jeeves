import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react";

type Entry<T> = { draft: T; baseline: string; revision: number };
const Drafts = createContext<Map<string, Entry<unknown>> | null>(null);
export function EditorDraftProvider({ children }: { children: ReactNode }) {
  const [drafts] = useState(() => new Map<string, Entry<unknown>>());
  return <Drafts.Provider value={drafts}>{children}</Drafts.Provider>;
}

/** Per-project UI drafts survive selection/level switches; clean fields follow undo and reload. */
export function useEditorDraft<T>(key: string, incoming: T, revision: number) {
  const cache = useContext(Drafts);
  const snapshot = JSON.stringify(incoming);
  const [entry, setEntry] = useState<Entry<T>>(() => {
    const cached = cache?.get(key) as Entry<T> | undefined;
    return cached && cached.baseline !== JSON.stringify(cached.draft)
      ? cached
      : { draft: structuredClone(incoming), baseline: snapshot, revision };
  });
  useEffect(() => {
    setEntry((current) => {
      const draftSnapshot = JSON.stringify(current.draft);
      if (current.revision === revision && current.baseline === snapshot) return current;
      return draftSnapshot === current.baseline || draftSnapshot === snapshot
        ? { draft: JSON.parse(snapshot) as T, baseline: snapshot, revision }
        : current;
    });
  }, [snapshot, revision]);
  useEffect(() => {
    cache?.set(key, entry);
  }, [cache, key, entry]);
  const setDraft: Dispatch<SetStateAction<T>> = (next) =>
    setEntry((current) => ({
      ...current,
      draft: typeof next === "function" ? (next as (value: T) => T)(current.draft) : next,
    }));
  const setBaseRevision = (next: number) =>
    setEntry((current) => ({
      ...current,
      revision: next,
      baseline: JSON.stringify(current.draft),
    }));
  return { draft: entry.draft, setDraft, baseRevision: entry.revision, setBaseRevision };
}
