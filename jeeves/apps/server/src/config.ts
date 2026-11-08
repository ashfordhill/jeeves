/** Server settings from the environment. Defaults match compose.yaml and the web dev proxy. */
export type ServerConfig = {
  host: string;
  port: number;
  databaseUrl: string;
};

export const DEFAULT_DATABASE_URL = "postgres://jeeves:jeeves@127.0.0.1:54329/jeeves";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    // Jeeves is local-only: bind to loopback.
    host: "127.0.0.1",
    port: Number(env.JEEVES_SERVER_PORT ?? 4310),
    databaseUrl: env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  };
}
