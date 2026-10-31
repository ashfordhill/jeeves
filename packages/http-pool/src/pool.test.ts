import { describe, expect, it } from "vitest";
import { createHttpPool, HTTP_POOL_IMAGE } from "./index.ts";

describe("local HTTP pool release boundary", () => {
  it("has deterministic finite definitions and retains the stable logical service port", () => {
    const pair = createHttpPool({ serviceId: "inventory" });
    expect(pair).toEqual(createHttpPool({ replicas: 2, port: 8080, serviceId: "inventory" }));
    expect(pair.descriptor.instances).toEqual(["inventory-instance-1", "inventory-instance-2"]);
    expect(pair.proxyCompose.ports).toEqual(["127.0.0.1::8080"]);
    expect(pair.proxyCompose.image).toBe(HTTP_POOL_IMAGE);
    expect(pair.descriptor.backendDatabasePoolMax * pair.descriptor.replicas).toBe(10);
    expect(
      createHttpPool({ serviceId: "orders", replicas: 3, port: 9090 }).descriptor.instances,
    ).toHaveLength(3);
  });
  it("rejects unsupported counts, privileged/invalid ports, configuration injection and unknown policy knobs", () => {
    for (const input of [
      { serviceId: "api", replicas: 1 },
      { serviceId: "api", replicas: 4 },
      { serviceId: "api", port: 80 },
      { serviceId: "api", port: 65536 },
      { serviceId: "api\n  server attacker remote:80" },
      { serviceId: "../escape" },
      { serviceId: "api", retries: 3 },
      { serviceId: "api", instances: ["remote.example"] },
    ])
      expect(() => createHttpPool(input as Parameters<typeof createHttpPool>[0])).toThrow();
  });
  it("fixes readiness, no replay, forwarding and finite local bounds without sticky state", () => {
    const pool = createHttpPool({ serviceId: "api" });
    expect(pool.configuration).toContain("retries 0\n  retry-on none\n  no option redispatch");
    expect(pool.configuration).toContain("http-check expect status 200");
    expect(pool.configuration).toContain("init-state fully-down");
    expect(pool.configuration).toContain("nbsrv(application_instances) lt 1");
    expect(pool.configuration).toContain("http-request del-header X-Forwarded-For");
    expect(pool.configuration).not.toMatch(/cookie |stick-table|option forwardfor/);
    expect(pool.proxyCompose.stop_signal).toBe("SIGUSR1");
    expect(pool.proxyCompose.stop_grace_period).toBe("35s");
    expect(pool.proxyCompose.read_only).toBe(true);
  });
});
