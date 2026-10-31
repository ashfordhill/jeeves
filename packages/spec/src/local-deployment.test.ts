import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { designSchema } from "./design.ts";
import { finding } from "./findings.ts";
import { localDeploymentView } from "./local-deployment.ts";

const starter = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../starters/resource-workspace/0.1.0/design.json", import.meta.url),
        "utf8",
      ),
    ),
  );
const pooled = (replicas: 2 | 3) => {
  const design = starter(),
    api = design.elements[0]!;
  api.template!.version = "0.4.0";
  api.attachments.push(
    {
      id: "execution",
      template: { id: "local-execution", version: "0.1.0" },
      config: { preset: "balanced" },
      notes: "",
    },
    {
      id: "pool",
      template: { id: "local-http-pool", version: "0.1.0" },
      config: { replicas },
      notes: "",
    },
  );
  return design;
};
it("keeps legacy hints and context intent separate from actual declared instances and wiring without mutating the design", () => {
  const design = starter();
  design.elements[0]!.config.replicas = 4;
  const original = structuredClone(design),
    view = localDeploymentView(design, "inventory")!;
  expect(view.instances).toEqual(["inventory"]);
  expect(view.legacyReplicaHint).toBe(4);
  expect(view.proxy).toBeUndefined();
  expect(view.apiBudget).toBeUndefined();
  expect(view.callers.map((p) => p.id)).toEqual(["inventory-web"]);
  expect(view.stores.map((p) => [p.id, p.connection])).toEqual([
    ["inventory-db", "inventory-store"],
  ]);
  expect(view.callers).toHaveLength(1); // The context's person is not a runtime caller service.
  expect(localDeploymentView(design, "inventory-web")).toBeUndefined();
  expect(design).toEqual(original);
});
it("shows the actual pair/trio instance identities and scoped policy budgets while retaining one logical API", () => {
  for (const replicas of [2, 3] as const) {
    const view = localDeploymentView(pooled(replicas), "inventory")!;
    expect(view.issues).toEqual([]);
    expect(view.id).toBe("inventory");
    expect(view.instances).toEqual([
      "inventory-instance-1",
      "inventory-instance-2",
      ...(replicas === 3 ? ["inventory-instance-3"] : []),
    ]);
    expect(view.apiBudget).toEqual({
      cpus: replicas,
      memoryMiB: replicas * 768,
      pids: replicas * 192,
    });
    expect(view.databaseConnections).toBe(replicas * 5);
    expect(view.proxy).toMatchObject({ proxyRetries: 0, proxy: { cpus: 0.5, memoryMiB: 128 } });
  }
});
it("does not turn incomplete or unsupported policy into a plausible deployment", () => {
  const missing = pooled(3);
  missing.elements[0]!.attachments = missing.elements[0]!.attachments.filter(
    (a) => a.id !== "execution",
  );
  const unknown = pooled(3);
  unknown.elements[0]!.attachments.find((a) => a.id === "pool")!.template.version = "9.0.0";
  for (const design of [missing, unknown]) {
    const view = localDeploymentView(design, "inventory")!;
    expect(view.issues.length).toBeGreaterThan(0);
    expect(view.instances).toEqual([]);
    expect(view.proxy).toBeUndefined();
    expect(view.apiBudget).toBeUndefined();
  }
  const blocked = localDeploymentView(pooled(2), "inventory", [
    finding("CONFIG_REQUIRED", "Review the selected store", { connection: "inventory-store" }),
  ])!;
  expect(blocked.issues).toContain("Review the selected store");
  expect(blocked.instances).toEqual([]);
});
