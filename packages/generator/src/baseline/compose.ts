import type { ServiceHandle } from "@jeeves/template-kit";
import { type RunResult, runCommand } from "../exec.ts";

const HEALTH_TIMEOUT_MS = 120_000;

/**
 * Runs `docker compose` in a generated project. The project name is compose's default (the
 * folder's name), so it's the same project a person gets with `docker compose up` there.
 */
export class ComposeCli {
  constructor(
    readonly dir: string,
    private readonly signal?: AbortSignal,
    private readonly isolation?: { file: string; name: string },
  ) {}

  run(args: string[], onLine?: (line: string) => void): Promise<RunResult> {
    const flags = this.isolation
      ? [
          "--project-directory",
          this.dir,
          "--env-file",
          "/dev/null",
          "-f",
          this.isolation.file,
          "-p",
          this.isolation.name,
        ]
      : [];
    return runCommand("docker", ["compose", ...flags, ...args], {
      cwd: this.dir,
      ...(onLine && { onLine }),
      ...(this.signal && { signal: this.signal }),
    });
  }

  async ok(args: string[]): Promise<string> {
    const result = await this.run(args);
    if (result.exitCode !== 0) {
      throw new Error(`docker compose ${args.join(" ")} failed:\n${result.output.trim()}`);
    }
    return result.output.trim();
  }

  async containerId(service: string): Promise<string> {
    const id = (await this.ok(["ps", "--all", "--quiet", service])).split("\n")[0]?.trim();
    if (!id) throw new Error(`No container for service ${service}`);
    return id;
  }

  /** Waits until the service's container is healthy (or running, without a health check). */
  async waitHealthy(service: string): Promise<void> {
    const id = await this.containerId(service);
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    let last = "";
    while (Date.now() < deadline) {
      const result = await runCommand(
        "docker",
        [
          "inspect",
          "--format",
          "{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}",
          id,
        ],
        { cwd: this.dir },
      );
      last = result.output.trim();
      const [state, health] = last.split(" ");
      if (state === "running" && (health === undefined || health === "healthy")) return;
      if (state === "exited" || state === "dead") break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`${service} didn't become healthy (${last || "unknown state"})`);
  }

  service(name: string): ServiceHandle {
    return {
      name,
      endpoint: async (containerPort) => {
        const address = await this.ok(["port", name, String(containerPort)]);
        const match = /^(.*):(\d+)$/.exec(address.split("\n")[0] ?? "");
        if (!match?.[1] || !match[2]) {
          throw new Error(`${name} doesn't publish port ${containerPort} (${address})`);
        }
        const host = match[1] === "0.0.0.0" || match[1] === "localhost" ? "127.0.0.1" : match[1];
        return { host, port: Number(match[2]) };
      },
      exec: async (command) => {
        const result = await this.run(["exec", "--no-TTY", name, ...command]);
        return { exitCode: result.exitCode, output: result.output };
      },
      restart: async () => {
        await this.ok(["restart", name]);
        await this.waitHealthy(name);
      },
      stop: async (options) => {
        const grace = String(options?.graceSeconds ?? 10);
        await this.ok(["stop", "--timeout", grace, name]);
        const id = await this.containerId(name);
        const result = await runCommand(
          "docker",
          ["inspect", "--format", "{{.State.ExitCode}}", id],
          { cwd: this.dir },
        );
        return { exitCode: Number(result.output.trim()) };
      },
      start: async () => {
        await this.ok(["start", name]);
        await this.waitHealthy(name);
      },
      run: async (options) => {
        const args = ["run", "--rm", "--no-deps", "--no-TTY"];
        for (const [key, value] of Object.entries(options.env ?? {})) {
          args.push("--env", `${key}=${value}`);
        }
        const result = await this.run([...args, name, ...(options.command ?? [])]);
        return { exitCode: result.exitCode, output: result.output };
      },
    };
  }
}
