/**
 * Provider keys and the provider and model per role (PLAN §12). Keys come from the environment or
 * `~/.jeeves/config.json` and never leave this process: the API reports only whether a key is set
 * and where from. The choice per role is stored in the same file.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const configFileSchema = z.looseObject({
  openai: z.looseObject({ apiKey: z.string().optional() }).optional(),
  /** Roles that no longer exist (planner, coding) are ignored and dropped on the next save. */
  roles: z.looseObject({ designChat: roleModelSchema.optional() }).optional(),
  /** Before S13: a model name per role, always on the role's default provider. */
  models: z.looseObject({ designChat: z.string().optional() }).optional(),
});
type ConfigFile = z.infer<typeof configFileSchema>;

export const rolesPatchSchema = z.partialRecord(roleEnum, roleModelSchema);
export type RolesPatch = z.infer<typeof rolesPatchSchema>;

export type KeySource = "env" | "file";

export type ProviderStatus = Pick<
  ProviderInfo,
  "id" | "name" | "description" | "auth" | "suggestedModels" | "defaultModelAllowed"
> & {
  /** Whether the provider can be used right now (key set, logged in). */
  ready: boolean;
  /** One line about its credentials, e.g. "API key set from the environment". */
  status: string;
  /** How to set it up, when it isn't ready. */
  help: string | null;
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
    const fromEnv = this.env.OPENAI_API_KEY?.trim();
    if (fromEnv) return { key: fromEnv, source: "env" };
    const fromFile = this.read().openai?.apiKey?.trim();
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

  providerStatus(id: ProviderId): Pick<ProviderStatus, "ready" | "status" | "help"> {
    switch (id) {
      case "openai": {
        const key = this.openaiKey();
        return key
          ? {
              ready: true,
              status: `API key set ${key.source === "env" ? "from the environment" : "from the config file"}`,
              help: null,
            }
          : {
              ready: false,
              status: "No API key",
              help: `Set OPENAI_API_KEY before starting Jeeves, or add {"openai": {"apiKey": "…"}} to ${this.configPath}.`,
            };
      }
      case "codex":
        return this.codexLoggedIn()
          ? { ready: true, status: "Logged in", help: null }
          : {
              ready: false,
              status: "Not logged in",
              help: "Run `codex login` in a terminal (a ChatGPT plan or an API key both work), then reload this page.",
            };
    }
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
    const parsed = configFileSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error(`${this.configPath} is malformed: ${z.prettifyError(parsed.error)}`);
    }
    return parsed.data;
  }

  private write(config: ConfigFile) {
    mkdirSync(dirname(this.configPath), { recursive: true, mode: 0o700 });
    // The file may hold API keys: readable by the owner only.
    writeFileSync(this.configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  }
}
