import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  DockerComposeEnvironment,
  type StartedDockerComposeEnvironment,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import { parse } from "yaml";
import type { ComposeFile } from "../compose.ts";
import type { ServiceHandle } from "../contract.ts";

const run = promisify(execFile);

export interface StartProjectOptions {
  /** Compose project name; reuse one to start the same project (and volumes) again. */
  projectName: string;
  startupTimeoutMs?: number;
}

export interface StartedProject extends AsyncDisposable {
  projectName: string;
  dir: string;
  compose: ComposeFile;
  service(name: string): ServiceHandle;
  /**
   * `docker compose down`; volumes are kept unless `volumes` is true, and images compose built
   * are removed when `images` is true.
   */
  down(options?: { volumes?: boolean; images?: boolean }): Promise<void>;
}

/**
 * Starts a project's `docker-compose.yml` with Testcontainers and `docker compose up --wait`, so
 * health checks pass and one-shot jobs finish before this resolves. Testcontainers' reaper removes
 * the project (volumes included) if the test process dies.
 */
export async function startProject(
  dir: string,
  options: StartProjectOptions,
): Promise<StartedProject> {
  const compose = parse(readFileSync(join(dir, "docker-compose.yml"), "utf8")) as ComposeFile;
  let environment = new DockerComposeEnvironment(dir, "docker-compose.yml")
    .withProjectName(options.projectName)
    .withClientOptions({ commandOptions: ["--wait"] })
    .withStartupTimeout(options.startupTimeoutMs ?? 120_000);
  for (const [name, service] of Object.entries(compose.services)) {
    if (service.healthcheck) {
      environment = environment.withWaitStrategy(`${name}-1`, Wait.forHealthCheck());
    }
  }
  const started: StartedDockerComposeEnvironment = await environment.up();

  const handles = new Map<string, ServiceHandle>();
  return {
    projectName: options.projectName,
    dir,
    compose,
    service(name) {
      let handle = handles.get(name);
      if (!handle) {
        handle = serviceHandle(name, started.getContainer(`${name}-1`), {
          dir,
          projectName: options.projectName,
        });
        handles.set(name, handle);
      }
      return handle;
    },
    async down(downOptions) {
      await started.down({ removeVolumes: downOptions?.volumes ?? false, timeout: 10_000 });
      if (downOptions?.images) await removeBuiltImages(dir, options.projectName, compose);
    },
    async [Symbol.asyncDispose]() {
      await started.down({ removeVolumes: true, timeout: 10_000 });
      await removeBuiltImages(dir, options.projectName, compose);
    },
  };
}

/** Removes images compose built for this project (services with `build` and no `image`). */
async function removeBuiltImages(dir: string, projectName: string, compose: ComposeFile) {
  const images = Object.entries(compose.services)
    .filter(([, service]) => service.build && !service.image)
    .map(([name]) => `${projectName}-${name}`);
  if (images.length === 0) return;
  await run("docker", ["image", "rm", "--force", ...images], { cwd: dir }).catch(() => {});
}

interface ComposeProject {
  dir: string;
  projectName: string;
}

function serviceHandle(
  name: string,
  container: StartedTestContainer,
  project: ComposeProject,
): ServiceHandle {
  return {
    name,
    async endpoint(containerPort) {
      const host = container.getHost();
      return {
        host: host === "localhost" ? "127.0.0.1" : host,
        port: container.getMappedPort(containerPort),
      };
    },
    async exec(command) {
      const result = await container.exec(command);
      return { exitCode: result.exitCode, output: result.output };
    },
    // Testcontainers' restart also starts a stopped container, re-reads its published ports, and
    // waits with the container's wait strategy (the health check, where there is one).
    restart: () => container.restart({ timeout: 10_000 }),
    start: () => container.restart({ timeout: 10_000 }),
    async stop(stopOptions) {
      const grace = String(stopOptions?.graceSeconds ?? 10);
      await run("docker", ["stop", "--time", grace, container.getId()]);
      const { stdout } = await run("docker", [
        "inspect",
        "--format",
        "{{.State.ExitCode}}",
        container.getId(),
      ]);
      return { exitCode: Number(stdout.trim()) };
    },
    async run(runOptions) {
      const args = ["compose", "--project-name", project.projectName, "run", "--rm", "--no-deps"];
      args.push("--no-TTY");
      for (const [key, value] of Object.entries(runOptions.env ?? {})) {
        args.push("--env", `${key}=${value}`);
      }
      args.push(name, ...(runOptions.command ?? []));
      try {
        const { stdout, stderr } = await run("docker", args, {
          cwd: project.dir,
          maxBuffer: 16 * 1024 * 1024,
        });
        return { exitCode: 0, output: stdout + stderr };
      } catch (error) {
        const failed = error as { code?: number; stdout?: string; stderr?: string };
        if (typeof failed.code !== "number") throw error;
        return { exitCode: failed.code, output: (failed.stdout ?? "") + (failed.stderr ?? "") };
      }
    },
  };
}
