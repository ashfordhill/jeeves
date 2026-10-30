/** Connection settings for a service's own database, read from its environment. */
export interface DatabaseConfig {
  /** `postgres://role:password@host:5432/database`, set by the generated compose file. */
  url: string;
  /** Pool budget: the most connections this service process opens. */
  poolMax: number;
  connectTimeoutMs: number;
  /** Drizzle migrations folder, relative to the working directory. */
  migrationsFolder: string;
}

export class DatabaseConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid database environment:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "DatabaseConfigError";
  }
}

type Env = Record<string, string | undefined>;

/** Reads `DATABASE_URL`, `DATABASE_POOL_MAX`, `DATABASE_CONNECT_TIMEOUT_MS`, `DATABASE_MIGRATIONS`. */
export function databaseConfigFromEnv(env: Env = process.env): DatabaseConfig {
  const problems: string[] = [];
  let url = env.DATABASE_URL ?? "";
  if (!url && env.DATABASE_HOST && env.DATABASE_USER && env.DATABASE_NAME && env.DATABASE_PASSWORD)
    url = `postgres://${encodeURIComponent(env.DATABASE_USER)}:${encodeURIComponent(env.DATABASE_PASSWORD)}@${env.DATABASE_HOST}:5432/${encodeURIComponent(env.DATABASE_NAME)}`;
  if (!url) problems.push("DATABASE_URL is required");
  else if (!/^postgres(ql)?:\/\//.test(url)) {
    problems.push("DATABASE_URL must start with postgres:// or postgresql://");
  }
  const poolMax = intFrom(env, "DATABASE_POOL_MAX", 5, 1, 100, problems);
  const connectTimeoutMs = intFrom(
    env,
    "DATABASE_CONNECT_TIMEOUT_MS",
    5000,
    100,
    120_000,
    problems,
  );
  if (problems.length > 0) throw new DatabaseConfigError(problems);
  return {
    url,
    poolMax,
    connectTimeoutMs,
    migrationsFolder: env.DATABASE_MIGRATIONS || "migrations",
  };
}

function intFrom(
  env: Env,
  name: string,
  fallback: number,
  min: number,
  max: number,
  problems: string[],
): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    problems.push(`${name} must be a whole number from ${min} to ${max} (got "${raw}")`);
    return fallback;
  }
  return value;
}
