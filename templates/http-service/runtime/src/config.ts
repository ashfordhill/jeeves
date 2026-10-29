import { z } from "zod";

export type Env = Record<string, string | undefined>;

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** The service's own settings, read from its environment (set by `docker-compose.yml`). */
export interface ServiceConfig {
  port: number;
  host: string;
  logLevel: LogLevel;
  /** How long a graceful shutdown may take before the process exits anyway. */
  shutdownTimeoutMs: number;
  /** How long `/ready` waits for each dependency. */
  readyTimeoutMs: number;
}

/** Values used when a variable isn't set, normally the element's config from the design. */
export interface ServiceDefaults {
  port?: number;
  logLevel?: LogLevel;
}

/** Thrown before anything starts when the environment is invalid; lists every problem. */
export class ServiceConfigError extends Error {
  readonly service: string;
  readonly problems: string[];

  constructor(service: string, problems: string[]) {
    super(
      `Service "${service}" can't start: invalid environment\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
    this.name = "ServiceConfigError";
    this.service = service;
    this.problems = problems;
  }
}

/** A whole number from an environment variable, with a readable message when it isn't one. */
export function intVar(min: number, max: number, fallback: number) {
  return z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (raw === undefined || raw.trim() === "") return fallback;
      const value = Number(raw);
      if (!Number.isInteger(value) || value < min || value > max) {
        ctx.addIssue({
          code: "custom",
          message: `must be a whole number from ${min} to ${max} (got "${raw}")`,
        });
        return z.NEVER;
      }
      return value;
    });
}

/** One of a fixed set of strings, defaulting when unset. */
export function enumVar<const T extends readonly [string, ...string[]]>(
  values: T,
  fallback: T[number],
) {
  return z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (raw === undefined || raw.trim() === "") return fallback;
      if (!values.includes(raw)) {
        ctx.addIssue({
          code: "custom",
          message: `must be one of ${values.join(", ")} (got "${raw}")`,
        });
        return z.NEVER;
      }
      return raw as T[number];
    });
}

function serviceEnvSchema(defaults: ServiceDefaults) {
  return z.object({
    PORT: intVar(1, 65_535, defaults.port ?? 8080),
    HOST: z.string().optional().default("0.0.0.0"),
    LOG_LEVEL: enumVar(LOG_LEVELS, defaults.logLevel ?? "info"),
    SHUTDOWN_TIMEOUT_MS: intVar(100, 120_000, 10_000),
    READY_TIMEOUT_MS: intVar(50, 60_000, 2_000),
  });
}

/**
 * Parses an environment with a Zod object schema; returns the value, or the problems as
 * `NAME: message` lines.
 */
export function parseEnv<S extends z.ZodObject>(
  schema: S,
  env: Env,
): { ok: true; value: z.output<S> } | { ok: false; problems: string[] } {
  const result = schema.safeParse(env);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    problems: result.error.issues.map((issue) => {
      const name = issue.path.join(".");
      return name ? `${name}: ${issue.message}` : issue.message;
    }),
  };
}

/** Reads `PORT`, `HOST`, `LOG_LEVEL`, `SHUTDOWN_TIMEOUT_MS`, and `READY_TIMEOUT_MS`. */
export function serviceConfigFromEnv(
  env: Env,
  defaults: ServiceDefaults = {},
): { ok: true; value: ServiceConfig } | { ok: false; problems: string[] } {
  const parsed = parseEnv(serviceEnvSchema(defaults), env);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  return {
    ok: true,
    value: {
      port: v.PORT,
      host: v.HOST,
      logLevel: v.LOG_LEVEL,
      shutdownTimeoutMs: v.SHUTDOWN_TIMEOUT_MS,
      readyTimeoutMs: v.READY_TIMEOUT_MS,
    },
  };
}
