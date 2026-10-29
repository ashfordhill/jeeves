/**
 * Design chat (PLAN §7) in the Draw rail: the conversation, streamed replies, `askUser` choice
 * cards, what each turn changed (click to show it on the board), an Undo button per turn, and a
 * composer with file attachments. Everything works by mouse; Ctrl/Cmd+Enter also sends.
 */
import { Button, FileButton, Loader, Textarea } from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconCheck,
  IconFile,
  IconPaperclip,
  IconPhoto,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import type { ChatActivity, ChatQuestion, ChatTurn, FileInfo } from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";
import { ACCEPT_ATTRIBUTE, type LiveTurn, useChat } from "./store.ts";

const EXAMPLES = [
  "Make me a link shortener like bit.ly",
  "Add a web app that calls the selected service",
  "What's missing before I can generate?",
];

function FileChips({ files }: { files: FileInfo[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="chat-files" aria-label="Attached files">
      {files.map((file) => (
        <li key={file.id} className="chat-file">
          {file.mediaType.startsWith("image/") ? (
            <IconPhoto size={14} aria-hidden />
          ) : (
            <IconFile size={14} aria-hidden />
          )}
          {file.name}
        </li>
      ))}
    </ul>
  );
}

function ActivityList({ activity }: { activity: ChatActivity[] }) {
  if (activity.length === 0) return null;
  return (
    <ul className="chat-activity" aria-label="What the assistant did">
      {activity.map((a, i) => (
        // Activity lines never reorder.
        // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
        <li key={i} data-ok={a.ok || undefined}>
          {a.ok ? <IconCheck size={12} aria-hidden /> : <IconX size={12} aria-hidden />}
          {a.summary}
        </li>
      ))}
    </ul>
  );
}

/** Buttons for the items a turn changed; clicking one shows it on the board. */
function ChangedItems({ ids }: { ids: string[] }) {
  const design = useDraw((s) => s.loaded?.design);
  const focus = useDraw((s) => s.focus);
  if (!design || ids.length === 0) return null;
  const connections = new Set(design.connections.map((c) => c.id));
  const nameOf = (id: string) => design.elements.find((e) => e.id === id)?.name ?? id;
  const label = (id: string) => {
    const connection = design.connections.find((c) => c.id === id);
    return connection
      ? `${nameOf(connection.from.element)} → ${nameOf(connection.to.element)}`
      : nameOf(id);
  };
  const present = ids.filter(
    (id) =>
      connections.has(id) ||
      design.elements.some((e) => e.id === id) ||
      design.annotations.some((a) => a.id === id),
  );
  if (present.length === 0) return null;
  const select = (only?: string) => {
    const pick = only ? [only] : present;
    focus(
      {
        nodes: pick.filter((id) => !connections.has(id)),
        edges: pick.filter((id) => connections.has(id)),
      },
      { zoom: true },
    );
  };
  return (
    <div className="chat-changed">
      <button type="button" className="chat-changed-all" onClick={() => select()}>
        Changed:
      </button>
      {present.map((id) => (
        <button key={id} type="button" className="chat-chip" onClick={() => select(id)}>
          {label(id)}
        </button>
      ))}
    </div>
  );
}

function UndoTurn({ operationId }: { operationId: number }) {
  const latest = useDraw((s) => s.loaded?.history.latestEdit);
  const undoEdit = useDraw((s) => s.undoEdit);
  const canUndo = latest === operationId;
  return (
    <Button
      size="compact-xs"
      variant="default"
      leftSection={<IconArrowBackUp size={14} aria-hidden />}
      disabled={!canUndo}
      title={
        canUndo
          ? "Undo everything this message changed"
          : "Only the newest change can be undone here. Use Undo in the toolbar for older steps."
      }
      onClick={() => void undoEdit(operationId)}
    >
      Undo
    </Button>
  );
}

function QuestionCard({ question, active }: { question: ChatQuestion; active: boolean }) {
  const send = useChat((s) => s.send);
  return (
    <fieldset className="chat-question" disabled={!active}>
      <legend>{question.question}</legend>
      <div className="chat-choices">
        {question.choices.map((choice) => (
          <Button key={choice} size="xs" variant="default" onClick={() => void send(choice)}>
            {choice}
          </Button>
        ))}
      </div>
      {question.allowFreeText && active ? (
        <p className="chat-hint">Or type your own answer below.</p>
      ) : null}
    </fieldset>
  );
}

function UserMessage({ message, files }: { message: string; files: FileInfo[] }) {
  return (
    <div className="chat-user">
      <p className="chat-text">{message}</p>
      <FileChips files={files} />
    </div>
  );
}

function TurnView({ turn, latest }: { turn: ChatTurn; latest: boolean }) {
  return (
    <li className="chat-turn">
      <UserMessage message={turn.message} files={turn.files} />
      <div className="chat-assistant">
        {turn.reply ? <p className="chat-text">{turn.reply}</p> : null}
        <ActivityList activity={turn.activity} />
        {turn.error ? (
          <p className="chat-error" role="alert">
            <IconAlertTriangle size={14} aria-hidden /> {turn.error}
          </p>
        ) : null}
        <ChangedItems ids={turn.changed} />
        {turn.question ? <QuestionCard question={turn.question} active={latest} /> : null}
        {turn.operationId !== null ? (
          <div className="chat-turn-actions">
            <UndoTurn operationId={turn.operationId} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function LiveTurnView({ live }: { live: LiveTurn }) {
  return (
    <li className="chat-turn" aria-busy>
      <UserMessage message={live.message} files={live.files} />
      <div className="chat-assistant">
        {live.reply ? <p className="chat-text">{live.reply}</p> : null}
        <ActivityList activity={live.activity} />
        <p className="chat-working" role="status">
          <Loader size={12} /> Working…
        </p>
      </div>
    </li>
  );
}

function Composer() {
  const draft = useChat((s) => s.draft);
  const setDraft = useChat((s) => s.setDraft);
  const staged = useChat((s) => s.staged);
  const attach = useChat((s) => s.attach);
  const unstage = useChat((s) => s.unstage);
  const send = useChat((s) => s.send);
  const busy = useChat((s) => !!s.live);
  const uploading = staged.some((s) => s.status === "uploading");
  const canSend = !busy && !uploading && draft.trim().length > 0;

  return (
    <form
      className="chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {staged.length > 0 ? (
        <ul className="chat-files" aria-label="Files to send">
          {staged.map((file) => (
            <li key={file.key} className="chat-file" data-status={file.status}>
              {file.status === "uploading" ? (
                <Loader size={10} />
              ) : (
                <IconFile size={14} aria-hidden />
              )}
              <span>{file.name}</span>
              {file.error ? <span className="chat-file-error">{file.error}</span> : null}
              <button
                type="button"
                className="chat-file-remove"
                aria-label={`Remove ${file.name}`}
                onClick={() => unstage(file.key)}
              >
                <IconX size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Textarea
        aria-label="Message"
        placeholder="Describe what you want to build or change…"
        autosize
        minRows={2}
        maxRows={8}
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void send();
          }
        }}
      />
      <div className="chat-composer-actions">
        <FileButton onChange={(files) => void attach(files)} accept={ACCEPT_ATTRIBUTE} multiple>
          {(props) => (
            <Button
              {...props}
              size="xs"
              variant="default"
              leftSection={<IconPaperclip size={14} aria-hidden />}
              disabled={busy}
            >
              Attach
            </Button>
          )}
        </FileButton>
        <Button
          type="submit"
          size="xs"
          leftSection={<IconSend size={14} aria-hidden />}
          disabled={!canSend}
        >
          Send
        </Button>
      </div>
    </form>
  );
}

export function ChatPanel() {
  const projectId = useDraw((s) => s.loaded?.project.id);
  const load = useChat((s) => s.load);
  const status = useChat((s) => s.status);
  const turns = useChat((s) => s.turns);
  const live = useChat((s) => s.live);
  const error = useChat((s) => s.error);
  const setDraft = useChat((s) => s.setDraft);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId) void load(projectId);
  }, [projectId, load]);

  // Keep the newest message in view as turns arrive and replies stream.
  const liveLength = live ? live.reply.length + live.activity.length : -1;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when content grows
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, liveLength]);

  return (
    <section className="chat-panel" aria-label="Design chat">
      <div className="chat-scroll" ref={scroller}>
        {status === "loading" ? (
          <p className="chat-hint" role="status">
            <Loader size={12} /> Loading conversation…
          </p>
        ) : null}
        {status === "ready" && turns.length === 0 && !live ? (
          <div className="chat-empty">
            <p>
              Describe the app you want and the assistant draws it on the board. You can attach a
              Markdown brief or a sketch.
            </p>
            <div className="chat-choices">
              {EXAMPLES.map((example) => (
                <Button key={example} size="xs" variant="default" onClick={() => setDraft(example)}>
                  {example}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        <div role="log" aria-label="Conversation">
          <ol className="chat-log">
            {turns.map((turn, i) => (
              <TurnView key={turn.id} turn={turn} latest={!live && i === turns.length - 1} />
            ))}
            {live ? <LiveTurnView live={live} /> : null}
          </ol>
        </div>
      </div>
      {error ? (
        <p className="chat-error chat-send-error" role="alert">
          <IconAlertTriangle size={14} aria-hidden /> {error}
        </p>
      ) : null}
      <Composer />
    </section>
  );
}
