import { execFileSync } from "node:child_process";

const project = process.env.JEEVES_TEST_PROJECT_DIR ?? "";
const file = process.env.JEEVES_TEST_COMPOSE_FILE ?? "";
const name = process.env.JEEVES_TEST_COMPOSE_PROJECT ?? "";
const dbService = process.env.JEEVES_TEST_DB_SERVICE ?? "";
const service = process.env.JEEVES_TEST_SERVICE ?? "";
const serviceUrls: Record<string, string> = JSON.parse(
  process.env.JEEVES_TEST_SERVICE_URLS ?? "{}",
);

function compose(args: string[]): string {
  return execFileSync(
    "docker",
    [
      "compose",
      "--project-directory",
      project,
      "--env-file",
      "/dev/null",
      "-f",
      file,
      "-p",
      name,
      ...args,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

/** Run one statement in the disposable fixture database as the local superuser. */
export function psql(sql: string): string {
  if (!dbService) throw new Error("JEEVES_TEST_DB_SERVICE is not set");
  return compose([
    "exec",
    "-T",
    dbService,
    "psql",
    "-U",
    "postgres",
    "-d",
    service,
    "-v",
    "ON_ERROR_STOP=1",
    "-A",
    "-t",
    "-c",
    sql,
  ]).trim();
}

export function fixtureCompose(...args: string[]): string {
  return compose(args);
}

/** The fixture service's current host URL; a restart may republish an ephemeral port. */
export function serviceUrl(
  id = service,
  containerPort = Number(process.env.JEEVES_TEST_SERVICE_PORT),
): string {
  const mapping = compose(["port", id, String(containerPort)]).trim();
  const port = mapping.split(":").at(-1);
  if (!port || !/^\d+$/.test(port)) throw new Error(`No host port for ${id}: ${mapping}`);
  return `http://127.0.0.1:${port}`;
}

export async function waitFor<T>(
  check: () => Promise<T>,
  what: string,
  timeoutMs = 60_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      return await check();
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`${what} did not become ready: ${String(last)}`);
}

export async function waitReady(url = serviceUrls[service] ?? ""): Promise<void> {
  await waitFor(async () => {
    const response = await fetch(`${url}/ready`);
    if (response.status !== 200) throw new Error(`/ready returned ${response.status}`);
  }, `${service} /ready`);
}

/** Restart fixture containers with their existing named volumes, database first. */
export async function restartFixture(services: string[] = [service, dbService]): Promise<string> {
  const [app, database] = services;
  if (database) {
    compose(["restart", database]);
    await waitFor(async () => {
      try {
        compose(["exec", "-T", database, "pg_isready", "-U", "postgres"]);
      } catch {
        throw new Error(`${database} is not accepting connections`);
      }
    }, `${database} restart`);
  }
  if (app) compose(["restart", app]);
  const url = serviceUrl(app);
  await waitReady(url);
  return url;
}

export { service, serviceUrls };
