/**
 * The design chat loop. A turn calls the model with its studio tools until it stops asking
 * for them (or asks the person something), then commits every edit as one `source: "chat"`
 * operation, so the turn is one undo step. A revision conflict stops the turn, so it cannot
 * overwrite an intervening studio edit.
 */
import {
  type ContentPart,
  type ModelItem,
  type ModelProvider,
  type ModelRole,
  ProviderError,
} from "@jeeves/providers";
import {
  type DesignDocument,
  designIds,
  type Finding,
  reviewStudioDesign,
  type StudioReview,
  selectedLogicalOwners,
  selectedOperationBindings,
} from "@jeeves/spec";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import {
  type ChatActivity,
  type ChatQuestion,
  type ChatTurnStatus,
  type ChatUsage,
  chatTurns,
  files,
} from "../db/schema.ts";
import type { DesignService, DesignState } from "../design/service.ts";
import { type AcceptedType, checkFile, fileParts } from "./files.ts";
import {
  INSTRUCTIONS,
  isWorkspaceMutation,
  toolDefinitions,
  turnContext,
  Workspace,
} from "./tools.ts";

/** Picks the provider and model for a role, or says why there is none. */
export type ModelSource = (
  role: ModelRole,
) => { provider: ModelProvider; model: string } | { error: string };

/** The model name to record and show; an empty name means the provider's own default. */
export function modelLabel(source: { provider: ModelProvider; model: string }): string {
  return source.model || `${source.provider.id} (default model)`;
}

export type FileInfo = { id: string; name: string; mediaType: string; size: number };

export type ChatTurn = {
  id: number;
  message: string;
  files: FileInfo[];
  selection: string[];
  status: ChatTurnStatus;
  reply: string;
  question: ChatQuestion | null;
  operationId: number | null;
  changed: string[];
  activity: ChatActivity[];
  usage: ChatUsage | null;
  model: string | null;
  error: string | null;
  createdAt: string;
};

export type ChatEvent =
  | { type: "turn"; turn: ChatTurn }
  | { type: "text"; delta: string }
  | { type: "activity"; activity: ChatActivity }
  | { type: "done"; turn: ChatTurn; state: DesignState | null };

export type ChatInput = {
  message: string;
  fileIds: string[];
  selection: string[];
  /** The revision the person saw; a newer design stops the message before it starts. */
  baseRevision: number;
};

export type StartResult =
  | { ok: true; run: (emit: (event: ChatEvent) => void) => Promise<ChatTurn> }
  | { ok: false; status: 404 | 409 | 422; code: string; message: string };

export const MAX_ROUNDS = 16;
/** Response batches allowed to change commands/scope after the model has received review. */
export const MAX_REPAIR_PASSES = 2;
/** Earlier turns sent as conversation history. */
const HISTORY_TURNS = 12;

export class ChatService {
  /** Projects with a turn in progress; one turn per project at a time. */
  private readonly running = new Set<string>();

  constructor(
    private readonly db: Db,
    private readonly design: DesignService,
    private readonly models: ModelSource,
  ) {}

  async listTurns(projectId: string): Promise<ChatTurn[]> {
    const rows = await this.db
      .select()
      .from(chatTurns)
      .where(eq(chatTurns.projectId, projectId))
      .orderBy(asc(chatTurns.id));
    return this.toTurns(rows);
  }

  async saveFile(
    projectId: string,
    file: { name: string; mediaType: AcceptedType; data: Buffer },
  ): Promise<FileInfo | { error: string }> {
    const problem = checkFile(file.mediaType, file.data);
    if (problem) return { error: problem };
    const [row] = await this.db
      .insert(files)
      .values({
        projectId,
        name: file.name,
        mediaType: file.mediaType,
        size: file.data.length,
        data: file.data,
      })
      .returning({ id: files.id, name: files.name, mediaType: files.mediaType, size: files.size });
    if (!row) throw new Error("insert returned no file");
    return row;
  }

  async getFile(projectId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.projectId, projectId), eq(files.id, id)));
    return row;
  }

  /** Checks a message can run now; the caller then streams `run`. */
  async start(projectId: string, input: ChatInput): Promise<StartResult> {
    const state = await this.design.getDesign(projectId);
    if (!state) return { ok: false, status: 404, code: "NOT_FOUND", message: "Project not found." };
    if (input.baseRevision !== state.design.revision) {
      return {
        ok: false,
        status: 409,
        code: "REVISION_CONFLICT",
        message:
          "The design changed before the message started. Reload and inspect the current design before sending again.",
      };
    }
    if (
      selectedLogicalOwners(state.design, input.selection).some((item) => item.status !== "present")
    )
      return {
        ok: false,
        status: 422,
        code: "UNKNOWN_SELECTION",
        message:
          "The selected logical owner is missing or invalid. Select an existing owner before sending again.",
      };
    if (
      selectedOperationBindings(state.design, input.selection).some(
        (item) => item.status !== "present",
      )
    )
      return {
        ok: false,
        status: 422,
        code: "UNKNOWN_SELECTION",
        message:
          "The selected operation binding is missing or invalid. Select an existing operation before sending again.",
      };
    if (this.running.has(projectId)) {
      return {
        ok: false,
        status: 409,
        code: "CHAT_BUSY",
        message: "The assistant is still working on the previous message.",
      };
    }
    const attached = input.fileIds.length
      ? await this.db
          .select()
          .from(files)
          .where(and(eq(files.projectId, projectId), inArray(files.id, input.fileIds)))
      : [];
    if (attached.length !== new Set(input.fileIds).size) {
      return {
        ok: false,
        status: 422,
        code: "UNKNOWN_FILE",
        message: "An attached file wasn't found.",
      };
    }
    this.running.add(projectId);
    return {
      ok: true,
      run: async (emit) => {
        try {
          return await this.runTurn(projectId, input, state, attached, emit);
        } finally {
          this.running.delete(projectId);
        }
      },
    };
  }

  private async runTurn(
    projectId: string,
    input: ChatInput,
    initial: DesignState,
    attached: (typeof files.$inferSelect)[],
    emit: (event: ChatEvent) => void,
  ): Promise<ChatTurn> {
    const history = await this.historyItems(projectId);
    const [row] = await this.db
      .insert(chatTurns)
      .values({
        projectId,
        message: input.message,
        fileIds: input.fileIds,
        selection: input.selection,
        status: "running",
      })
      .returning();
    if (!row) throw new Error("insert returned no chat turn");
    emit({ type: "turn", turn: (await this.toTurns([row]))[0] as ChatTurn });

    const workspace = new Workspace(initial.design);
    const usage: ChatUsage = { inputTokens: 0, outputTokens: 0, known: true };
    let receivedUsage = false;
    let awaitingResponse = false;
    let responseRounds = 0;
    let cachedRounds = 0;
    let costRounds = 0;
    let cachedInputTokens = 0;
    let costUsd = 0;
    let reply = "";
    let operationId: number | null = null;
    let committedState: DesignState | null = null;
    let changed: string[] = [];
    let model: string | null = null;
    let error: string | null = null;
    const logged = () => workspace.activity.length;
    const flushActivity = (from: number) => {
      for (const activity of workspace.activity.slice(from)) emit({ type: "activity", activity });
    };

    try {
      const source = this.models("designChat");
      if ("error" in source) throw new TurnError(source.error);
      model = modelLabel(source);
      const items: ModelItem[] = [
        ...history,
        {
          type: "message",
          role: "user",
          content: [
            {
              type: "text",
              text: turnContext(initial.design, initial.findings, input.selection),
            },
          ],
        },
        {
          type: "message",
          role: "user",
          content: [
            { type: "text", text: input.message },
            ...attached.flatMap((file) => fileParts(file)),
          ],
        },
      ];
      const tools = toolDefinitions();
      let seenReview = -1;
      let repairPasses = 0;
      for (let round = 0; ; round++) {
        if (round >= MAX_ROUNDS) {
          throw new TurnError(
            `The assistant didn't finish within ${MAX_ROUNDS} steps. Nothing was changed.`,
          );
        }
        // A review only counts as seen when it is included in an actual provider request.
        if (workspace.reviewedGeneration === workspace.generation)
          seenReview = workspace.reviewedGeneration;
        let separated = false;
        awaitingResponse = true;
        const response = await source.provider.respond(
          {
            model: source.model,
            instructions: INSTRUCTIONS,
            items,
            tools,
          },
          {
            onEvent: (event) => {
              if (reply && !separated) {
                reply += "\n\n";
                emit({ type: "text", delta: "\n\n" });
              }
              separated = true;
              reply += event.delta;
              emit({ type: "text", delta: event.delta });
            },
          },
        );
        awaitingResponse = false;
        // Providers that don't stream still return the text.
        if (!separated && response.text) {
          const delta = `${reply ? "\n\n" : ""}${response.text}`;
          reply += delta;
          emit({ type: "text", delta });
        }
        responseRounds++;
        if (
          response.usage?.cachedInputTokens !== undefined &&
          Number.isSafeInteger(response.usage.cachedInputTokens) &&
          response.usage.cachedInputTokens >= 0
        ) {
          cachedRounds++;
          cachedInputTokens += response.usage.cachedInputTokens;
        }
        if (
          response.usage?.costUsd !== undefined &&
          Number.isFinite(response.usage.costUsd) &&
          response.usage.costUsd >= 0
        ) {
          costRounds++;
          costUsd += response.usage.costUsd;
        }
        if (response.usage) {
          receivedUsage = true;
          usage.inputTokens += response.usage.inputTokens;
          usage.outputTokens += response.usage.outputTokens;
        } else {
          usage.known = false;
        }
        items.push(...response.items);

        if (response.toolCalls.length > 0) {
          const generation = workspace.generation;
          for (const call of response.toolCalls) {
            const before = logged();
            const mutation = isWorkspaceMutation(call.name, call.arguments);
            let output: string;
            if (mutation && seenReview >= 0 && repairPasses >= MAX_REPAIR_PASSES) {
              const message = `The ${MAX_REPAIR_PASSES} review repair passes are used. End with the unresolved findings; no more commands or scope changes can be prepared this turn.`;
              workspace.log(call.name, false, message);
              output = JSON.stringify({ ok: false, error: message });
            } else {
              output = workspace.run(call.name, call.arguments);
            }
            items.push({ type: "tool-result", callId: call.callId, output });
            flushActivity(before);
          }
          if (seenReview >= 0 && workspace.generation !== generation) repairPasses++;
          if (!workspace.question) continue;
        }

        if (
          !workspace.question &&
          workspace.generation > 0 &&
          seenReview !== workspace.generation
        ) {
          // Ending a model response cannot skip review. Use the same tool/result protocol as an
          // explicit reviewDesign call, then let the model repair or summarize within MAX_ROUNDS.
          const before = logged();
          const callId = `jeeves-review-${round}`;
          items.push(
            { type: "tool-call", callId, name: "reviewDesign", arguments: "{}" },
            { type: "tool-result", callId, output: workspace.run("reviewDesign", "{}") },
            textMessage(
              "user",
              `[Jeeves] Fresh pre-save review. Nothing is saved yet. ${MAX_REPAIR_PASSES - repairPasses} repair passes remain within the ${MAX_ROUNDS}-round turn limit. Report unresolved requirements accurately; do not invent solution tiles.`,
            ),
          );
          flushActivity(before);
          continue;
        }

        const before = logged();
        // Questions end immediately, with a deterministic review and summary but no extra model call.
        if (workspace.question) workspace.review();
        const committed = await this.commit(projectId, workspace);
        flushActivity(before);
        if (committed.ok) {
          operationId = committed.operationId;
          committedState = committed.state;
          changed = committed.changed;
          break;
        }
        throw new TurnError(
          `Edits were not saved: ${committed.message} Inspect the current design before sending again.`,
        );
      }
    } catch (caught) {
      if (awaitingResponse) {
        usage.known = false;
        cachedRounds = -1;
        costRounds = -1;
      }
      error =
        caught instanceof TurnError || caught instanceof ProviderError
          ? caught.message
          : `The assistant failed: ${caught instanceof Error ? caught.message : String(caught)}`;
    }

    const state = (await this.design.getDesign(projectId)) ?? null;
    if (!state) error = "The project was deleted; no saved design remains.";
    // Attribute edits to the exact committed chat snapshot. A later canvas edit may already exist
    // by this read; its findings belong to the current-state review, never this chat's Undo step.
    const savedChanges = committedState
      ? reviewStudioDesign(initial.design, committedState.design).changes.length
      : 0;
    const finalReview = state
      ? reviewStudioDesign(state.design, state.design, workspace.scope)
      : null;
    const beforeFinal = logged();
    if (finalReview && state) {
      workspace.log(
        "finalReview",
        true,
        `Reviewed saved revision ${state.design.revision}: ${operationId === null ? "no design edits saved" : `chat committed at revision ${committedState?.design.revision}`}, ${finalReview.findings.length} findings, ${finalReview.obligations.length} not specified obligations`,
      );
      if (committedState)
        for (const row of reviewStudioDesign(initial.design, committedState.design).ownership
          .changes)
          workspace.log(
            "reviewDetail",
            true,
            `Saved ownership ${row.change} · ${row.field}/${row.id}: ${JSON.stringify({ before: row.before, after: row.after })}`,
          );
      if (committedState)
        for (const row of reviewStudioDesign(initial.design, committedState.design).operations
          .changes)
          workspace.log(
            "reviewDetail",
            true,
            `Saved operation ${row.change} · ${row.field}/${row.id}: ${JSON.stringify({ before: row.before, after: row.after })}`,
          );
      for (const finding of finalReview.findings)
        workspace.log(
          "reviewDetail",
          true,
          `${finding.code}${finding.target.element ? ` · ${finding.target.element}` : finding.target.connection ? ` · ${finding.target.connection}` : ""}: ${finding.message}`,
        );
      for (const assumption of finalReview.assumptions)
        workspace.log("reviewDetail", true, `Assumption (this turn): ${assumption}`);
      for (const obligation of finalReview.obligations)
        workspace.log(
          "reviewDetail",
          true,
          `Not specified · ${"pattern" in obligation ? `${obligation.pattern}@${obligation.version}/` : ""}${obligation.id}: ${obligation.requirement} ${obligation.limitation}${"targetPresent" in obligation && !obligation.targetPresent ? " The referenced target is absent from the saved design." : ""}`,
        );
    } else {
      workspace.log("finalReview", false, "Project deleted; there is no saved design to review");
    }
    flushActivity(beforeFinal);
    const summary =
      finalReview && state
        ? reviewSummary(finalReview, committedState, savedChanges, state.design.revision)
        : "The project was deleted; no saved design remains. Review unavailable.";
    const delta = `${reply ? "\n\n" : ""}${summary}`;
    reply += delta;
    emit({ type: "text", delta });

    const completion = {
      status: error ? ("failed" as const) : ("done" as const),
      reply,
      question: error ? null : (workspace.question ?? null),
      operationId,
      changed,
      activity: workspace.activity,
      usage: receivedUsage
        ? {
            ...usage,
            ...(cachedRounds === responseRounds && { cachedInputTokens }),
            ...(costRounds === responseRounds && { costUsd }),
          }
        : null,
      model,
      error,
      finishedAt: new Date(),
    };
    const [finished] = await this.db
      .update(chatTurns)
      .set(completion)
      .where(eq(chatTurns.id, row.id))
      .returning();
    const turn = (await this.toTurns([finished ?? { ...row, ...completion }]))[0] as ChatTurn;
    emit({ type: "done", turn, state });
    return turn;
  }

  /** Commits the pending edits as one operation. A stale base commits nothing. */
  private async commit(
    projectId: string,
    workspace: Workspace,
  ): Promise<
    | { ok: true; operationId: number | null; changed: string[]; state: DesignState | null }
    | { ok: false; message: string }
  > {
    if (
      workspace.pending.length === 0 ||
      JSON.stringify({ ...workspace.base, revision: 0 }) ===
        JSON.stringify({ ...workspace.working, revision: 0 })
    )
      return { ok: true, operationId: null, changed: [], state: null };
    const result = await this.design.edit(projectId, {
      baseRevision: workspace.base.revision,
      ops: workspace.pending,
      source: "chat",
    });
    if (result.ok) {
      const count = workspace.pending.length;
      workspace.log(
        "commit",
        true,
        `Applied ${count} change${count === 1 ? "" : "s"} as one undo step`,
      );
      return {
        ok: true,
        operationId: result.operationId,
        changed: changedIds(workspace.base, result.state.design),
        state: result.state,
      };
    }
    if (result.reason === "conflict") {
      workspace.log("commit", false, "Revision conflict; nothing saved");
      workspace.reset(result.state.design);
      return { ok: false, message: "The design changed while the assistant was working." };
    }
    if (result.reason === "invalid") {
      workspace.reset((await this.design.getDesign(projectId))?.design ?? workspace.base);
      return { ok: false, message: describeErrors(result.errors) };
    }
    throw new TurnError(
      result.reason === "not-found" ? "The project was deleted." : result.message,
    );
  }

  /** Earlier turns as plain conversation: the person's messages and the replies. */
  private async historyItems(projectId: string): Promise<ModelItem[]> {
    const rows = await this.db
      .select()
      .from(chatTurns)
      .where(eq(chatTurns.projectId, projectId))
      .orderBy(desc(chatTurns.id))
      .limit(HISTORY_TURNS);
    const turns = await this.toTurns(rows.reverse());
    const items: ModelItem[] = [];
    for (const turn of turns) {
      const attachedNames = turn.files.map((f) => f.name).join(", ");
      items.push(
        textMessage("user", turn.message + (attachedNames ? `\n(Attached: ${attachedNames})` : "")),
      );
      const parts = [turn.reply];
      if (turn.question)
        parts.push(
          `[Asked: ${turn.question.question} Choices: ${turn.question.choices.join(" | ")}]`,
        );
      if (turn.error) parts.push(`[This turn failed: ${turn.error}]`);
      const text = parts.filter(Boolean).join("\n");
      if (text) items.push(textMessage("assistant", text));
    }
    return items;
  }

  private async toTurns(rows: (typeof chatTurns.$inferSelect)[]): Promise<ChatTurn[]> {
    const ids = [...new Set(rows.flatMap((r) => r.fileIds))];
    const infos = ids.length
      ? await this.db
          .select({ id: files.id, name: files.name, mediaType: files.mediaType, size: files.size })
          .from(files)
          .where(inArray(files.id, ids))
      : [];
    const byId = new Map(infos.map((f) => [f.id, f]));
    return rows.map((r) => ({
      id: r.id,
      message: r.message,
      files: r.fileIds.flatMap((id) => byId.get(id) ?? []),
      selection: r.selection,
      status: r.status,
      reply: r.reply,
      question: r.question ?? null,
      operationId: r.operationId,
      changed: r.changed,
      activity: r.activity,
      usage: r.usage ?? null,
      model: r.model,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

class TurnError extends Error {}

/** Marks turns left running by a previous process as failed. Call once at startup. */
export async function failInterruptedTurns(db: Db): Promise<void> {
  await db
    .update(chatTurns)
    .set({ status: "failed", error: "Jeeves restarted during this turn.", finishedAt: new Date() })
    .where(eq(chatTurns.status, "running"));
}

function textMessage(role: "user" | "assistant", text: string): ModelItem {
  const content: ContentPart[] = [{ type: "text", text }];
  return { type: "message", role, content };
}

function describeErrors(errors: readonly Finding[]): string {
  return errors.map((e) => e.message).join(" ") || "the edits no longer fit";
}

/** IDs of elements and connections that are new or different in `after`. */
export function changedIds(before: DesignDocument, after: DesignDocument): string[] {
  const index = (design: DesignDocument) => {
    const map = new Map<string, string>();
    for (const element of design.elements) map.set(element.id, JSON.stringify(element));
    for (const connection of design.connections) map.set(connection.id, JSON.stringify(connection));
    return map;
  };
  const old = index(before);
  const ids = new Set(Array.from(designIds(after), (entry) => entry.id));
  return [...index(after)]
    .filter(([id, json]) => ids.has(id) && old.get(id) !== json)
    .map(([id]) => id);
}

/** Compact result for the narrow chat rail; full targeted diagnostics stay in review activity. */
function reviewSummary(
  review: StudioReview,
  committed: DesignState | null,
  savedChanges: number,
  revision: number,
): string {
  const saved = !committed
    ? "No design edits saved."
    : `Saved ${savedChanges} design changes at revision ${committed.design.revision} as one Undo step.`;
  const requirements = [...new Set(review.obligations.map((item) => item.id.replaceAll("-", " ")))];
  const names =
    requirements.slice(0, 5).join(", ") +
    (requirements.length > 5 ? `, +${requirements.length - 5} more` : "");
  const unresolved =
    review.findings.length || review.obligations.length
      ? `Unresolved: ${review.findings.length} design finding${review.findings.length === 1 ? "" : "s"}; ${review.obligations.length} requirement${review.obligations.length === 1 ? "" : "s"} not specified${names ? ` (${names})` : ""}. See Review details.`
      : "No represented structural/readiness findings. Undeclared requirements remain outside this review.";
  return `${saved} Review of saved revision ${revision}.\n${unresolved} No runtime verification.`;
}
