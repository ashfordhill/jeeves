/**
 * The model catalogue behind the chat's model picker and the custom endpoint's known hosts.
 *
 * Model names, context sizes and prices come from models.dev (`https://models.dev/api.json`),
 * read at most once every 24 hours with a 5-second timeout and kept in
 * `<JEEVES_HOME>/models-dev.json`. Offline, or when a reply is malformed, the saved file is used;
 * with no file the catalogue is empty. A catalogue made with `fetch: null` (the server replaying a
 * scripted model) never fetches. Codex's own model list is `models_cache.json` in Codex's
 * directory, which holds no credentials.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type ProviderId,
  type ProviderInfo,
  providerCatalog,
  type RoleModel,
} from "@jeeves/providers";
import { z } from "zod";
import { baseUrlProblem, type Settings } from "./settings.ts";

export const MODELS_DEV_URL = "https://models.dev/api.json";
/** How long a catalogue is used before models.dev is read again. */
export const CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const CATALOG_TIMEOUT_MS = 5000;
/** The most models.dev models a provider lists in the picker, before its suggested ones. */
export const CATALOG_MODELS_PER_PROVIDER = 12;

/** What the catalogue keeps of one models.dev model. */
export type CatalogModel = {
  id: string;
  name: string;
  /** Tokens, or `null` when unknown. */
  contextWindow: number | null;
  /** US dollars per million input and output tokens, or `null` when unknown. */
  inputPrice: number | null;
  outputPrice: number | null;
  /** Whether it takes tools (models.dev's `tool_call`); the design chat needs them. */
  toolCall: boolean;
  /** `YYYY-MM-DD` or `YYYY-MM`, for newest first; `null` when unknown. */
  releaseDate: string | null;
};

export type CatalogProvider = {
  id: string;
  name: string;
  /** Its OpenAI-compatible base URL, when models.dev gives one. */
  api: string | null;
  models: CatalogModel[];
};

export type ModelCatalog = {
  /** The catalogue, read from models.dev first when the saved one is a day old. Never rejects. */
  providers(): Promise<readonly CatalogProvider[]>;
};

const nullableNumber = z.number().nullable();
const catalogFileSchema = z.object({
  fetchedAt: z.number(),
  providers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      api: z.string().nullable(),
      models: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          contextWindow: nullableNumber,
          inputPrice: nullableNumber,
          outputPrice: nullableNumber,
          toolCall: z.boolean(),
          releaseDate: z.string().nullable(),
        }),
      ),
    }),
  ),
});
type CatalogFile = z.infer<typeof catalogFileSchema>;

type Json = Record<string, unknown>;
const record = (value: unknown): Json | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : undefined;
const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
/** A token count: a positive whole number. */
const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
/** A price: a finite number, zero or more. */
const amount = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

/**
 * The providers and models of a models.dev reply, keeping each model's ID, name, context size,
 * prices, `tool_call` and release date; entries without models are skipped. `undefined` when the
 * reply isn't an object of providers.
 */
export function parseModelsDev(json: unknown): CatalogProvider[] | undefined {
  const root = record(json);
  if (!root) return undefined;
  const providers: CatalogProvider[] = [];
  for (const [key, value] of Object.entries(root)) {
    const provider = record(value);
    const models = record(provider?.models);
    if (!provider || !models) continue;
    const id = text(provider.id) ?? key;
    const kept: CatalogModel[] = [];
    for (const [modelKey, raw] of Object.entries(models)) {
      const model = record(raw);
      if (!model) continue;
      const modelId = text(model.id) ?? modelKey;
      kept.push({
        id: modelId,
        name: text(model.name) ?? modelId,
        contextWindow: count(record(model.limit)?.context),
        inputPrice: amount(record(model.cost)?.input),
        outputPrice: amount(record(model.cost)?.output),
        toolCall: model.tool_call === true,
        releaseDate: text(model.release_date) ?? null,
      });
    }
    providers.push({
      id,
      name: text(provider.name) ?? id,
      api: text(provider.api) ?? null,
      models: kept,
    });
  }
  return providers.length > 0 ? providers : undefined;
}

function readCatalogFile(path: string): CatalogFile | undefined {
  try {
    const parsed = catalogFileSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function writeCatalogFile(path: string, file: CatalogFile) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(file)}\n`);
  renameSync(temporary, path);
}

export function createModelCatalog({
  home,
  fetch,
  now,
}: {
  /** `JEEVES_HOME`, where `models-dev.json` is kept. */
  home: string;
  /** `null` never fetches: the server replays a scripted model. */
  fetch: typeof globalThis.fetch | null;
  /** Milliseconds since the epoch. */
  now: () => number;
}): ModelCatalog {
  const path = join(home, "models-dev.json");
  let saved: CatalogFile | undefined;
  /** When models.dev was last asked, answered or not. */
  let asked: number | undefined;
  let pending: Promise<void> | undefined;

  const refresh = async (read: typeof globalThis.fetch) => {
    asked = now();
    try {
      const res = await read(MODELS_DEV_URL, {
        signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
        headers: { accept: "application/json" },
      });
      if (!res.ok) return;
      const providers = parseModelsDev(await res.json());
      if (!providers) return;
      saved = { fetchedAt: now(), providers };
      writeCatalogFile(path, saved);
    } catch {
      // Offline, timed out, malformed or not writable: the catalogue already in hand stays.
    }
  };

  return {
    async providers() {
      // A file that isn't there yet (or can't be read) is looked for again next time.
      saved ??= readCatalogFile(path);
      const due = (since: number | undefined) =>
        since === undefined || now() - since >= CATALOG_MAX_AGE_MS;
      if (fetch && due(saved?.fetchedAt) && due(asked)) {
        pending ??= refresh(fetch).finally(() => {
          pending = undefined;
        });
      }
      if (pending) await pending;
      return saved?.providers ?? [];
    },
  };
}

/** One model in the picker. */
export type ModelOption = {
  id: string;
  name: string;
  contextWindow: number | null;
  inputPrice: number | null;
  outputPrice: number | null;
};

/** One provider's section in the picker. */
export type ProviderModels = {
  id: ProviderId;
  name: string;
  ready: boolean;
  status: string;
  models: ModelOption[];
};

/** `GET /models`: the design chat's model and every provider's models. */
export type ModelsView = { selected: RoleModel; providers: ProviderModels[] };

/** A models.dev provider with an OpenAI-compatible base URL, for the custom endpoint's card. */
export type KnownHost = { id: string; name: string; baseUrl: string };

const option = ({
  id,
  name,
  contextWindow,
  inputPrice,
  outputPrice,
}: ModelOption): ModelOption => ({
  id,
  name,
  contextWindow,
  inputPrice,
  outputPrice,
});
const plainOption = (id: string): ModelOption => ({
  id,
  name: id,
  contextWindow: null,
  inputPrice: null,
  outputPrice: null,
});

/** A provider's models that take tools, newest first, at most 12. */
function toolModels(provider: CatalogProvider | undefined): CatalogModel[] {
  return (provider?.models ?? [])
    .filter((model) => model.toolCall)
    .sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""))
    .slice(0, CATALOG_MODELS_PER_PROVIDER);
}

const codexCacheSchema = z.looseObject({ models: z.array(z.unknown()) });
const codexModelSchema = z.looseObject({
  slug: z.string().trim().min(1),
  display_name: z.string().optional(),
  context_window: z.number().nullable().optional(),
  visibility: z.string().optional(),
});

/**
 * The models Codex lists (`visibility: "list"`) in `<codexHome>/models_cache.json`, in its order;
 * `undefined` when the file can't be read or lists none.
 */
export function codexModels(codexHome: string): ModelOption[] | undefined {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(join(codexHome, "models_cache.json"), "utf8"));
  } catch {
    return undefined;
  }
  const file = codexCacheSchema.safeParse(json);
  if (!file.success) return undefined;
  const listed = file.data.models.flatMap((raw) => {
    const model = codexModelSchema.safeParse(raw);
    if (!model.success || model.data.visibility !== "list") return [];
    const { slug, display_name, context_window } = model.data;
    return [
      {
        ...plainOption(slug),
        name: display_name?.trim() || slug,
        contextWindow: count(context_window),
      },
    ];
  });
  return listed.length > 0 ? listed : undefined;
}

const withoutTrailingSlash = (url: string) => url.trim().replace(/\/+$/, "");

/**
 * A provider's models. OpenAI and Anthropic: models.dev's that take tools, newest first, at most
 * 12, then the suggested ones and the selected one. Codex: its own list, else the suggested ones.
 * The custom endpoint: the models of the models.dev provider whose `api` is its base URL, else none.
 */
function modelOptions(
  info: ProviderInfo,
  catalogue: readonly CatalogProvider[],
  settings: Settings,
  selected: RoleModel,
): ModelOption[] {
  switch (info.id) {
    case "openai":
    case "anthropic": {
      const source = catalogue.find((provider) => provider.id === info.id);
      const known = new Map(source?.models.map((model) => [model.id, model]));
      const chosen = selected.provider === info.id && selected.model ? [selected.model] : [];
      const ids = [
        ...toolModels(source).map((model) => model.id),
        ...info.suggestedModels,
        ...chosen,
      ];
      return [...new Set(ids)].map((id) => {
        const model = known.get(id);
        return model ? option(model) : plainOption(id);
      });
    }
    case "codex":
      return codexModels(settings.codexHome()) ?? info.suggestedModels.map(plainOption);
    case "custom": {
      const endpoint = settings.customEndpoint();
      if (!endpoint) return [];
      const baseUrl = withoutTrailingSlash(endpoint.baseUrl);
      const source = catalogue.find(
        (provider) => provider.api !== null && withoutTrailingSlash(provider.api) === baseUrl,
      );
      return toolModels(source).map(option);
    }
  }
}

export async function modelsView(settings: Settings, catalog: ModelCatalog): Promise<ModelsView> {
  const catalogue = await catalog.providers();
  const selected = settings.roles().designChat;
  return {
    selected,
    providers: providerCatalog.map((info) => {
      const { ready, status } = settings.providerStatus(info.id);
      return {
        id: info.id,
        name: info.name,
        ready,
        status,
        models: modelOptions(info, catalogue, settings, selected),
      };
    }),
  };
}

/** The models.dev providers with a base URL the custom endpoint can take, by name. */
export function knownHosts(catalogue: readonly CatalogProvider[]): KnownHost[] {
  return catalogue
    .flatMap((provider) =>
      provider.api && !baseUrlProblem(provider.api)
        ? [{ id: provider.id, name: provider.name, baseUrl: provider.api }]
        : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}
