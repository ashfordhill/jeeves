import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createHttpPool, HTTP_POOL_IMAGE } from "@jeeves/http-pool";
import { type Element, localExecutionFor, localHttpPoolFor } from "@jeeves/spec";
import type { TemplateModule, TestPack } from "@jeeves/template-kit";
import manifest from "./manifest.ts";

export const POOL_ARCHIVE_SHA256 =
  "f04ce4ade417f95aff87b89d73b02b096e731e411b7f1c2beac0234d6e17eaa5";
export function poolDefinition(element: Element) {
  const releaseBytes = readFileSync(
    new URL("../../artifacts/http-pool/0.1.0/manifest.json", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(releaseBytes).digest("hex"),
    "b6019b0ec3ddb338d19e4d0838d5fad19b4d0ef68c7196564b4d15e786d6b1c4",
    "Pool release manifest changed under 0.1.0",
  );
  const release = JSON.parse(releaseBytes.toString("utf8"));
  const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
  assert.equal(release.sha256, POOL_ARCHIVE_SHA256, "Pool release manifest changed under 0.1.0");
  assert.equal(
    hash(
      readFileSync(new URL(`../../artifacts/http-pool/0.1.0/${release.archive}`, import.meta.url)),
    ),
    POOL_ARCHIVE_SHA256,
    "Pool archive changed",
  );
  // Generation consumes the same original source that produced the frozen compiled release.
  assert.equal(
    hash(readFileSync(new URL("../../packages/http-pool/src/index.ts", import.meta.url))),
    release.sourceHashes["src/index.ts"],
    "Pool definition source changed; release a new component/template version",
  );
  const pool = localHttpPoolFor(element);
  if (!pool) throw new Error("Local pool configuration is incomplete");
  return createHttpPool({ serviceId: element.id, port: pool.port, replicas: pool.replicas });
}
const testPack: TestPack = {
  template: "local-http-pool",
  checks: [
    {
      id: "pool-topology",
      title: "The logical API routes through the pinned pool to every bounded instance",
      async run(ctx) {
        const binding = localHttpPoolFor(ctx.subject.element);
        const execution = localExecutionFor(ctx.subject.element);
        assert.ok(binding && execution);
        const proxy = ctx.compose.services[ctx.subject.element.id];
        assert.equal(proxy?.image, HTTP_POOL_IMAGE);
        assert.equal(Number(proxy.cpus), 0.5);
        assert.equal(Number(proxy.mem_limit), 128 * 1024 * 1024);
        assert.equal(proxy.read_only, true);
        assert.equal(proxy.stop_signal, "SIGUSR1");
        for (const instance of binding.instances) {
          const service = ctx.compose.services[instance];
          assert.ok(service?.build);
          assert.equal(Number(service.cpus), execution.cpus);
          assert.equal(service.environment?.SHUTDOWN_TIMEOUT_MS, String(execution.shutdownMs));
          assert.equal(
            service.environment?.DATABASE_HOST,
            ctx.subject.design.connections.find(
              (c) => c.kind === "uses-database" && c.from.element === ctx.subject.element.id,
            )?.to.element,
          );
          const endpoint = await ctx.service(instance).endpoint(binding.port);
          assert.equal(
            (
              await fetch(`http://${endpoint.host}:${endpoint.port}/ready`, {
                signal: AbortSignal.timeout(10000),
              })
            ).status,
            200,
          );
        }
      },
    },
    {
      id: "pool-readiness",
      title: "The stable logical endpoint reports ready with available application instances",
      async run(ctx) {
        const binding = localHttpPoolFor(ctx.subject.element);
        assert.ok(binding);
        const endpoint = await ctx.service(ctx.subject.element.id).endpoint(binding.port);
        for (const path of ["/health", "/ready"])
          assert.equal(
            (
              await fetch(`http://${endpoint.host}:${endpoint.port}${path}`, {
                signal: AbortSignal.timeout(10000),
              })
            ).status,
            200,
          );
      },
    },
  ],
};
export const localHttpPoolTemplate: TemplateModule = {
  manifest,
  testPack,
  agentGuide:
    "Local pooling is fully generated for the closed owner-resource profile. Do not implement pool routing or edit generated configuration. Custom service source, handlers, dependencies, migrations or build configuration require removing the pool or a separately reviewed capability release. C4 remains one logical API. Saving/generating does not deploy it.",
  generate(ctx) {
    const pool = poolDefinition(ctx.element);
    return {
      files: [
        { path: pool.configurationPath, ownership: "generated", contents: pool.configuration },
        {
          path: `infrastructure/http-pools/${ctx.element.id}/pool.generated.json`,
          ownership: "generated",
          contents:
            JSON.stringify(
              { ...pool.descriptor, componentArchiveSha256: POOL_ARCHIVE_SHA256 },
              null,
              2,
            ) + "\n",
        },
        {
          path: `${ctx.dir}/POOL.generated.md`,
          ownership: "generated",
          contents: `# Local HTTP pool 0.1.0\n\nOne logical application, ${pool.descriptor.replicas} local instances. Clients continue using ${ctx.element.id}:${pool.descriptor.port}; the logical Compose service is the proxy. Instance loopback ports are local diagnostics. All instances use the same source, owned resources, Postgres store and public origin. Database connection budget: ${pool.descriptor.replicas * 5}, before other consumers and administration. Each instance uses the separately selected execution policy.\n\nOnly reviewed generated source is supported. Custom features, domain extensions, delivery workers, process/filesystem state, scripts, migrations or dependencies require a separately reviewed contract. Generation and verification check the supported source shape. Project files are never deleted to make pooling eligible.\n\nThe proxy disables retries and redispatch. A failed or ambiguous mutation can fail and is not replayed. Health-detection windows can lose requests. A single proxy and database remain failure points. No capacity, public ingress, trusted client-IP, global throttling, WebSocket/SSE or host-failover guarantee.\n\nSave changes the design; Generate writes files; container recreation applies them. Neither saves nor generation restart a running app. Removing the policy restores ordinary next-generation Compose and leaves old owned artifacts as reported orphans.\n`,
        },
      ],
      compose: {},
      runtimeDependencies: [],
    };
  },
};
