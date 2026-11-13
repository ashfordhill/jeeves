/**
 * The providers Jeeves knows about, for the Settings picker. The design chat picks a
 * provider and a model; each provider here is a `ModelProvider` (chat with tools).
 */
import type { ModelRole } from "./types.ts";

export type ProviderId = "openai" | "codex" | "anthropic";

export type ProviderAuth =
  /**
   * An API key from the environment or `~/.jeeves/config.json` (`<configKey>.apiKey`, saved from
   * Settings). The environment wins.
   */
  | { type: "api-key"; envVar: string; configKey: string }
  /** The provider's own CLI login, e.g. `codex login`. Jeeves never sees the credentials. */
  | { type: "cli-login"; command: string };

export type ProviderInfo = {
  id: ProviderId;
  name: string;
  description: string;
  auth: ProviderAuth;
  /** Model names offered in the picker. Free text is still accepted. */
  suggestedModels: string[];
  /** `true` when an empty model name means "the provider's own default". */
  defaultModelAllowed: boolean;
};

export const providerCatalog: readonly ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI API",
    description: "OpenAI's Responses API, billed to an OpenAI API key.",
    auth: { type: "api-key", envVar: "OPENAI_API_KEY", configKey: "openai" },
    suggestedModels: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-6-astra", "gpt-6.1-sol"],
    defaultModelAllowed: false,
  },
  {
    id: "codex",
    name: "Codex",
    description:
      "OpenAI's Codex, using its own login (a ChatGPT plan or an API key). For the design chat it answers in structured output, so replies arrive whole instead of streaming.",
    auth: { type: "cli-login", command: "codex login" },
    suggestedModels: ["gpt-6-astra", "gpt-6.1-sol", "gpt-5.5", "gpt-5.3-codex"],
    defaultModelAllowed: true,
  },
  {
    id: "anthropic",
    name: "Anthropic API",
    description: "Claude on Anthropic's Messages API, billed to your Anthropic API key.",
    auth: { type: "api-key", envVar: "ANTHROPIC_API_KEY", configKey: "anthropic" },
    suggestedModels: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
    defaultModelAllowed: false,
  },
];

export function providerInfo(id: string): ProviderInfo | undefined {
  return providerCatalog.find((p) => p.id === id);
}

export type RoleModel = {
  provider: ProviderId;
  model: string;
};

export const DEFAULT_ROLE_MODELS: Record<ModelRole, RoleModel> = {
  designChat: { provider: "openai", model: "gpt-5.4-mini" },
};

/** Why a provider and model can't fill a role, or `undefined` when they can. */
export function roleModelProblem(_role: ModelRole, choice: RoleModel): string | undefined {
  const info = providerInfo(choice.provider);
  if (!info) return `Unknown provider "${choice.provider}".`;
  if (!choice.model.trim() && !info.defaultModelAllowed) return "Enter a model name.";
  return undefined;
}
