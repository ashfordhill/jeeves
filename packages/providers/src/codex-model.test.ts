import { existsSync, readFileSync } from "node:fs";
import type { Input, ThreadEvent, ThreadOptions } from "@openai/codex-sdk";
import { describe, expect, it } from "vitest";
import type { CodexLike } from "./codex.ts";
import { codexAnswerSchema, createCodexModelProvider } from "./codex-model.ts";
import { ProviderError } from "./errors.ts";
import type { ModelRequest } from "./types.ts";

/** One recorded Codex session per `respond`, answering with `answers` in order. */
function recorded(answers: (string | ThreadEvent[])[]) {
  const calls: { options?: ThreadOptions; input?: Input; outputSchema?: unknown }[] = [];
  const codex: CodexLike = {
    startThread(options) {
      const call: (typeof calls)[number] = options ? { options } : {};
      calls.push(call);
      const answer = answers[calls.length - 1] ?? "";
      return {
        id: "thread-1",
        async runStreamed(input, opts) {
          call.input = input;
          call.outputSchema = opts?.outputSchema;
          // Images must exist while the session runs.
          if (Array.isArray(input)) {
            for (const part of input) if (part.type === "local_image") readFileSync(part.path);
          }
          const events: ThreadEvent[] =
            typeof answer === "string"
              ? [
                  { type: "thread.started", thread_id: "thread-1" },
                  {
                    type: "item.completed",
                    item: { id: "m", type: "agent_message", text: answer },
                  },
                  {
                    type: "turn.completed",
                    usage: {
                      input_tokens: 120,
                      cached_input_tokens: 20,
                      output_tokens: 30,
                      reasoning_output_tokens: 0,
                      cache_write_input_tokens: 0,
                    },
                  },
                ]
              : answer;
          return {
            events: (async function* () {
              for (const event of events) yield event;
            })(),
          };
        },
      };
    },
    resumeThread() {
      throw new Error("not used");
    },
  };
  return { codex, calls };
}

const request: ModelRequest = {
  model: "gpt-6-astra",
  instructions: "You edit designs.",
  tools: [
    {
      name: "getDesign",
      description: "Returns the design.",
      parameters: { type: "object", properties: {} },
    },
  ],
  items: [
    {
      type: "message",
      role: "user",
      content: [
        { type: "text", text: "Draw this sketch." },
        { type: "image", mediaType: "image/png", data: Buffer.from("png").toString("base64") },
      ],
    },
    { type: "tool-call", callId: "c1", name: "getDesign", arguments: "{}" },
    { type: "tool-result", callId: "c1", output: '{"elements":[]}' },
    { type: "opaque", provider: "openai", data: { secret: 1 } },
  ],
};

describe("Codex as a model provider", () => {
  it("sends the whole request as one read-only session and maps the structured answer", async () => {
    const { codex, calls } = recorded([
      JSON.stringify({
        message: "I'll look first.",
        toolCalls: [{ name: "getDesign", arguments: "{}" }],
      }),
    ]);
    const provider = createCodexModelProvider({ codex });
    const deltas: string[] = [];
    const response = await provider.respond(request, {
      onEvent: (e) => deltas.push(e.delta),
    });

    expect(response).toEqual({
      items: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "I'll look first." }],
        },
        { type: "tool-call", callId: "codex-0-0", name: "getDesign", arguments: "{}" },
      ],
      text: "I'll look first.",
      toolCalls: [{ callId: "codex-0-0", name: "getDesign", arguments: "{}" }],
      usage: { inputTokens: 120, outputTokens: 30, cachedInputTokens: 20 },
      stop: "tool-calls",
    });
    expect(deltas).toEqual(["I'll look first."]);

    const [call] = calls;
    expect(call?.options).toMatchObject({
      model: "gpt-6-astra",
      sandboxMode: "read-only",
      approvalPolicy: "never",
      networkAccessEnabled: false,
      webSearchMode: "disabled",
    });
    expect(call?.outputSchema).toBe(codexAnswerSchema);
    const input = call?.input as Exclude<Input, string>;
    const prompt = input[0]?.type === "text" ? input[0].text : "";
    expect(prompt).toContain("# Instructions\n\nYou edit designs.");
    expect(prompt).toContain("### getDesign");
    expect(prompt).toContain("Draw this sketch.\n\n[Attached image 1]");
    expect(prompt).toContain("Call c1: `getDesign` with arguments {}");
    expect(prompt).toContain('## Tool result for call c1\n\n{"elements":[]}');
    expect(prompt).not.toContain("secret");
    expect(input[1]).toMatchObject({ type: "local_image" });
    // The scratch folder (and the image in it) is removed afterwards.
    const image = input[1]?.type === "local_image" ? input[1].path : "";
    expect(existsSync(image)).toBe(false);
  });

  it("ends the turn when there are no tool calls, and copes with a plain-text answer", async () => {
    const { codex } = recorded([
      JSON.stringify({ message: "Done.", toolCalls: [] }),
      "Just text, no JSON.",
    ]);
    const provider = createCodexModelProvider({ codex });
    const done = await provider.respond(request);
    expect(done.stop).toBe("end");
    expect(done.text).toBe("Done.");
    const plain = await provider.respond(request);
    expect(plain.text).toBe("Just text, no JSON.");
    expect(plain.toolCalls).toEqual([]);
  });

  it("reports Codex failures as provider errors", async () => {
    const { codex } = recorded([
      [{ type: "turn.failed", error: { message: "You've hit your usage limit." } }],
    ]);
    const error = await createCodexModelProvider({ codex })
      .respond(request)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).kind).toBe("quota");
    expect((error as ProviderError).blocksProvider).toBe(true);
  });
});
