import assert from "node:assert/strict";
import { workspaceModel } from "@jeeves/spec";
import type { TestPack } from "@jeeves/template-kit";
import { withPage } from "@jeeves/template-kit/browser";
export const testPack: TestPack = {
  template: "resource-workspace",
  checks: [
    {
      id: "workspace-account-entry",
      title:
        "The generated workspace mounts its accessible account screen against its declared API",
      async run(ctx) {
        const subject = ctx.subject;
        const { binding } = workspaceModel(
          subject.design,
          subject.element.id,
          subject.attachment!.id,
        );
        const { host, port } = await ctx
          .service(subject.element.id)
          .endpoint(Number(subject.element.config.port ?? 5173));
        const origin = `http://${host}:${port}`;
        await withPage(async (page, problems) => {
          const probe = problems.expectHttp({
            scenario: "workspace initial signed-out session",
            method: "GET",
            url: `${origin}/_api/${binding.service}/auth/session`,
            resourceType: "fetch",
            status: 401,
          });
          await page.goto(origin, { waitUntil: "networkidle" });
          await page.getByRole("heading", { name: "Welcome back", exact: true }).waitFor();
          assert.equal(await page.getByRole("button", { name: "Sign in", exact: true }).count(), 1);
          assert.equal(await page.getByLabel("Email", { exact: true }).count(), 1);
          probe.finish();
          problems.assert("Generated resource workspace");
        });
      },
    },
  ],
};
