/**
 * Runs one design eval case (V3-10) through the production ChatService, in a disposable project:
 * seed it, send the case's prompt with the given provider, score the saved design and delete the
 * project. A recording provider keeps each round's response, request hash and request size, so a
 * run replays offline and its cost can be measured.
 */
import { createHash } from "node:crypto";
import {
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
  ProviderError,
  toOpenAIInput,
  toOpenAITool,
} from "@jeeves/providers";
import {
  type DesignDocument,
  type GenerationInstalledSupport,
  type OperationInput,
  studioStudySeedOperations,
  validateDesign,
} from "@jeeves/spec";
import { eq } from "drizzle-orm";
import { ChatService } from "../chat/service.ts";
import type { Db } from "../db/client.ts";
import { designRevisions, projects } from "../db/schema.ts";
import { DesignService } from "../design/service.ts";
import { DESIGN_LIMITS, type DesignCase } from "./design-cases.ts";
import { type BuildScore, type ReviewScore, scoreBuild, scoreReview } from "./design-score.ts";
import { cleanResponse, requestContent } from "./harness.ts";
import { stable } from "./score.ts";

export type DesignRound = {
  response?: ModelResponse;
  error?: string;
  latencyMs: number;
  /** sha256 of the model-visible request (`requestContent`), checked on replay. */
  requestHash: string;
  /** The request's instructions, tools and items in the OpenAI Responses wire form, in bytes. */
  requestBytes: number;
  /** The instructions and tools alone: the part every request repeats. */
  promptBytes: number;
};
export type DesignCaseResult = {
  id: string;
  kind: DesignCase["kind"];
  rounds: DesignRound[];
  /** The model's own text, without the service's review summary. */
  modelText: string;
  /** The turn's reply as the chat rail shows it. */
  reply: string;
  error: string | null;
  /** Tool calls by name, and how many the tools refused. */
  tools: Record<string, number>;
  refusals: number;
  /** The saved design after the turn. */
  design: DesignDocument;
  score: BuildScore | ReviewScore;
  latencyMs: number;
};

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const bytes = (value: string) => Buffer.byteLength(value, "utf8");

/**
 * A provider that records every round into `rounds`, stops at the case's response limit, asks for
 * at most `maxOutputTokens` and passes `signal` on.
 */
export function recording(
  provider: ModelProvider,
  rounds: DesignRound[],
  signal?: AbortSignal,
): ModelProvider {
  return {
    id: provider.id,
    capabilities: provider.capabilities,
    async respond(request, options) {
      if (rounds.length >= DESIGN_LIMITS.rounds)
        throw new Error("Evaluation response limit exhausted");
      const start = performance.now();
      // Sizes in the OpenAI Responses wire form, the default provider's (strict tools are larger).
      const tools = JSON.stringify(request.tools.map(toOpenAITool));
      const measured = {
        requestHash: sha(requestContent(request)),
        requestBytes: bytes(
          `${JSON.stringify(request.instructions)}${tools}${JSON.stringify(toOpenAIInput(request.items, request.tools))}`,
        ),
        promptBytes: bytes(`${JSON.stringify(request.instructions)}${tools}`),
      };
      try {
        const response = await provider.respond(
          { ...request, maxOutputTokens: DESIGN_LIMITS.maxOutputTokens },
          { ...options, ...(signal && { signal }) },
        );
        rounds.push({
          ...measured,
          response: cleanResponse(response),
          latencyMs: performance.now() - start,
        });
        return response;
      } catch (error) {
        rounds.push({
          ...measured,
          error: error instanceof Error ? error.message : String(error),
          latencyMs: performance.now() - start,
        });
        throw error;
      }
    },
  };
}

/**
 * Replays recorded rounds, refusing any request whose model-visible content differs. The chat
 * turn reports a refusal as its error; `problem` says what it was, and `left` how many recorded
 * rounds the turn never asked for.
 */
export function replaying(rounds: readonly DesignRound[], label: string) {
  let index = 0;
  const state: { problem?: string } = {};
  const fail = (message: string): never => {
    state.problem ??= message;
    throw new Error(message);
  };
  const provider: ModelProvider = {
    id: "offline-replay",
    capabilities: { tools: true, imageInput: false, streaming: false, usage: true },
    async respond(request: ModelRequest) {
      const round = rounds[index++];
      if (!round) return fail(`Replay of ${label} requested an unrecorded response`);
      if (sha(requestContent(request)) !== round.requestHash)
        return fail(`Replay context drift in ${label} round ${index}`);
      if (round.error) throw new ProviderError("replay", "other", round.error);
      if (!round.response) return fail(`Replay of ${label} has no response at round ${index}`);
      return round.response;
    },
  };
  return {
    provider,
    get problem() {
      return state.problem;
    },
    get left() {
      return rounds.length - index;
    },
  };
}

/** The seed's operations: its elements, links, architecture, ownership and generation. */
export function seedOperations(seed: DesignDocument): OperationInput[] {
  const ops = studioStudySeedOperations(seed);
  if (seed.schemaVersion === 3 && seed.generation)
    ops.push({ op: "setGeneration", generation: structuredClone(seed.generation) });
  return ops;
}

/**
 * Stores a seed the lane rules now refuse as revision 1, as a design saved before those rules
 * would be. The chat turn then edits it through the ordinary path, which checks its result.
 */
async function storeLegacy(db: Db, projectId: string, seed: DesignDocument) {
  const document = { ...structuredClone(seed), revision: 1 };
  await db.insert(designRevisions).values({
    projectId,
    revision: 1,
    document,
    findings: validateDesign(document),
  });
  await db.update(projects).set({ revision: 1 }).where(eq(projects.id, projectId));
}

/** Runs one case: the given provider, through the production ChatService, then the score. */
export async function runDesignCase(
  db: Db,
  test: DesignCase,
  provider: ModelProvider,
  model: string,
  installed: GenerationInstalledSupport,
): Promise<Omit<DesignCaseResult, "rounds" | "latencyMs">> {
  const designs = new DesignService(db);
  const project = await designs.createProject(`Design eval ${test.id}`);
  try {
    const seed = test.seed();
    const ops = seedOperations(seed);
    if (test.kind === "review" && test.stored === "legacy") await storeLegacy(db, project.id, seed);
    else if (ops.length) {
      const seeded = await designs.edit(project.id, { baseRevision: 0, source: "api", ops });
      if (!seeded.ok) throw new Error(`Could not seed ${test.id}: ${stable(seeded)}`);
    }
    const initial = await designs.getDesign(project.id);
    if (!initial) throw new Error("Missing scratch project");
    if (stable({ ...initial.design, revision: 0 }) !== stable({ ...seed, revision: 0 }))
      throw new Error(`The saved seed of ${test.id} differs from the seed`);
    const texts: string[] = [];
    const tools: Record<string, number> = {};
    const observed: ModelProvider = {
      id: provider.id,
      capabilities: provider.capabilities,
      async respond(request, options) {
        const response = await provider.respond(request, options);
        if (response.text) texts.push(response.text);
        for (const call of response.toolCalls) tools[call.name] = (tools[call.name] ?? 0) + 1;
        return response;
      },
    };
    const chat = new ChatService(db, designs, () => ({ provider: observed, model }));
    const start = await chat.start(project.id, {
      message: test.prompt,
      fileIds: [],
      selection: [],
      baseRevision: initial.design.revision,
    });
    if (!start.ok) throw new Error(start.message);
    const turn = await start.run(() => {});
    const state = await designs.getDesign(project.id);
    if (!state) throw new Error("Scratch project deleted by the turn");
    const modelText = texts.join("\n\n");
    return {
      id: test.id,
      kind: test.kind,
      modelText,
      reply: turn.reply,
      error: turn.error,
      tools,
      refusals: turn.activity.filter((item) => !item.ok).length,
      design: state.design,
      score:
        test.kind === "build"
          ? scoreBuild(test.reference(installed), state.design, installed, test.values)
          : scoreReview(test, initial.design, state.design, modelText, installed),
    };
  } finally {
    await designs.deleteProject(project.id);
  }
}
