/** Views/deployment/workload are declared intent, never measured or provisioned capacity. */
import type { DesignDocument } from "./design.ts";
import type { LayoutDocument } from "./layout.ts";
import { vendureCoreScenarios } from "./vendure-core-scenarios.ts";
export function vendureCoreJourneys(result: {
  name: string;
  design: DesignDocument;
  layout: LayoutDocument;
}) {
  const a = result.design.architecture!;
  a.scenarios = structuredClone(vendureCoreScenarios);
  a.decisions!.push({
    id: "vc-design-gate",
    name: "P72 complete design; runtime unavailable",
    context:
      "P60b Vendure v3.3.0/a4c56359ec831b0c54dd01eab14fb75455c43ab7. Frozen20 rows/63 observations, eight independent H signatures, five expected scenarios.",
    decision:
      "REST/JSON adaptation excludes GraphQL parity. Exact finite command and recovery descriptors resolve design obligations only. No application runtime, generated scaffold, migration, live provider, capacity measurement or observed implementation points. All applications absent/not run.",
    status: "Accepted",
    consequence:
      "P72a protected definitions and physical storage identities remain; v2 API/aggregate successors are explicit. Full/backend foundation support stays blocked.",
    links: [{ kind: "system", id: "system" }],
    acknowledgements: [],
  });
  a.decisions!.push({
    id: "vc-workload",
    name: "V-core unmeasured objective",
    context:
      "50000 products/200000 variants/100000 historical orders; proposed8CPU/16GiB/localSSD.",
    decision:
      "Offer20 requests/s for600s after warm-up:70% reads,20% cart commands,10% checkout/reference payment. Readp95<=500ms, local commandp95<=1000ms, zero stock/total invariant violations. Record achieved rates, failures, queue growth, DB limits and actual host for one and two APIs; targets unmeasured.",
    status: "Accepted",
    consequence: "Declared objective does not establish responsiveness or runtime evidence.",
    links: [{ kind: "system", id: "system" }],
    acknowledgements: [],
  });
  a.deployments = [1, 2].map((count) => ({
    id: `vc-local-${count}-api`,
    name: `Declared local ${count} API / one worker`,
    kind: "Private",
    description:
      "Loopback-only future Docker Compose target; no provisioning, health or failover observation.",
    nodes: [
      {
        id: `vc-local-host-${count}`,
        name: "Local engineering host",
        kind: "deployment",
        replicas: 1,
        technology: "Docker Compose · proposed",
        region: "Local",
        zone: "Local",
        responsibility: "8CPU/16GiB reference budget, record actual resources",
        operation: "Self operated",
        mappingReason: "One host, independent application credentials/output/database",
      },
    ],
    instances: [
      {
        id: `vc-api-instance-${count}`,
        element: "vc-api",
        node: `vc-local-host-${count}`,
        replicas: count,
      },
      {
        id: `vc-worker-instance-${count}`,
        element: "vc-worker",
        node: `vc-local-host-${count}`,
        replicas: 1,
      },
      {
        id: `vc-db-instance-${count}`,
        element: "vc-db",
        node: `vc-local-host-${count}`,
        replicas: 1,
      },
    ],
    externals: [],
    interactions: [],
  }));
  result.layout.architecture = {
    "vc-checkout": {
      name: "Checkout & last-item",
      members: ["container:vc-client", "container:vc-api", "container:vc-db"],
      includeDependencies: false,
      positions: {},
    },
    "vc-uncertainty": {
      name: "Unknown payment & reconciliation",
      members: [
        "container:vc-api",
        "container:vc-worker",
        "container:vc-db",
        "container:vc-payment",
      ],
      includeDependencies: false,
      positions: {},
    },
    "vc-fulfillment": {
      name: "Fulfillment & notifications",
      members: [
        "container:vc-api",
        "container:vc-worker",
        "container:vc-db",
        "container:vc-email",
        "container:vc-files",
      ],
      includeDependencies: false,
      positions: {},
    },
  };
}
