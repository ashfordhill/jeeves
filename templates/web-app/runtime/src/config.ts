/** Where the app finds its runtime config; written at container start from the environment. */
export const CONFIG_URL = "/jeeves-config.json";

/** The page the runtime renders instead of the app, for checking config and API calls. */
export const STATUS_PATH = "/_jeeves/status";

/**
 * Settings that differ between environments, so they're read when the page loads rather than
 * built into the bundle. The container writes them from its environment when it starts
 * (`nginx/jeeves-config.json.template`); the dev server does the same.
 */
export interface RuntimeConfig {
  title: string;
  /** The APIs the app calls, by target element ID; `url` is where the app reaches each one. */
  apis: Record<string, { url: string }>;
}

export class RuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeConfigError";
  }
}

let current: RuntimeConfig | undefined;

/** Fetches and checks the runtime config. */
export async function loadRuntimeConfig(url = CONFIG_URL): Promise<RuntimeConfig> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    throw new RuntimeConfigError(`Couldn't load ${url}: ${(error as Error).message}`);
  }
  if (!response.ok) throw new RuntimeConfigError(`Couldn't load ${url}: ${response.status}`);
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new RuntimeConfigError(`${url} isn't valid JSON`);
  }
  return parseRuntimeConfig(value, url);
}

export function parseRuntimeConfig(value: unknown, source = CONFIG_URL): RuntimeConfig {
  const problems: string[] = [];
  const config = (typeof value === "object" && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  if (typeof config.title !== "string") problems.push('"title" must be a string');
  const apis = config.apis ?? {};
  if (typeof apis !== "object" || apis === null || Array.isArray(apis)) {
    problems.push('"apis" must be an object');
  } else {
    for (const [name, api] of Object.entries(apis)) {
      if (typeof (api as { url?: unknown })?.url !== "string") {
        problems.push(`"apis.${name}.url" must be a string`);
      }
    }
  }
  if (problems.length > 0) {
    throw new RuntimeConfigError(`${source} is invalid: ${problems.join("; ")}`);
  }
  return { title: config.title as string, apis: apis as RuntimeConfig["apis"] };
}

/** Makes `config` the one `runtimeConfig()` and `apiUrl()` return. `startApp` calls it. */
export function setRuntimeConfig(config: RuntimeConfig | undefined): void {
  current = config;
}

/** The loaded runtime config. Throws before `startApp` has loaded it. */
export function runtimeConfig(): RuntimeConfig {
  if (!current) throw new RuntimeConfigError("The runtime config isn't loaded yet (startApp)");
  return current;
}

/** Where the app reaches an API (for example `/_api/links`); generated clients call this. */
export function apiUrl(name: string): string {
  const api = runtimeConfig().apis[name];
  if (!api) throw new RuntimeConfigError(`The runtime config has no API "${name}"`);
  return api.url.replace(/\/+$/, "");
}

/**
 * Fills `${NAME}` placeholders in a config template with JSON-escaped values; missing ones
 * become empty. `nginx/40-jeeves-config.sh` does the same in the container.
 */
export function renderConfigTemplate(
  template: string,
  env: Record<string, string | undefined>,
): string {
  return template.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, name: string) =>
    JSON.stringify(env[name] ?? "").slice(1, -1),
  );
}
