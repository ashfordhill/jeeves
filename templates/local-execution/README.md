# Local execution policy 0.1.0

An opt-in attachment for HTTP service 0.3.0. The generated policy bounds a single local Docker Compose container and its shutdown behavior. It generates configuration and a guide; it adds no runtime dependency, shell hook, business handler or implementation-model task. Existing HTTP 0.1/0.2 output and HTTP 0.3 without this attachment retain their original execution defaults.

| Preset | CPUs | Memory | PIDs | Failure retries | App shutdown | Docker grace |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Compact | 0.5 | 512 MiB | 128 | 3 | 15s | 20s |
| Balanced (default) | 1 | 768 MiB | 192 | 5 | 20s | 25s |
| Expanded | 2 | 1536 MiB | 256 | 5 | 30s | 35s |

All presets use `init: true`. These finite 0.1.0 meanings are a published boundary: change semantics under a new policy version. Resource ceilings are not capacity promises. Host resources and platform enforcement remain relevant. CPU/memory/PID limits use the actual [Compose service settings](https://docs.docker.com/reference/compose-file/services/).

Docker's `on-failure:N` retries nonzero process exits. It does not restore the container after a Docker daemon restart; unhealthy status alone does not restart a running process. Manual stops suppress automatic restart. Docker manages restart delay, with sustained uptime resetting that delay, as described in its [restart policy documentation](https://docs.docker.com/reference/cli/docker/container/run/#restart-policies---restart). This is local recovery, not failover, an availability guarantee or horizontal scaling.

Use **Add attachment → Local execution policy → Configure local execution** on HTTP 0.3.0. Save changes the semantic design with undo support; Generate writes owned Compose/JSON/guide files. A subsequent container recreation applies the changed definition. Neither Save nor generation deploys or restarts a live application. C4 shows the declared policy on its actual container and component scope; it does not invent another application component. Policy notes are explanatory and do not seed domain implementation.

The generator keeps project source and refuses hand edits to owned output. Removing the attachment restores the HTTP template's defaults in Compose. The existing generator retains and reports orphaned files; an old `execution-policy.generated.json` or guide left on disk is not active configuration. Review reported orphans before reattaching or reusing those paths. Released recipe/starter snapshots are unchanged. The current subtype picker is destructive for version changes; safe reviewed upgrades are the next bounded package.

`policy-compose` checks effective configuration. `policy-resource-ceilings` reads cgroup v2 CPU quota, memory and PID ceilings inside the running service; unsupported cgroups are explicitly skipped and do not establish enforcement. `pnpm work run local-execution` requires those checks to execute, inspects known Docker limit fields, verifies process-failure restart/readiness, drains an in-flight request, and proves a stuck external handle is bounded by the application shutdown deadline. Its deliberate crash/hang routes exist only in the disposable conformance consumer. It cleans only its isolated Compose project and output. The proof does not certify throughput, every restart sequence, host failure or cloud infrastructure.
