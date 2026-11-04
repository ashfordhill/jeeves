/**
 * Design chat state: the project's turns, the turn being streamed, the message draft, and files
 * staged for the next message. A finished turn's design is handed to the Draw store, so the board
 * shows the edit and highlights what changed.
 */
import { create } from "zustand";
import { api, type ChatActivity, type ChatTurn, type FileInfo } from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";

/** Accepted attachments, by extension, with the media type they're sent as. */
export const ACCEPTED_FILES: Record<string, string> = {
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};
export const ACCEPT_ATTRIBUTE = Object.keys(ACCEPTED_FILES).join(",");

export function mediaTypeOf(name: string): string | undefined {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? ACCEPTED_FILES[name.slice(dot).toLowerCase()] : undefined;
}

export type StagedFile = {
  key: number;
  name: string;
  status: "uploading" | "ready" | "error";
  file?: FileInfo;
  error?: string;
};

/** The turn being streamed. `turn` arrives with the first event. */
export type LiveTurn = {
  message: string;
  files: FileInfo[];
  turn?: ChatTurn;
  reply: string;
  activity: ChatActivity[];
};

type ChatState = {
  projectId?: string;
  profile?: "studio";
  status: "idle" | "loading" | "ready" | "error";
  turns: ChatTurn[];
  live?: LiveTurn;
  draft: string;
  staged: StagedFile[];
  /** Problem sending (not a failed turn, which is shown in the turn itself). */
  error?: string;

  load(projectId: string, profile?: "studio"): Promise<void>;
  setDraft(draft: string): void;
  attach(files: readonly File[]): Promise<void>;
  unstage(key: number): void;
  /** Sends the draft (or `text`, e.g. a clicked choice) with the staged files. */
  send(text?: string): Promise<void>;
};

let stageKey = 0;

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const useChat = create<ChatState>()((set, get) => ({
  status: "idle",
  turns: [],
  draft: "",
  staged: [],

  async load(projectId, profile) {
    set({ profile });
    if (get().projectId === projectId && get().status !== "error") return;
    set({ projectId, status: "loading", turns: [], live: undefined, staged: [], error: undefined });
    try {
      const turns = await api.chatTurns(projectId);
      if (get().projectId === projectId) set({ status: "ready", turns });
    } catch (error) {
      if (get().projectId === projectId) set({ status: "error", error: message(error) });
    }
  },

  setDraft(draft) {
    set({ draft });
  },

  async attach(files) {
    const projectId = get().projectId;
    if (!projectId) return;
    await Promise.all(
      files.map(async (file) => {
        const key = ++stageKey;
        const mediaType = mediaTypeOf(file.name);
        if (!mediaType) {
          set({
            staged: [
              ...get().staged,
              {
                key,
                name: file.name,
                status: "error",
                error: "Attach Markdown, text, PNG, JPEG, WebP, or SVG files.",
              },
            ],
          });
          return;
        }
        set({ staged: [...get().staged, { key, name: file.name, status: "uploading" }] });
        const update = (patch: Partial<StagedFile>) =>
          set({ staged: get().staged.map((s) => (s.key === key ? { ...s, ...patch } : s)) });
        try {
          update({ status: "ready", file: await api.uploadFile(projectId, file, mediaType) });
        } catch (error) {
          update({ status: "error", error: message(error) });
        }
      }),
    );
  },

  unstage(key) {
    set({ staged: get().staged.filter((s) => s.key !== key) });
  },

  async send(text) {
    const { projectId, live, staged, profile } = get();
    const body = (text ?? get().draft).trim();
    if (!projectId || live || !body) return;
    if (staged.some((s) => s.status === "uploading")) return;
    const files = staged.flatMap((s) => (s.status === "ready" && s.file ? [s.file] : []));
    const draw = useDraw.getState();
    const selection = draw.architectureSelection ?? [
      ...draw.selection.nodes,
      ...draw.selection.edges,
    ];
    // Live at once, so a second click can't send the message twice.
    set({
      live: { message: body, files, reply: "", activity: [] },
      error: undefined,
      ...(text === undefined ? { draft: "" } : {}),
      staged: [],
    });
    const patchLive = (patch: (live: LiveTurn) => Partial<LiveTurn>) => {
      const current = get().live;
      if (current) set({ live: { ...current, ...patch(current) } });
    };
    try {
      if (!(await draw.flushEdits())) throw new Error("Resolve the unsaved edit before sending");
      if (get().projectId !== projectId || useDraw.getState().loaded?.project.id !== projectId)
        return;
      // The server places new elements around what's saved, so save local moves first.
      await draw.flushLayout();
      if (get().projectId !== projectId || useDraw.getState().loaded?.project.id !== projectId)
        return;
      await api.chat(
        projectId,
        {
          message: body,
          fileIds: files.map((f) => f.id),
          selection,
          ...(profile === "studio" && {
            profile: "studio",
            baseRevision: useDraw.getState().loaded?.design.revision,
          }),
        },
        (event) => {
          if (get().projectId !== projectId) return;
          switch (event.type) {
            case "turn":
              patchLive(() => ({ turn: event.turn }));
              break;
            case "text":
              patchLive((l) => ({ reply: l.reply + event.delta }));
              break;
            case "activity":
              patchLive((l) => ({ activity: [...l.activity, event.activity] }));
              break;
            case "done":
              set({ turns: [...get().turns, event.turn], live: undefined });
              useDraw.getState().adoptChange(event.state, event.layout, event.turn.changed);
              break;
          }
        },
      );
      if (get().live) {
        // The stream ended without `done` (e.g. the server stopped): reload what was saved.
        set({ live: undefined, turns: await api.chatTurns(projectId) });
      }
    } catch (error) {
      if (get().projectId !== projectId) return;
      set({
        live: undefined,
        error: `Message not sent: ${message(error)}`,
        ...(text === undefined ? { draft: body } : {}),
        staged,
      });
    }
  },
}));
