/**
 * Design chat in the studio rail: the conversation, streamed replies, `askUser` choice
 * cards, what each turn changed, an Undo button per turn, and a composer with file attachments.
 * Everything works by mouse; Ctrl/Cmd+Enter also sends.
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
import type { ChatActivity, ChatQuestion, ChatTurn, FileInfo } from "../project/api.ts";
import { useProject } from "../project/store.ts";
import { ACCEPT_ATTRIBUTE, type LiveTurn, useChat } from "./store.ts";

const EXAMPLES = [
  "Make me a link shortener like bit.ly",
  "Add a cache after the selected service",
  "What is still undecided in this design?",
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
  const details = activity.filter((item) => item.tool === "reviewDetail");
  return (
    <>
      <ul className="chat-activity" aria-label="What the assistant did">
        {activity
          .filter((item) => item.tool !== "reviewDetail")
          .map((a, i) => (
            // Activity lines never reorder.
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
            <li key={i} data-ok={a.ok || undefined}>
              {a.ok ? <IconCheck size={12} aria-hidden /> : <IconX size={12} aria-hidden />}
              {a.summary}
            </li>
          ))}
      </ul>
      {details.length ? (
        <details className="chat-review-details">
          <summary>Review details ({details.length})</summary>
          <ul>
            {details.map((item, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
              <li key={i}>{item.summary}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

/** The items a turn changed that still exist. */
function ChangedItems({ ids }: { ids: string[] }) {
  const design = useProject((s) => s.loaded?.design);
  if (!design || ids.length === 0) return null;
  const nameOf = (id: string) => design.elements.find((e) => e.id === id)?.name ?? id;
  const label = (id: string) => {
    const connection = design.connections.find((c) => c.id === id);
    return connection
      ? `${nameOf(connection.from.element)} → ${nameOf(connection.to.element)}`
      : nameOf(id);
  };
  const present = ids.filter(
    (id) => design.connections.some((c) => c.id === id) || design.elements.some((e) => e.id === id),
  );
  if (present.length === 0) return null;
  return (
    <div className="chat-changed">
      <span className="chat-changed-all">Changed:</span>
      {present.map((id) => (
        <span key={id} className="chat-chip">
          {label(id)}
        </span>
      ))}
    </div>
  );
}

function UndoTurn({ operationId }: { operationId: number }) {
  const latest = useProject((s) => s.loaded?.history.latestEdit);
  const undoEdit = useProject((s) => s.undoEdit);
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

function Usage({ usage }: { usage: ChatTurn["usage"] }) {
  if (
    !usage?.known ||
    ![usage.inputTokens, usage.outputTokens].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    )
  )
    return null;
  return (
    <p className="chat-hint" role="note" aria-label="Model token usage">
      {usage.inputTokens.toLocaleString()} input tokens
      {usage.cachedInputTokens !== undefined &&
      Number.isSafeInteger(usage.cachedInputTokens) &&
      usage.cachedInputTokens >= 0 &&
      usage.cachedInputTokens <= usage.inputTokens
        ? ` (${usage.cachedInputTokens.toLocaleString()} cached)`
        : ""}
      {" · "}
      {usage.outputTokens.toLocaleString()} output tokens
      {usage.costUsd !== undefined && Number.isFinite(usage.costUsd) && usage.costUsd >= 0
        ? ` · $${usage.costUsd.toLocaleString(undefined, { maximumSignificantDigits: 6 })} USD reported`
        : ""}
    </p>
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
        <Usage usage={turn.usage} />
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
          color="cyan.9"
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
  const projectId = useProject((s) => s.loaded?.project.id);
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
