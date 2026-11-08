/** Hand-authored fixture responses exercise both loops; they are not live-model evidence. */
import { createFakeProvider, toOpenAIInput, toOpenAITool } from "@jeeves/providers";
import type { EvalCase } from "./cases.ts";
import fixture from "./fixtures/synthetic.json" with { type: "json" };
import type { Arm } from "./harness.ts";

export function syntheticProvider(test: EvalCase, arm: Arm) {
  const entry = fixture.cases[test.id as keyof typeof fixture.cases];
  if (!entry) throw new Error(`No synthetic transcript for ${test.id}`);
  const provider = createFakeProvider((request, round) => {
    // Exercise RF05 historical calls, including the current loop's synthesized review call.
    for (const tool of request.tools) toOpenAITool(tool);
    toOpenAIInput(request.items, request.tools);
    if (round === 0 && entry.commands.length)
      return {
        toolCalls: [
          {
            name: "applyStudioCommands",
            arguments: {
              baseRevision: test.seed().elements.length ? 1 : 0,
              commands: entry.commands,
            },
          },
        ],
      };
    return { text: entry.reply, usage: null };
  });
  return { ...provider, arm };
}
