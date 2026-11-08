/** Eval-only RF00 guidance/tools ablation plus the real production ChatService path. */
import type { ModelItem, ModelProvider, ModelResponse, ToolDefinition } from "@jeeves/providers";
import { studioChanges, studioStudySeedOperations, validateDesign } from "@jeeves/spec";
import { ChatService } from "../chat/service.ts";
import { isWorkspaceMutation, turnContext, Workspace } from "../chat/tools.ts";
import type { Db } from "../db/client.ts";
import { DesignService } from "../design/service.ts";
import type { EvalCase } from "./cases.ts";
import { LIMITS, MODEL } from "./cases.ts";
import baseline from "./fixtures/rf00.json" with { type: "json" };
import { type Outcome, score, stable } from "./score.ts";

export type Arm = "rf00-ablation" | "current";
export type Round = {
  response?: ModelResponse;
  error?: string;
  latencyMs: number;
  requestHash: string;
};
export type CaseResult = Outcome & {
  id: string;
  arm: Arm;
  rounds: Round[];
  checks: ReturnType<typeof score>;
  activity: { tool: string; ok: boolean; summary: string }[];
  toolResults: { callId: string; output: string }[];
  latencyMs: number;
  repairBatches: number;
  refusals: number;
  question: unknown;
  before: Outcome["design"];
};
export const baselineTools = baseline.tools as ToolDefinition[];
export const baselineInstructions = baseline.instructions;

/** Replay compares model-visible canonical context, not timestamps/project IDs or encrypted transport. */
export function requestContent(request: {
  instructions: string;
  tools: ToolDefinition[];
  items: ModelItem[];
}) {
  return stable({
    instructions: request.instructions,
    tools: request.tools,
    items: request.items.filter((i) => i.type !== "opaque"),
  });
}
export function cleanResponse(response: ModelResponse): ModelResponse {
  return { ...response, items: response.items.filter((i) => i.type !== "opaque") };
}
export async function runCase(
  db: Db,
  test: EvalCase,
  arm: Arm,
  provider: ModelProvider,
  model = MODEL,
): Promise<Omit<CaseResult, "rounds" | "latencyMs">> {
  const design = new DesignService(db);
  const project = await design.createProject(`RF06 synthetic ${test.id}`);
  try {
    const seed = test.seed();
    const seedOps = studioStudySeedOperations(seed);
    if (seedOps.length) {
      const result = await design.edit(project.id, {
        baseRevision: 0,
        source: "api",
        ops: seedOps,
      });
      if (!result.ok) throw new Error(`Could not seed ${test.id}: ${stable(result)}`);
    }
    const initial = await design.getDesign(project.id);
    if (!initial) throw new Error("Missing scratch project");
    const before = initial.design;
    let outcome: Outcome;
    let activity: CaseResult["activity"] = [];
    let question: unknown = null;
    const toolResults: CaseResult["toolResults"] = [];
    let repairBatches = 0;
    const observe: ModelProvider = {
      ...provider,
      async respond(request, options) {
        for (const item of request.items)
          if (item.type === "tool-result" && !toolResults.some((r) => r.callId === item.callId))
            toolResults.push({ callId: item.callId, output: item.output });
        const response = await provider.respond(request, options);
        const receivedReview = request.items.some(
          (item) =>
            item.type === "tool-call" &&
            item.name === "reviewDesign" &&
            request.items.some(
              (result) => result.type === "tool-result" && result.callId === item.callId,
            ),
        );
        if (
          receivedReview &&
          response.toolCalls.some((call) => isWorkspaceMutation(call.name, call.arguments))
        )
          repairBatches++;
        return response;
      },
    };
    if (arm === "current") {
      const chat = new ChatService(db, design, () => ({ provider: observe, model }));
      const start = await chat.start(project.id, {
        message: test.prompt,
        fileIds: [],
        selection: [],
        baseRevision: before.revision,
      });
      if (!start.ok) throw new Error(start.message);
      const turn = await start.run(() => {});
      const state = await design.getDesign(project.id);
      if (!state) throw new Error("Scratch project deleted by turn");
      activity = turn.activity;
      question = turn.question;
      outcome = {
        design: state.design,
        reply: turn.reply,
        obligationText: activity
          .filter((a) => a.tool === "reviewDetail" && a.summary.startsWith("Not specified"))
          .map((a) => a.summary),
        error: turn.error,
      };
    } else {
      // Deliberate ablation: RF00 prompt/six tools; current context/Workspace/shared provider transport/atomic save.
      // No RF04 review calls are synthesized or replayed under the baseline's six-tool map.
      const workspace = new Workspace(before);
      const items: ModelItem[] = [
        {
          type: "message",
          role: "user",
          content: [{ type: "text", text: turnContext(before, validateDesign(before), []) }],
        },
        { type: "message", role: "user", content: [{ type: "text", text: test.prompt }] },
      ];
      let reply = "";
      let error: string | null = null;
      try {
        for (let round = 0; ; round++) {
          if (round >= LIMITS.rounds)
            throw new Error("Evaluation response limit exhausted; nothing saved");
          const response = await observe.respond({
            model,
            instructions: baselineInstructions,
            tools: baselineTools,
            items,
          });
          reply += `${reply && response.text ? "\n\n" : ""}${response.text}`;
          items.push(...response.items);
          for (const call of response.toolCalls) {
            const available = baselineTools.some((t) => t.name === call.name);
            if (!available)
              workspace.log(
                call.name,
                false,
                `Unavailable baseline tool ${call.name}; use the six declared tools.`,
              );
            const output = available
              ? workspace.run(call.name, call.arguments)
              : JSON.stringify({
                  ok: false,
                  error: `There is no tool named "${call.name}" in this evaluation arm. Use the six declared tools.`,
                });
            items.push({ type: "tool-result", callId: call.callId, output });
            toolResults.push({ callId: call.callId, output });
          }
          if (response.toolCalls.length && !workspace.question) continue;
          if (studioChanges(before, workspace.working).length) {
            const saved = await design.edit(project.id, {
              baseRevision: before.revision,
              source: "chat",
              ops: workspace.pending,
            });
            if (!saved.ok) throw new Error(`Ablation commit refused: ${stable(saved)}`);
          }
          break;
        }
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }
      activity = workspace.activity;
      question = workspace.question ?? null;
      const state = await design.getDesign(project.id);
      if (!state) throw new Error("Scratch project missing");
      outcome = { design: state.design, reply, obligationText: [], error };
    }
    return {
      ...outcome,
      id: test.id,
      arm,
      before,
      activity,
      toolResults,
      question,
      repairBatches,
      refusals: activity.filter((a) => !a.ok).length,
      checks: score(test, before, outcome),
    };
  } finally {
    await design.deleteProject(project.id);
  }
}
