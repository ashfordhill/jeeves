// Token usage in chat: chips under each reply (in, cached when reported, out) and the panel above
// the composer (context used against the selected model's window, the conversation's totals, and
// the cost when every turn reported one). Each is hidden when its numbers aren't known.
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { ChatTurn, ModelsView } from "../project/api.ts";
import { costLabel, TurnUsage, tokenCount, UsagePanel } from "./ChatPanel.tsx";

afterEach(cleanup);

const show = (node: ReactNode) => render(<MantineProvider>{node}</MantineProvider>);

type Usage = NonNullable<ChatTurn["usage"]>;

const turn = (id: number, usage: Partial<Usage> | null): ChatTurn => ({
  id,
  message: "Add a cache",
  files: [],
  selection: [],
  status: "done",
  reply: "Added it.",
  question: null,
  operationId: null,
  changed: [],
  activity: [],
  usage: usage && { inputTokens: 0, outputTokens: 0, known: true, ...usage },
  model: "claude-haiku-5-5",
  error: null,
  createdAt: "2026-11-13T00:00:00.000Z",
});

const models = (contextWindow: number | null): ModelsView => ({
  selected: { provider: "anthropic", model: "claude-haiku-5-5" },
  providers: [
    {
      id: "openai",
      name: "OpenAI API",
      ready: false,
      status: "No key",
      models: [
        {
          id: "claude-haiku-5-5",
          name: "Not the selected provider",
          contextWindow: 128_000,
          inputPrice: null,
          outputPrice: null,
        },
      ],
    },
    {
      id: "anthropic",
      name: "Anthropic API",
      ready: true,
      status: "Key saved",
      models: [
        {
          id: "claude-haiku-5-5",
          name: "Claude Haiku 5.5",
          contextWindow,
          inputPrice: 0.1,
          outputPrice: 0.5,
        },
      ],
    },
  ],
});

const chips = (name: string) =>
  [...screen.getByRole("note", { name }).querySelectorAll(".chat-usage-chip")].map(
    (chip) => chip.textContent,
  );
const panel = () => chips("Conversation usage");
const ring = () => screen.getByRole("note", { name: "Conversation usage" }).querySelector("svg");

describe("token counts", () => {
  it("writes counts as the chips show them", () => {
    expect(
      [0, 950, 1890, 36_012, 41_234, 99_949, 99_950, 500_000, 999_499].map(tokenCount),
    ).toEqual(["0", "950", "1.9k", "36.0k", "41.2k", "99.9k", "100k", "500k", "999k"]);
    expect([999_500, 1_310_000, 12_345_678].map(tokenCount)).toEqual(["1.00M", "1.31M", "12.35M"]);
    expect([0, 0.004, 0.84, 12.3].map(costLabel)).toEqual(["$0.00", "<$0.01", "$0.84", "$12.30"]);
  });
});

describe("TurnUsage", () => {
  it("shows a reply's in, cached and out tokens as chips", () => {
    show(
      <TurnUsage
        usage={{ inputTokens: 41_234, outputTokens: 1_890, known: true, cachedInputTokens: 36_012 }}
      />,
    );
    expect(chips("Model token usage")).toEqual(["in 41.2k", "cached 36.0k", "out 1.9k"]);
  });

  it("leaves out the cached chip when no cached count is reported, or it is impossible", () => {
    show(<TurnUsage usage={{ inputTokens: 1200, outputTokens: 80, known: true }} />);
    expect(chips("Model token usage")).toEqual(["in 1.2k", "out 80"]);
    cleanup();
    show(
      <TurnUsage
        usage={{ inputTokens: 1200, outputTokens: 80, known: true, cachedInputTokens: 1300 }}
      />,
    );
    expect(chips("Model token usage")).toEqual(["in 1.2k", "out 80"]);
  });

  it("shows no chip without usage, with incomplete usage or with counts that aren't counts", () => {
    for (const usage of [
      null,
      { inputTokens: 1200, outputTokens: 80, known: false },
      { inputTokens: -1, outputTokens: 80, known: true },
      { inputTokens: 1200, outputTokens: 1.5, known: true },
    ]) {
      const { container } = show(<TurnUsage usage={usage} />);
      expect(screen.queryByRole("note")).toBeNull();
      expect(container.querySelector(".chat-usage-chip")).toBeNull();
      cleanup();
    }
  });
});

describe("UsagePanel", () => {
  const conversation = [
    turn(1, { inputTokens: 1_000_000, outputTokens: 12_000, costUsd: 0.5, contextTokens: 60_000 }),
    turn(2, { inputTokens: 310_000, outputTokens: 10_000, costUsd: 0.34, contextTokens: 86_000 }),
  ];

  it("shows the newest turn's context against the model's window, the totals and the cost", () => {
    show(<UsagePanel turns={conversation} models={models(500_000)} />);
    expect(panel()).toEqual(["Context 86k / 500k", "in 1.31M", "out 22.0k", "$0.84"]);
    const used = ring()?.querySelector(".chat-usage-ring-used");
    expect(used?.getAttribute("stroke-dasharray")).toBe("17.2 100");
  });

  it("is hidden until a turn has usage", () => {
    const { container } = show(
      <UsagePanel turns={[turn(1, null), turn(2, { known: false })]} models={models(500_000)} />,
    );
    expect(screen.queryByRole("note")).toBeNull();
    expect(container.querySelector(".chat-usage-chip")).toBeNull();
    cleanup();
    show(<UsagePanel turns={[]} models={models(500_000)} />);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("leaves out the ring and the window when the model's window is unknown", () => {
    for (const view of [models(null), undefined]) {
      show(<UsagePanel turns={conversation} models={view} />);
      expect(panel()).toEqual(["Context 86k", "in 1.31M", "out 22.0k", "$0.84"]);
      expect(ring()).toBeNull();
      cleanup();
    }
    // The window is the selected model's: a model the list doesn't hold has none, and the same
    // name under another provider has that provider's.
    const other = models(500_000);
    other.selected = { provider: "anthropic", model: "claude-unlisted" };
    show(<UsagePanel turns={conversation} models={other} />);
    expect(panel()[0]).toBe("Context 86k");
    cleanup();
    other.selected = { provider: "openai", model: "claude-haiku-5-5" };
    show(<UsagePanel turns={conversation} models={other} />);
    expect(panel()[0]).toBe("Context 86k / 128k");
  });

  it("leaves out the context when the newest turn has no context size", () => {
    const older = [...conversation, turn(3, { inputTokens: 2000, outputTokens: 100, costUsd: 0 })];
    show(<UsagePanel turns={older} models={models(500_000)} />);
    expect(panel()).toEqual(["in 1.31M", "out 22.1k", "$0.84"]);
    expect(ring()).toBeNull();
  });

  it("leaves out the cost unless every turn reported one, and counts only complete turns", () => {
    show(
      <UsagePanel
        turns={[
          ...conversation,
          turn(3, { inputTokens: 8000, outputTokens: 500, contextTokens: 91_500 }),
          turn(4, null),
          turn(5, { inputTokens: 9000, outputTokens: 900, known: false, contextTokens: 100_000 }),
        ]}
        models={models(500_000)}
      />,
    );
    // Turns 1 to 3 have complete counts; turn 5 is the newest, so its context size is used.
    expect(panel()).toEqual(["Context 100k / 500k", "in 1.32M", "out 22.5k"]);
  });
});
