/**
 * The design chat loop (PLAN §7). A turn calls the model with the §7 tools until it stops asking
 * for them (or asks the person something), then commits every edit as one `source: "chat"`
 * operation, so the turn is one undo step. If the design moved meanwhile, the edits are replayed
 * on the newer design; if they no longer fit, the model is told and redoes them after re-reading.
 */
import {
  CALLER_NOTE_PREFIX,
  type ContentPart,
  type ModelItem,
  type ModelProvider,
  type ModelRole,
  ProviderError,
} from "@jeeves/providers";
import type { Registry } from "@jeeves/registry";
import {
  applyOperations,
  type DesignDocument,
  designIds,
  type Finding,
  type LayoutDocument,
} from "@jeeves/spec";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { ArchitectureLibrary } from "../architecture/library.ts";
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
import { INSTRUCTIONS, turnContext } from "./context.ts";
import { type AcceptedType, checkFile, fileParts } from "./files.ts";
import { placeNewItems } from "./place.ts";
import { toolDefinitions, Workspace } from "./tools.ts";

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
  | { type: "done"; turn: ChatTurn; state: DesignState; layout: LayoutDocument };

export type ChatInput = { message: string; fileIds: string[]; selection: string[] };

export type StartResult =
  | { ok: true; run: (emit: (event: ChatEvent) => void) => Promise<ChatTurn> }
  | { ok: false; status: 404 | 409 | 422; code: string; message: string };

export const MAX_ROUNDS = 16;
/** How often a turn may redo its edits after they stopped fitting a newer design. */
export const MAX_REDOS = 2;
/** How often a commit is replayed on a newer design before giving up. */
const MAX_REBASES = 3;
/** Earlier turns sent as conversation history. */
const HISTORY_TURNS = 12;

export class ChatService {
  /** Projects with a turn in progress; one turn per project at a time. */
  private readonly running = new Set<string>();

  constructor(
    private readonly db: Db,
    private readonly design: DesignService,
    private readonly registry: Registry,
    private readonly models: ModelSource,
    private readonly library?: ArchitectureLibrary,
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

    const project = await this.design.getProject(projectId);
    const workspace = new Workspace(
      this.registry,
      initial.design,
      initial.design,
      project?.name,
      this.library,
    );
    const usage: ChatUsage = { inputTokens: 0, outputTokens: 0, known: true };
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
              text: turnContext(this.registry, initial.design, initial.findings, input.selection),
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
      let redos = 0;
      for (let round = 0; ; round++) {
        if (round >= MAX_ROUNDS) {
          throw new TurnError(
            `The assistant didn't finish within ${MAX_ROUNDS} steps. Nothing was changed.`,
          );
        }
        let separated = false;
        const response = await source.provider.respond(
          { model: source.model, instructions: INSTRUCTIONS, items, tools },
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
        // Providers that don't stream still return the text.
        if (!separated && response.text) {
          const delta = `${reply ? "\n\n" : ""}${response.text}`;
          reply += delta;
          emit({ type: "text", delta });
        }
        if (response.usage) {
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
          if (workspace.createdTarget) {
            const delta = `\n\nPlanning target created: [${workspace.createdTarget.name}](/?project=${workspace.createdTarget.id}#/draw).`;
            reply += delta;
            emit({ type: "text", delta });
          }
          operationId = committed.operationId;
          changed = committed.changed;
          break;
        }
        if (redos >= MAX_REDOS)
          throw new TurnError(`The edits couldn't be applied: ${committed.message}`);
        redos++;
        workspace.question = undefined;
        items.push({
          type: "message",
          role: "user",
          content: [
            {
              type: "text",
              text: `${CALLER_NOTE_PREFIX} Your edits were not applied: the design changed while you were working (${committed.message}). Call getDesign to read the current design, then make your changes again.`,
            },
          ],
        });
      }
    } catch (caught) {
      error =
        caught instanceof TurnError || caught instanceof ProviderError
          ? caught.message
          : `The assistant failed: ${caught instanceof Error ? caught.message : String(caught)}`;
    }

    const state = (await this.design.getDesign(projectId)) as DesignState;
    let layout = (await this.design.getLayout(projectId)) as LayoutDocument;
    if (operationId !== null)
      layout = await this.placeNew(projectId, state.design, layout, input.selection);

    const [finished] = await this.db
      .update(chatTurns)
      .set({
        status: error ? "failed" : "done",
        reply,
        question: error ? null : (workspace.question ?? null),
        operationId,
        changed,
        activity: workspace.activity,
        usage,
        model,
        error,
        finishedAt: new Date(),
      })
      .where(eq(chatTurns.id, row.id))
      .returning();
    const turn = (await this.toTurns(finished ? [finished] : []))[0] as ChatTurn;
    emit({ type: "done", turn, state, layout });
    return turn;
  }

  /**
   * Commits the pending edits as one operation. A stale base is handled by replaying the edits on
   * the current design; if they no longer apply, nothing is committed and the workspace starts
   * over from the current design.
   */
  private async commit(
    projectId: string,
    workspace: Workspace,
  ): Promise<
    { ok: true; operationId: number | null; changed: string[] } | { ok: false; message: string }
  > {
    if (workspace.targetRequest) {
      const result = await this.design.createTarget(projectId, workspace.targetRequest);
      if (result.ok) {
        workspace.createdTarget = { id: result.project.id, name: result.project.name };
        workspace.log(
          "commit",
          true,
          `Created planning target ${result.project.name} (${result.project.id}); source unchanged`,
        );
        return { ok: true, operationId: null, changed: [] };
      }
      if (result.reason === "conflict") {
        workspace.reset(result.state.design);
        return {
          ok: false,
          message:
            "The source revision changed. No target was created; read the source again before preparing a new target.",
        };
      }
      if (result.reason === "invalid") {
        workspace.targetRequest = undefined;
        return { ok: false, message: describeErrors(result.errors) };
      }
      throw new TurnError("Source project not found.");
    }
    if (workspace.pending.length === 0) return { ok: true, operationId: null, changed: [] };
    for (let attempt = 0; attempt <= MAX_REBASES; attempt++) {
      const result = await this.design.edit(projectId, {
        baseRevision: workspace.base.revision,
        ops: workspace.pending,
        source: "chat",
      });
      if (result.ok) {
        const count = workspace.pending.length;
        const changed = changedIds(workspace.base, result.state.design);
        workspace.log(
          "commit",
          true,
          `Applied ${count} change${count === 1 ? "" : "s"} as one undo step`,
        );
        return { ok: true, operationId: result.operationId, changed };
      }
      if (result.reason === "conflict") {
        const current = result.state.design;
        if (workspace.deploymentRevisionBound) {
          workspace.reset(current);
          return {
            ok: false,
            message:
              "Deployment planning inputs changed. Nothing was saved; read the current design and review the placements and logical relationships again.",
          };
        }
        if (workspace.annotationRevisionBound) {
          workspace.reset(current);
          return {
            ok: false,
            message:
              "Annotation sources changed. Nothing was saved; read and review a new annotation draft.",
          };
        }
        if (workspace.reviewRevisionBound) {
          workspace.log("commit", false, "Review revision conflict; nothing was saved");
          workspace.reset(current);
          return {
            ok: false,
            message:
              "The architecture review is stale. No review edits were saved. Read the current design and review relevant inputs again.",
          };
        }
        if (workspace.patternRevisionBound) {
          workspace.log("commit", false, "Pattern revision conflict; nothing was added");
          workspace.reset(current);
          return {
            ok: false,
            message:
              "The pattern preview is stale. No pattern edits were added. Read the current design and preview compatible choices again.",
          };
        }
        if (workspace.scenarioRevisionBound) {
          workspace.reset(current);
          return {
            ok: false,
            message:
              "Scenario inputs changed. Nothing was saved; read the current design and review relationships, contracts and expectations again.",
          };
        }
        const replay = applyOperations(current, workspace.pending, this.registry);
        if (!replay.ok) {
          workspace.log("commit", false, "The design changed meanwhile; redoing the edits");
          workspace.reset(current);
          return { ok: false, message: describeErrors(replay.errors) };
        }
        workspace.log(
          "commit",
          true,
          `The design changed meanwhile; replayed the edits on revision ${current.revision}`,
        );
        workspace.base = current;
        workspace.working = replay.design;
        continue;
      }
      if (result.reason === "invalid") {
        workspace.reset((await this.design.getDesign(projectId))?.design ?? workspace.base);
        return { ok: false, message: describeErrors(result.errors) };
      }
      throw new TurnError(
        result.reason === "not-found" ? "The project was deleted." : result.message,
      );
    }
    throw new TurnError(
      "The design kept changing while the assistant worked. Nothing was changed.",
    );
  }

  /** Gives new items a position near the selection and saves the layout. */
  private async placeNew(
    projectId: string,
    design: DesignDocument,
    layout: LayoutDocument,
    selection: readonly string[],
  ): Promise<LayoutDocument> {
    const placed = await placeNewItems(design, layout, selection);
    if (Object.keys(placed).length === 0) return layout;
    const next = { ...layout, items: { ...layout.items, ...placed } };
    await this.design.putLayout(projectId, next);
    return next;
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

/** IDs of elements, annotations, and connections that are new or different in `after`. */
export function changedIds(before: DesignDocument, after: DesignDocument): string[] {
  const index = (design: DesignDocument) => {
    const map = new Map<string, string>();
    for (const element of design.elements) map.set(element.id, JSON.stringify(element));
    for (const connection of design.connections) map.set(connection.id, JSON.stringify(connection));
    for (const annotation of design.annotations) map.set(annotation.id, JSON.stringify(annotation));
    return map;
  };
  const old = index(before);
  const ids = new Set(Array.from(designIds(after), (entry) => entry.id));
  return [...index(after)]
    .filter(([id, json]) => ids.has(id) && old.get(id) !== json)
    .map(([id]) => id);
}
