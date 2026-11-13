/**
 * Design chat in the studio rail: the conversation, streamed replies, `askUser` choice
 * cards, what each turn changed, each turn's token chips, an Undo button per turn, the
 * conversation's usage panel, and a composer with the model picker and file attachments.
 * Everything works by mouse; Ctrl/Cmd+Enter also sends.
 */
import { Badge, Button, FileButton, Loader, Textarea } from "@mantine/core";
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
import { type ReactNode, useEffect, useRef } from "react";
import type { ChatActivity, ChatQuestion, ChatTurn, FileInfo, ModelsView } from "../project/api.ts";
import { useProject } from "../project/store.ts";
import { contextLabel, ModelPicker } from "./ModelPicker.tsx";
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
    <div className="chat-changed" data-family="data">
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
    <fieldset className="chat-question" disabled={!active} data-family="data">
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

/** A token count: a whole number, zero or more. */
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** A token count as a chip writes it: `950`, `1.9k`, `41.2k`, `128k`, `1.31M`. */
export function tokenCount(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  const thousands = tokens / 1000;
  if (thousands < 99.95) return `${thousands.toFixed(1)}k`;
  if (thousands < 999.5) return `${Math.round(thousands)}k`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}

/** US dollars as the usage panel writes them: `$0.84`, `$12.30`, `<$0.01`. */
export function costLabel(usd: number): string {
  return usd > 0 && usd < 0.01 ? "<$0.01" : `$${usd.toFixed(2)}`;
}

/** A context size, `86k` or `1M`, as the model picker writes the window. */
const contextSize = (tokens: number) => contextLabel(tokens) ?? String(tokens);

type TurnCounts = { input: number; output: number; cached?: number };

/** A turn's tokens, or `null` when the turn has no complete counts (no chips then). */
export function turnCounts(usage: ChatTurn["usage"]): TurnCounts | null {
  if (!usage?.known || !isCount(usage.inputTokens) || !isCount(usage.outputTokens)) return null;
  const cached = usage.cachedInputTokens;
  return {
    input: usage.inputTokens,
    output: usage.outputTokens,
    ...(isCount(cached) && cached <= usage.inputTokens ? { cached } : {}),
  };
}

/** One chip: a quiet label and a bold value (Mantine `Badge`). */
function UsageChip({
  label,
  value,
  title,
  ring,
}: {
  label?: string;
  value: string;
  title: string;
  ring?: ReactNode;
}) {
  return (
    <Badge className="chat-usage-chip" variant="default" leftSection={ring} title={title}>
      {label ? `${label} ` : null}
      <b>{value}</b>
    </Badge>
  );
}

/** Under a reply: its input, cached input (when reported) and output tokens. */
export function TurnUsage({ usage }: { usage: ChatTurn["usage"] }) {
  const counts = turnCounts(usage);
  if (!counts) return null;
  return (
    <div className="chat-usage" role="note" aria-label="Model token usage">
      <UsageChip
        label="in"
        value={tokenCount(counts.input)}
        title={`${counts.input.toLocaleString()} input tokens`}
      />
      {counts.cached !== undefined ? (
        <UsageChip
          label="cached"
          value={tokenCount(counts.cached)}
          title={`${counts.cached.toLocaleString()} of them cached`}
        />
      ) : null}
      <UsageChip
        label="out"
        value={tokenCount(counts.output)}
        title={`${counts.output.toLocaleString()} output tokens`}
      />
    </div>
  );
}

/** How much of the context window is used, as a filled arc. */
function ContextRing({ used, size }: { used: number; size: number }) {
  // Tenths of a percent, at most the whole ring.
  const percent = Math.min(100, Math.round((used * 1000) / size) / 10);
  return (
    <svg className="chat-usage-ring" viewBox="0 0 14 14" width={14} height={14} aria-hidden="true">
      <circle className="chat-usage-ring-track" cx={7} cy={7} r={5.4} />
      <circle
        className="chat-usage-ring-used"
        cx={7}
        cy={7}
        r={5.4}
        pathLength={100}
        strokeDasharray={`${percent} 100`}
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
}

export type ConversationUsage = {
  /** The newest turn's `contextTokens`, and the selected model's window; `null` when unknown. */
  context: number | null;
  contextWindow: number | null;
  input: number;
  output: number;
  /** The sum of every turn's cost; `null` unless every turn reported one. */
  cost: number | null;
};

/**
 * The usage panel's numbers: the newest turn's context and the selected model's window, the
 * totals of the turns with complete counts, and the cost when every turn reported one. `null`
 * while no turn has complete counts (the panel is hidden then).
 */
export function conversationUsage(
  turns: readonly ChatTurn[],
  models: ModelsView | undefined,
): ConversationUsage | null {
  const counted = turns.flatMap((turn) => turnCounts(turn.usage) ?? []);
  if (counted.length === 0) return null;
  const newest = turns.at(-1)?.usage?.contextTokens;
  const selected = models?.selected;
  const limit = selected
    ? models.providers
        .find((provider) => provider.id === selected.provider)
        ?.models.find((model) => model.id === selected.model)?.contextWindow
    : undefined;
  const costs = turns.map((turn) => turn.usage?.costUsd);
  const everyCost = costs.every(
    (cost): cost is number => typeof cost === "number" && Number.isFinite(cost) && cost >= 0,
  );
  return {
    context: isCount(newest) ? newest : null,
    contextWindow: isCount(limit) && limit > 0 ? limit : null,
    input: counted.reduce((sum, counts) => sum + counts.input, 0),
    output: counted.reduce((sum, counts) => sum + counts.output, 0),
    cost: everyCost ? costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0) : null,
  };
}

/**
 * Above the composer: how full the context is (with a ring when the model's window is known),
 * the conversation's tokens in and out, and its cost when every turn reported one. Hidden until
 * a turn has usage.
 */
export function UsagePanel({
  turns,
  models,
}: {
  turns: readonly ChatTurn[];
  models: ModelsView | undefined;
}) {
  const usage = conversationUsage(turns, models);
  if (!usage) return null;
  const { context, contextWindow: limit } = usage;
  return (
    <div className="chat-meter" role="note" aria-label="Conversation usage">
      {context !== null ? (
        <UsageChip
          label="Context"
          value={
            limit === null
              ? contextSize(context)
              : `${contextSize(context)} / ${contextSize(limit)}`
          }
          title={
            limit === null
              ? `${context.toLocaleString()} tokens in the last response`
              : `${context.toLocaleString()} of the model's ${limit.toLocaleString()} tokens`
          }
          ring={limit === null ? undefined : <ContextRing used={context} size={limit} />}
        />
      ) : null}
      <UsageChip
        label="in"
        value={tokenCount(usage.input)}
        title={`${usage.input.toLocaleString()} input tokens in this conversation`}
      />
      <UsageChip
        label="out"
        value={tokenCount(usage.output)}
        title={`${usage.output.toLocaleString()} output tokens in this conversation`}
      />
      {usage.cost !== null ? (
        <UsageChip value={costLabel(usage.cost)} title="US dollars, as the provider reported" />
      ) : null}
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
        <TurnUsage usage={turn.usage} />
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
        <ModelPicker />
        <FileButton onChange={(files) => void attach(files)} accept={ACCEPT_ATTRIBUTE} multiple>
          {(props) => (
            <Button
              {...props}
              className="chat-attach"
              size="xs"
              px={8}
              variant="default"
              aria-label="Attach"
              title="Attach a Markdown brief, a text file or an image"
              disabled={busy}
            >
              <IconPaperclip size={14} aria-hidden />
            </Button>
          )}
        </FileButton>
        <Button
          type="submit"
          className="chat-send"
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
  const models = useChat((s) => s.models);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId) void load(projectId);
  }, [projectId, load]);

  // Keep the newest message in view as turns arrive and replies stream, and when the usage
  // panel grows because the model's context window has arrived.
  const liveLength = live ? live.reply.length + live.activity.length : -1;
  const contextWindow = conversationUsage(turns, models)?.contextWindow ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when content grows
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, liveLength, contextWindow]);

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
      <UsagePanel turns={turns} models={models} />
      {error ? (
        <p className="chat-error chat-send-error" role="alert">
          <IconAlertTriangle size={14} aria-hidden /> {error}
        </p>
      ) : null}
      <Composer />
    </section>
  );
}
