/**
 * Provider keys and models per role (PLAN §12). Keys come from the environment or
 * `~/.jeeves/config.json` and never leave this process: the API reports only whether a key is set
 * and where from. Models per role are stored in the same file.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { type ModelRole, modelRoles } from "@jeeves/providers";
import { z } from "zod";

export const DEFAULT_MODELS: Record<ModelRole, string> = {
  designChat: "gpt-5.4-mini",
  planner: "gpt-5.4-mini",
  coding: "gpt-5.1-codex",
};

const modelName = z.string().trim().min(1).max(100);

const configFileSchema = z.looseObject({
  openai: z.looseObject({ apiKey: z.string().optional() }).optional(),
  models: z.partialRecord(z.enum(modelRoles as [ModelRole, ...ModelRole[]]), modelName).optional(),
});
type ConfigFile = z.infer<typeof configFileSchema>;

export const modelsPatchSchema = z.strictObject({
  designChat: modelName.optional(),
  planner: modelName.optional(),
  coding: modelName.optional(),
});

export type KeySource = "env" | "file";

export type ProviderStatus = {
  id: "openai";
  name: string;
  configured: boolean;
  source: KeySource | null;
  /** Where the key can be set. */
  envVar: string;
};

export type SettingsView = {
  configPath: string;
  providers: ProviderStatus[];
  models: Record<ModelRole, string>;
  /** Set when the server replays a scripted fake model instead of calling a provider. */
  fakeModel: boolean;
};

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

  models(): Record<ModelRole, string> {
    return { ...DEFAULT_MODELS, ...this.read().models };
  }

  setModels(patch: z.infer<typeof modelsPatchSchema>): Record<ModelRole, string> {
    const config = this.read();
    this.write({ ...config, models: { ...config.models, ...patch } });
    return this.models();
  }

  view(): SettingsView {
    const openai = this.openaiKey();
    return {
      configPath: this.configPath,
      providers: [
        {
          id: "openai",
          name: "OpenAI",
          configured: !!openai,
          source: openai?.source ?? null,
          envVar: "OPENAI_API_KEY",
        },
      ],
      models: this.models(),
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
