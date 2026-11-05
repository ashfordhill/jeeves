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
import { type DesignDocument, designIds, type Finding } from "@jeeves/spec";
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
import { INSTRUCTIONS, toolDefinitions, turnContext, Workspace } from "./tools.ts";

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
  | { type: "done"; turn: ChatTurn; state: DesignState };

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
      for (let round = 0; ; round++) {
        if (round >= MAX_ROUNDS) {
          throw new TurnError(
            `The assistant didn't finish within ${MAX_ROUNDS} steps. Nothing was changed.`,
          );
        }
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
          for (const call of response.toolCalls) {
            const before = logged();
            items.push({
              type: "tool-result",
              callId: call.callId,
              output: workspace.run(call.name, call.arguments),
            });
            flushActivity(before);
          }
          if (!workspace.question) continue;
        }

        const before = logged();
        const committed = await this.commit(projectId, workspace);
        flushActivity(before);
        if (committed.ok) {
          operationId = committed.operationId;
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

    const state = (await this.design.getDesign(projectId)) as DesignState;

    const [finished] = await this.db
      .update(chatTurns)
      .set({
        status: error ? "failed" : "done",
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
      })
      .where(eq(chatTurns.id, row.id))
      .returning();
    const turn = (await this.toTurns(finished ? [finished] : []))[0] as ChatTurn;
    emit({ type: "done", turn, state });
    return turn;
  }

  /** Commits the pending edits as one operation. A stale base commits nothing. */
  private async commit(
    projectId: string,
    workspace: Workspace,
  ): Promise<
    { ok: true; operationId: number | null; changed: string[] } | { ok: false; message: string }
  > {
    if (workspace.pending.length === 0) return { ok: true, operationId: null, changed: [] };
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
