import { localExecutionConfigSchema, localExecutionPolicy } from "@jeeves/spec";
import type { GenerateContext, GenerateResult } from "@jeeves/template-kit";
export function generate(ctx: GenerateContext): GenerateResult {
  const policy = localExecutionPolicy(localExecutionConfigSchema.parse(ctx.config).preset);
  return {
    runtimeDependencies: [],
    files: [
      {
        path: `${ctx.dir}/EXECUTION.generated.md`,
        ownership: "generated",
        contents: `# Local execution policy 0.1.0

Selected preset: ${policy.preset}. Generated limits apply to this service in local Docker Compose.

CPU ceiling: ${policy.cpus}; memory: ${policy.memoryMiB} MiB; process ceiling: ${policy.pids}; init: enabled. Restart: ${policy.restart}. Application shutdown deadline: ${policy.shutdownMs / 1000}s; Docker grace: ${policy.graceSeconds}s.

Save updates the design; Generate writes settings; recreating the container applies them. Neither operation in the editor restarts a live application. Policy removal restores this HTTP template's defaults at generation.

These are resource ceilings, not throughput guarantees or replicas. Docker retries nonzero process exits; a failed health check alone does not restart a container. Manual stops suppress restart. Docker controls the restart delay; sustained uptime can reset that delay. The on-failure policy does not restore a container after a Docker daemon restart. Application shutdown may force unfinished work to end at its deadline; choose idempotent handlers for durable effects.

Verification checks the Compose definition and, on Linux cgroup v2, actual CPU/memory/PID ceilings. Missing platform support is reported as skipped. These checks do not certify capacity, availability, external effects or deployment.

Reference: https://docs.docker.com/engine/containers/start-containers-automatically/
Reference: https://docs.docker.com/reference/compose-file/services/
`,
      },
      {
        path: `${ctx.dir}/execution-policy.generated.json`,
        ownership: "generated",
        contents: `${JSON.stringify(policy, null, 2)}\n`,
      },
    ],
    compose: {
      services: {
        [ctx.element.id]: {
          cpus: policy.cpus,
          mem_limit: `${policy.memoryMiB}m`,
          pids_limit: policy.pids,
          init: policy.init,
          restart: policy.restart,
          stop_grace_period: `${policy.graceSeconds}s`,
          environment: { SHUTDOWN_TIMEOUT_MS: String(policy.shutdownMs) },
        },
      },
    },
  };
}
