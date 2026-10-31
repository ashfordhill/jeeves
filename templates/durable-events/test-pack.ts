import assert from "node:assert/strict";
import type { TestPack } from "@jeeves/template-kit";
export const testPack: TestPack = {
  template: "durable-events",
  checks: [
    {
      id: "delivery-readiness",
      title: "Durable event worker participates in service readiness",
      async run(ctx) {
        const { host, port } = await ctx
          .service(ctx.subject.element.id)
          .endpoint(Number(ctx.subject.element.config.port ?? 8080));
        const response = await fetch(`http://${host}:${port}/ready`);
        assert.equal(response.status, 200);
        const body = (await response.json()) as { dependencies: Record<string, { ok: boolean }> };
        assert.equal(body.dependencies["durable-events"]?.ok, true);
      },
    },
  ],
};
