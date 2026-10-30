/**
 * The providers Jeeves knows about, for the Settings picker (PLAN §12). Each role (design chat,
 * planner, coding) picks a provider and a model. A model role needs a `ModelProvider` (chat with
 * tools); the coding role needs a `CodingAgentProvider`. Providers that are planned but not built
 * yet are listed with `available: false`, so the picker can show where things are going.
 */
import type { ReasoningEffort } from "./coding.ts";
import type { ModelRole } from "./types.ts";

export type ProviderId = "openai" | "codex" | "opencode" | "local";

/** What a provider can fill: `model` roles (design chat, planner) or the `coding` role. */
export type ProviderKind = "model" | "coding";

export type ProviderAuth =
  /** An API key from the environment or `~/.jeeves/config.json` (`<configKey>.apiKey`). */
  | { type: "api-key"; envVar: string; configKey: string }
  /** The provider's own CLI login, e.g. `codex login`. Jeeves never sees the credentials. */
  | { type: "cli-login"; command: string }
  | { type: "none" };

export type ProviderInfo = {
  id: ProviderId;
  name: string;
  description: string;
  kinds: ProviderKind[];
  auth: ProviderAuth;
  /** `false` for a provider that is listed but not built yet. */
  available: boolean;
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
    kinds: ["model"],
    auth: { type: "api-key", envVar: "OPENAI_API_KEY", configKey: "openai" },
    available: true,
    suggestedModels: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-6-astra", "gpt-6.1-sol"],
    defaultModelAllowed: false,
  },
  {
    id: "codex",
    name: "Codex",
    description:
      "OpenAI's Codex, using its own login (a ChatGPT plan or an API key). For the design chat and the planner it answers in structured output, so replies arrive whole instead of streaming.",
    kinds: ["model", "coding"],
    auth: { type: "cli-login", command: "codex login" },
    available: true,
    suggestedModels: ["gpt-6-astra", "gpt-6.1-sol", "gpt-5.5", "gpt-5.3-codex"],
    defaultModelAllowed: true,
  },
  {
    id: "opencode",
    name: "OpenCode",
    description:
      "OpenCode's CLI with its own provider logins (DeepSeek and others). Coding only; Jeeves's owned paths and git branch are the guard.",
    kinds: ["coding"],
    auth: { type: "cli-login", command: "opencode auth login" },
    available: true,
    suggestedModels: ["deepseek/deepseek-flash", "deepseek/deepseek-v4-pro"],
    defaultModelAllowed: true,
  },
  {
    id: "local",
    name: "Local model",
    description:
      "An OpenAI-compatible server on this machine (Ollama, LM Studio, llama.cpp, vLLM). Not built yet: see PLAN §15 S14.",
    kinds: ["model", "coding"],
    auth: { type: "none" },
    available: false,
    suggestedModels: [],
    defaultModelAllowed: false,
  },
];

export function providerInfo(id: string): ProviderInfo | undefined {
  return providerCatalog.find((p) => p.id === id);
}

export function roleKind(role: ModelRole): ProviderKind {
  return role === "coding" ? "coding" : "model";
}

export type RoleModel = {
  provider: ProviderId;
  model: string;
  /** Coding only; omitted means the provider's default. */
  reasoningEffort?: ReasoningEffort;
};

export const DEFAULT_ROLE_MODELS: Record<ModelRole, RoleModel> = {
  designChat: { provider: "openai", model: "gpt-5.4-mini" },
  planner: { provider: "openai", model: "gpt-5.4-mini" },
  // Empty: Codex's own default model (its `~/.codex/config.toml`), which the account can use.
  coding: { provider: "codex", model: "" },
};

/** Why a provider and model can't fill a role, or `undefined` when they can. */
export function roleModelProblem(role: ModelRole, choice: RoleModel): string | undefined {
  const info = providerInfo(choice.provider);
  if (!info) return `Unknown provider "${choice.provider}".`;
  if (!info.available) return `${info.name} isn't available yet.`;
  if (!info.kinds.includes(roleKind(role))) {
    return roleKind(role) === "coding"
      ? `${info.name} can't run coding tasks.`
      : `${info.name} can only run coding tasks.`;
  }
  if (!choice.model.trim() && !info.defaultModelAllowed) return "Enter a model name.";
  return undefined;
}
