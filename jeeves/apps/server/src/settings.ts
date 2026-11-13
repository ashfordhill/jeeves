/**
 * Provider keys and the provider and model per role. Keys come from the environment or
 * `~/.jeeves/config.json` (saved there from Settings) and never leave this process: the API reports
 * only whether a key is set and where from. The choice per role is stored in the same file.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  DEFAULT_ROLE_MODELS,
  type ModelRole,
  modelRoles,
  type ProviderId,
  type ProviderInfo,
  providerCatalog,
  type RoleModel,
  roleModelProblem,
} from "@jeeves/providers";
import { z } from "zod";

const roleEnum = z.enum(modelRoles as [ModelRole, ...ModelRole[]]);
const providerEnum = z.enum(providerCatalog.map((p) => p.id) as [ProviderId, ...ProviderId[]]);
const roleModelSchema = z.strictObject({
  provider: providerEnum,
  model: z.string().trim().max(100),
});

const savedKeySchema = z.looseObject({ apiKey: z.string().optional() }).optional();
const configFileSchema = z.looseObject({
  openai: savedKeySchema,
  anthropic: savedKeySchema,
  /** Roles that no longer exist (planner, coding) are ignored and dropped on the next save. */
  roles: z.looseObject({ designChat: roleModelSchema.optional() }).optional(),
  /** Older files: a model name per role, always on the role's default provider. */
  models: z.looseObject({ designChat: z.string().optional() }).optional(),
});
type ConfigFile = z.infer<typeof configFileSchema>;

export const rolesPatchSchema = z.partialRecord(roleEnum, roleModelSchema);
export type RolesPatch = z.infer<typeof rolesPatchSchema>;

export type KeySource = "env" | "file";

/**
 * The providers that take an API key (the catalog's `api-key` auth), each saved in the config
 * file under its own ID, with the environment variable that wins over it.
 */
export type KeyProviderId = "openai" | "anthropic";
const KEY_ENV: Record<KeyProviderId, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};
const KEY_STATUS: Record<KeySource, string> = {
  env: "Key set in the environment",
  file: "Key saved",
};

export function isKeyProvider(id: ProviderId): id is KeyProviderId {
  return Object.hasOwn(KEY_ENV, id);
}

export type ProviderStatus = Pick<
  ProviderInfo,
  "id" | "name" | "description" | "auth" | "suggestedModels" | "defaultModelAllowed"
> & {
  /** Whether the provider can be used right now (key set, logged in). */
  ready: boolean;
  /** One line about its credentials, e.g. "Key saved". */
  status: string;
  /**
   * How to set it up, when it isn't ready and its card can't do it. None today: OpenAI's and
   * Anthropic's cards take a key, and Codex's signs in.
   */
  help: string | null;
  /** Where its API key comes from; `null` without one, or for a provider that takes none. */
  keySource: KeySource | null;
};

export type SettingsView = {
  configPath: string;
  providers: ProviderStatus[];
  roles: Record<ModelRole, RoleModel>;
  /** Set when the server replays a scripted fake model instead of calling a provider. */
  fakeModel: boolean;
};

export class SettingsError extends Error {}

export function jeevesHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.JEEVES_HOME ?? join(homedir(), ".jeeves");
}

export class Settings {
  readonly configPath: string;

  constructor(
    home: string,
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly fakeModel = false,
  ) {
    this.configPath = join(home, "config.json");
  }

  /** The OpenAI key and where it came from. The environment wins over the file. */
  openaiKey(): { key: string; source: KeySource } | undefined {
    return this.key("openai");
  }

  /** The Anthropic key and where it came from. The environment wins over the file. */
  anthropicKey(): { key: string; source: KeySource } | undefined {
    return this.key("anthropic");
  }

  /** Saves a provider's key in the config file, keeping everything else in it. */
  setKey(id: KeyProviderId, key: string): void {
    const config = this.read();
    this.write({ ...config, [id]: { ...config[id], apiKey: key.trim() } });
  }

  /** Removes a provider's saved key, keeping everything else in the file. */
  removeKey(id: KeyProviderId): void {
    const config = this.read();
    const saved = config[id];
    if (saved?.apiKey === undefined) return;
    const { apiKey: _removed, ...kept } = saved;
    const { [id]: _section, ...others } = config;
    this.write(Object.keys(kept).length > 0 ? { ...others, [id]: kept } : others);
  }

  private key(id: KeyProviderId): { key: string; source: KeySource } | undefined {
    const fromEnv = this.env[KEY_ENV[id]]?.trim();
    if (fromEnv) return { key: fromEnv, source: "env" };
    const fromFile = this.read()[id]?.apiKey?.trim();
    return fromFile ? { key: fromFile, source: "file" } : undefined;
  }

  /** Whether `codex login` has stored credentials (Codex reads them itself). */
  codexLoggedIn(): boolean {
    const codexHome = this.env.CODEX_HOME ?? join(this.env.HOME ?? homedir(), ".codex");
    return existsSync(join(codexHome, "auth.json")) || !!this.env.CODEX_API_KEY?.trim();
  }

  roles(): Record<ModelRole, RoleModel> {
    const config = this.read();
    const roles = { ...DEFAULT_ROLE_MODELS };
    for (const role of modelRoles) {
      const chosen = config.roles?.[role];
      const legacy = config.models?.[role]?.trim();
      if (chosen) roles[role] = { provider: chosen.provider, model: chosen.model.trim() };
      else if (legacy) roles[role] = { ...DEFAULT_ROLE_MODELS[role], model: legacy };
    }
    return roles;
  }

  /** Throws `SettingsError` if a provider can't fill its role; nothing is saved then. */
  setRoles(patch: RolesPatch): Record<ModelRole, RoleModel> {
    for (const [role, choice] of Object.entries(patch) as [ModelRole, RoleModel][]) {
      const problem = roleModelProblem(role, choice);
      if (problem) throw new SettingsError(`${role}: ${problem}`);
    }
    const config = this.read();
    const { models: _legacy, ...rest } = config;
    // The old per-role model names move into `roles` the first time anything is saved.
    this.write({ ...rest, roles: { ...this.roles(), ...patch } });
    return this.roles();
  }

  providerStatus(id: ProviderId): Pick<ProviderStatus, "ready" | "status" | "help" | "keySource"> {
    if (isKeyProvider(id)) {
      // The card's key field is the setup, so a key provider has no help line.
      const key = this.key(id);
      return {
        ready: !!key,
        status: key ? KEY_STATUS[key.source] : "No key",
        help: null,
        keySource: key?.source ?? null,
      };
    }
    // Codex's card signs in itself (Sign in with ChatGPT runs `codex login`), so no help line.
    return this.codexLoggedIn()
      ? { ready: true, status: "Logged in", help: null, keySource: null }
      : { ready: false, status: "Not logged in", help: null, keySource: null };
  }

  view(): SettingsView {
    return {
      configPath: this.configPath,
      providers: providerCatalog.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        auth: p.auth,
        suggestedModels: p.suggestedModels,
        defaultModelAllowed: p.defaultModelAllowed,
        ...this.providerStatus(p.id),
      })),
      roles: this.roles(),
      fakeModel: this.fakeModel,
    };
  }

  private read(): ConfigFile {
    let text: string;
    try {
      text = readFileSync(this.configPath, "utf8");
    } catch {
      return {};
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      // JSON.parse's message quotes the text around the fault, which may be a key.
      throw new Error(`${this.configPath} is not valid JSON.`);
    }
    const parsed = configFileSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`${this.configPath} is malformed: ${z.prettifyError(parsed.error)}`);
    }
    return parsed.data;
  }

  private write(config: ConfigFile) {
    mkdirSync(dirname(this.configPath), { recursive: true, mode: 0o700 });
    // The file may hold API keys: readable by the owner only, even if it existed with a wider mode.
    writeFileSync(this.configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    chmodSync(this.configPath, 0o600);
  }
}
