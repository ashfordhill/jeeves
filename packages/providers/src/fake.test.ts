import { describe, expect, it } from "vitest";
import { assertSupported } from "./errors.ts";
import { CALLER_NOTE_PREFIX, createFakeProvider, scriptByMessage } from "./fake.ts";
import type { ModelItem, ModelProvider, ModelRequest } from "./types.ts";

const user = (text: string): ModelItem => ({
  type: "message",
  role: "user",
  content: [{ type: "text", text }],
});
const req = (items: ModelItem[]): ModelRequest => ({
  model: "m",
  instructions: "",
  items,
  tools: [],
});

describe("fake provider", () => {
  it("replays steps in order, streams text, and records requests", async () => {
    const provider = createFakeProvider([
      { toolCalls: [{ name: "getDesign", arguments: {} }] },
      { text: "All done here." },
    ]);
    const first = await provider.respond(req([user("hi")]));
    expect(first.toolCalls).toEqual([{ callId: "fake-0-0", name: "getDesign", arguments: "{}" }]);
    expect(first.stop).toBe("tool-calls");

    const deltas: string[] = [];
    const second = await provider.respond(req([user("hi")]), {
      onEvent: (e) => deltas.push(e.delta),
    });
    expect(deltas).toEqual(["All ", "done ", "here."]);
    expect(second).toMatchObject({ text: "All done here.", stop: "end", toolCalls: [] });
    expect(provider.requests).toHaveLength(2);
    await expect(provider.respond(req([]))).rejects.toThrow(/no response for call 2/);
  });

  it("throws scripted provider errors", async () => {
    const provider = createFakeProvider([{ error: "quota" }]);
    await expect(provider.respond(req([user("x")]))).rejects.toMatchObject({
      kind: "quota",
      blocksProvider: true,
    });
  });

  it("picks steps by the latest message and the rounds since it", () => {
    const script = scriptByMessage({
      turns: [
        { match: "shortener", steps: [{ text: "one" }, { text: "two" }, { text: "three" }] },
        { match: "other", steps: [{ text: "other" }] },
      ],
    });
    const pick = (items: ModelItem[]) =>
      typeof script === "function" ? script(req(items), 0).text : undefined;
    const call: ModelItem = { type: "tool-call", callId: "c", name: "getDesign", arguments: "{}" };
    const result: ModelItem = { type: "tool-result", callId: "c", output: "{}" };
    const done: ModelItem = {
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "ok" }],
    };

    expect(pick([user("Make me a link SHORTENER")])).toBe("one");
    expect(pick([user("make me a link shortener"), call, result])).toBe("two");
    // A caller note continues the same turn.
    expect(
      pick([user("link shortener"), call, result, done, user(`${CALLER_NOTE_PREFIX} retry`)]),
    ).toBe("three");
    expect(pick([user("link shortener"), call, result, user("something other")])).toBe("other");
    expect(pick([user("nothing matches")])).toMatch(/no turn matching/);
  });

  it("reports unsupported capabilities instead of dropping them", () => {
    const textOnly: ModelProvider = {
      id: "text-only",
      capabilities: { tools: true, imageInput: false, streaming: false, usage: false },
      respond: async () => ({ items: [], text: "", toolCalls: [], usage: null, stop: "end" }),
    };
    const withImage = req([
      {
        type: "message",
        role: "user",
        content: [{ type: "image", mediaType: "image/png", data: "" }],
      },
    ]);
    expect(() => assertSupported(textOnly, withImage)).toThrow(/doesn't support imageInput/);
  });
});
