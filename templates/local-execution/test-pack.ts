import assert from "node:assert/strict";
import { localExecutionConfigSchema, localExecutionPolicy } from "@jeeves/spec";
import { CheckSkipped, type TestPack } from "@jeeves/template-kit";
export const testPack: TestPack = {
  template: "local-execution",
  checks: [
    {
      id: "policy-compose",
      title: "Local execution settings match the selected versioned policy",
      async run(ctx) {
        const policy = localExecutionPolicy(
          localExecutionConfigSchema.parse(ctx.subject.config).preset,
        );
        const service = ctx.compose.services[ctx.subject.element.id]!;
        assert.equal(Number(service.cpus), policy.cpus);
        // Compose's canonical JSON normalizes byte sizes, while source YAML uses MiB notation.
        assert.ok(
          service.mem_limit === `${policy.memoryMiB}m` ||
            Number(service.mem_limit) === policy.memoryMiB * 1024 * 1024,
        );
        assert.equal(service.pids_limit, policy.pids);
        assert.equal(service.init, true);
        assert.equal(service.restart, policy.restart);
        assert.equal(service.stop_grace_period, `${policy.graceSeconds}s`);
        assert.equal(service.environment?.SHUTDOWN_TIMEOUT_MS, String(policy.shutdownMs));
      },
    },
    {
      id: "policy-resource-ceilings",
      title: "The service runs with its declared cgroup CPU, memory and PID ceilings",
      async run(ctx) {
        const policy = localExecutionPolicy(
          localExecutionConfigSchema.parse(ctx.subject.config).preset,
        );
        const probe = `const fs = require('node:fs'); const root = '/sys/fs/cgroup/'; if (!fs.existsSync(root + 'cgroup.controllers')) { process.stdout.write('unsupported-cgroup'); process.exit(0); } process.stdout.write(JSON.stringify({ cpu: fs.readFileSync(root + 'cpu.max', 'utf8').trim(), memory: fs.readFileSync(root + 'memory.max', 'utf8').trim(), pids: fs.readFileSync(root + 'pids.max', 'utf8').trim() }));`;
        const result = await ctx.service(ctx.subject.element.id).exec(["node", "-e", probe]);
        assert.equal(result.exitCode, 0);
        if (result.output.trim() === "unsupported-cgroup")
          throw new CheckSkipped(
            "Resource-ceiling proof requires Linux cgroup v2; settings alone are not enforcement evidence.",
          );
        const actual = JSON.parse(result.output.trim()) as {
          cpu: string;
          memory: string;
          pids: string;
        };
        const [quota, period] = actual.cpu.split(" ").map(Number);
        assert.equal(quota! / period!, policy.cpus);
        assert.equal(Number(actual.memory), policy.memoryMiB * 1024 * 1024);
        assert.equal(Number(actual.pids), policy.pids);
      },
    },
  ],
};
