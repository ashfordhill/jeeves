/** Hand-authored fixture responses exercise both loops; they are not live-model evidence. */
import { createFakeProvider, toOpenAIInput, toOpenAITool } from "@jeeves/providers";
import type { StudioCommand } from "@jeeves/spec";
import { toChatCommands } from "../chat/commands.ts";
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
              // The current tools take no revision (a turn edits one working copy, V3-19).
              ...(arm !== "current" && { baseRevision: test.seed().elements.length ? 1 : 0 }),
              // The baseline's six tools take the studio's commands; the current tools take
              // chat's own form (V3-19), the same commands without `side` and with a label.
              commands:
                arm === "current"
                  ? entry.commands.flatMap((command) =>
                      toChatCommands(test.seed(), command as StudioCommand),
                    )
                  : entry.commands,
            },
          },
        ],
      };
    return { text: entry.reply, usage: null };
  });
  return { ...provider, arm };
}
