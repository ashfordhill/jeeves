import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  applyOperations,
  buildSupportedAuthoringCommand,
  type DesignDocument,
  resolveGeneration,
  type StudioCommand,
} from "@jeeves/spec";
import { afterAll, describe, expect, it } from "vitest";
import { withStubWorkloads } from "../../../field-projects/generator-system/fixtures/rg-workload/design.ts";
import { stubStackDesign } from "../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import {
  runStudioCommands,
  v2ModuleDesign,
} from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";
import { stubStores } from "./local-contract.ts";

const registry = loadLocalV2Registry();
const on: StudioCommand = { type: "setRunnableProcesses", on: true };
/** A queue's Provider changed as the Options form and chat change it: the supported command. */
function provider(design: DesignDocument, queue: string, value: string) {
  const settings = design.architecture?.studio?.elements.find((row) => row.element === queue)
    ?.settings as Record<string, unknown>;
  const batch = buildSupportedAuthoringCommand(
    design,
    { type: "edit", element: queue, settings: { ...settings, provider: value } } as StudioCommand,
    registry.installed,
  );
  const result = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
}
const exported = (design: DesignDocument) =>
  assembleV2({ designJson: canonicalJson(design) }, registry);
type Bundle = ReturnType<typeof exported>;
const bytes = (bundle: Bundle, path: string) =>
  bundle.files.find((file) => file.path === path)?.bytes;
const text = (bundle: Bundle, path: string) => new TextDecoder().decode(bytes(bundle, path));
const json = (bundle: Bundle, path: string) => JSON.parse(text(bundle, path));
const asset = (path: string) =>
  readFileSync(new URL(`../../templates/local-v2/assets/${path}`, import.meta.url));

// The stub stack with Runnable processes on: Visits (a topic Visit publisher publishes to and Visit
// consumer consumes) set to Google Cloud; Uploaded stays on RabbitMQ.
const rabbit = runStudioCommands(withStubWorkloads(stubStackDesign()), [on]);
const cloud = provider(rabbit, "visits", "google-cloud");
const rabbitExport = exported(rabbit);
const cloudExport = exported(cloud);
const pubsubImage =
  "gcr.io/google.com/cloudsdktool/google-cloud-cli:591.0.0-emulators@sha256:112c21f8f6e04b03b393b3c34fb943a1f443e839f18c6492c364ac2e6c3ff935";

describe("Pub/Sub channels for stubs (QG07)", () => {
  it("runs the emulator, creates the topic and the consuming loop stub's subscription in setup, and gives the publisher its project", () => {
    const compose = json(cloudExport, "compose.yaml");
    expect(compose.services["local-pubsub"]).toEqual({
      image: pubsubImage,
      command: [
        "gcloud",
        "beta",
        "emulators",
        "pubsub",
        "start",
        "--host-port=0.0.0.0:8085",
        "--project=local",
      ],
      healthcheck: {
        test: ["CMD", "curl", "-fsS", "-o", "/dev/null", "http://127.0.0.1:8085/"],
        interval: "5s",
        timeout: "5s",
        retries: 30,
        start_period: "20s",
      },
    });
    expect(compose.services["setup-pubsub"]).toEqual({
      image: `\${COMPOSE_PROJECT_NAME:?Set COMPOSE_PROJECT_NAME}-app`,
      build: { context: ".", target: "app" },
      init: true,
      profiles: ["setup"],
      command: ["node", "scripts/pubsub-init.mjs"],
      environment: {
        LOCAL_HTTP_PORT: `\${LOCAL_HTTP_PORT:?Set LOCAL_HTTP_PORT}`,
        JEEVES_PUBSUB_PROJECT: "local",
        PUBSUB_EMULATOR_HOST: "local-pubsub:8085",
      },
    });
    // The publisher reads its project; only the local environment points it at the emulator.
    const links = compose.services["app-links-api"];
    expect(links.environment).toMatchObject({
      JEEVES_PUBSUB_PROJECT: "local",
      PUBSUB_EMULATOR_HOST: "local-pubsub:8085",
    });
    expect(links.depends_on["local-pubsub"]).toEqual({ condition: "service_healthy" });
    expect(links.environment).toMatchObject({ JEEVES_BROKER_HOST: "local-broker" });
    // The consuming tile's loop reads the project too (QG08), and no longer the broker.
    const worker = compose.services["app-visit-worker"];
    expect(worker.depends_on["local-pubsub"]).toEqual({ condition: "service_healthy" });
    expect(worker.environment).toMatchObject({
      JEEVES_PUBSUB_PROJECT: "local",
      PUBSUB_EMULATOR_HOST: "local-pubsub:8085",
    });
    expect(Object.keys(worker.environment)).not.toContain("JEEVES_BROKER_HOST");
    expect(worker.depends_on).not.toHaveProperty("local-broker");
    expect(worker.secrets ?? []).not.toContain("broker-password");
    expect(compose.services["local-broker"]).toBeDefined();
    expect(compose.secrets).not.toHaveProperty("pubsub");

    const plan = json(cloudExport, "infra/local.json");
    expect(plan.pubsub).toEqual({
      topics: ["visits", "visits--visit-worker--visit-consumer.failed"],
      subscriptions: [
        {
          name: "visits--visit-worker--visit-consumer",
          topic: "visits",
          ackDeadlineSeconds: 60,
          retryPolicy: { minimumBackoffSeconds: 1, maximumBackoffSeconds: 10 },
          deadLetterPolicy: {
            deadLetterTopic: "visits--visit-worker--visit-consumer.failed",
            maxDeliveryAttempts: 100,
          },
        },
        {
          name: "visits--visit-worker--visit-consumer.failed",
          topic: "visits--visit-worker--visit-consumer.failed",
        },
      ],
    });
    expect(plan.broker).toEqual([{ resource: "uploaded", queues: ["uploaded"] }]);
    expect(plan.providers).toContain("local-pubsub");
    expect(plan.resources.find((row: { id: string }) => row.id === "visits")).toMatchObject({
      kind: "pubsub",
      users: [
        { host: "links-api", channel: "publish", authorized: true },
        { host: "visit-worker", channel: "consume", authorized: true },
      ],
    });
    expect(bytes(cloudExport, "scripts/pubsub-init.mjs")).toEqual(
      new Uint8Array(asset("scripts/pubsub-init.mjs")),
    );
    // setup-pubsub runs at every first-run and start, after the providers and before the processes.
    const local = text(cloudExport, "scripts/local.mjs");
    const setup = local.indexOf(
      'for (const name of ["setup-broker", "setup-pubsub", "setup-search"])',
    );
    expect(local).toContain('  "setup-pubsub",\n');
    expect(setup).toBeGreaterThan(local.indexOf('step("providers"'));
    expect(setup).toBeLessThan(local.indexOf('step("application"'));
  });

  it("publishes through pubsubPublisher, reports the topic and its subscription, and consumes it with no gap", () => {
    const process = text(cloudExport, "src/processes/links-api.ts");
    expect(process).toContain(
      '    "visits": await pubsubPublisher(scope, probe, { topic: "visits" }),\n',
    );
    expect(process).toMatch(
      /import \{[^}]*\bpubsubPublisher\b[^}]*\} from "\.\.\/runtime\/module-clients\.ts";/,
    );
    const clients = text(cloudExport, "src/runtime/module-clients.ts");
    expect(clients).toContain('import { PubSub } from "@google-cloud/pubsub";\n');
    expect(clients).toContain("export async function pubsubPublisher(");
    expect(clients).not.toContain("// @pubsub");
    // RabbitMQ's publisher stays for Uploaded.
    expect(clients).toContain("export async function queuePublisher(");

    const report = json(cloudExport, ".jeeves/report.json");
    const stores = (tile: string) =>
      report.processes.tiles.find((row: { tile: string }) => row.tile === tile).stores;
    expect(stores("links-api").find((row: { store: string }) => row.store === "visits")).toEqual({
      store: "visits",
      name: "Visits",
      kind: "queue",
      access: "publish",
      modules: ["visit-publisher"],
      provisioned: "Google Cloud Pub/Sub topic visits (locally the emulator local-pubsub)",
    });
    expect(stores("visit-worker").find((row: { store: string }) => row.store === "visits")).toEqual(
      {
        store: "visits",
        name: "Visits",
        kind: "queue",
        access: "consume",
        modules: ["visit-consumer"],
        provisioned:
          "Google Cloud Pub/Sub subscription visits--visit-worker--visit-consumer on topic visits, with dead-letter topic visits--visit-worker--visit-consumer.failed and its subscription (locally the emulator local-pubsub)",
      },
    );
    expect(
      report.processes.tiles.find((row: { tile: string }) => row.tile === "links-api").environment,
    ).toEqual(expect.arrayContaining(["JEEVES_PUBSUB_PROJECT", "PUBSUB_EMULATOR_HOST"]));
    // A loop stub on a Pub/Sub topic consumes its own subscription (QG08, QG28): no gap, runnable.
    expect(report.gaps.filter((gap: { id: string }) => gap.id.startsWith("provider-"))).toEqual([]);
    expect(report.processes.runnable).toBe(true);
    expect(
      report.processes.tiles.find((row: { tile: string }) => row.tile === "visit-worker").loops,
    ).toEqual([
      {
        queue: "visits--visit-worker--visit-consumer",
        module: "visit-consumer",
        answers:
          '"Not implemented: Visit consumer" sends the message to visits--visit-worker--visit-consumer.failed (NOT_IMPLEMENTED) until it is written; other errors retry 5 times',
      },
    ]);
    expect(
      report.settings.find(
        (row: { input: string; value: unknown }) =>
          row.input === "queue.provider" && row.value === "google-cloud",
      ),
    ).toMatchObject({ status: "supported", implementationStatus: "implemented" });

    const readme = text(cloudExport, "README.md");
    expect(readme).toContain("**Google Cloud Pub/Sub.** A queue only stubs use");
    expect(readme).toContain("`pubsub.topics.get` and `pubsub.topics.publish`");
    expect(readme).toContain("The emulator keeps nothing across a restart");
    expect(readme).toContain("reads `JEEVES_PUBSUB_PROJECT`");
    expect(readme).toContain(
      "A loop stub on a topic consumes its own subscription through the official client (`pubsubLoop`",
    );
    expect(readme).toContain("`pubsub.subscriptions.get` and `pubsub.subscriptions.consume`");
    expect(readme).not.toContain("isn't installed yet");
  });

  it("runs a loop stub on a Pub/Sub topic on its own subscription through pubsubLoop (QG08)", () => {
    const worker = text(cloudExport, "src/processes/visit-worker.ts");
    expect(worker).toContain(
      [
        "  // Visit consumer: a loop on the Pub/Sub subscription visits--visit-worker--visit-consumer.",
        "  await startModuleLoop(scope, loopLog, config.loops[0], (message) =>",
        '    visitConsumer(dependencies["visit-consumer"], message),',
        '    brokerState(config.tile, failure, "broker consume visits--visit-worker--visit-consumer"),',
        "    pubsubLoop(probe),",
        "  );",
        "  scope.ready();",
      ].join("\n"),
    );
    expect(worker).toContain('"queue": "visits--visit-worker--visit-consumer",\n');
    expect(worker).toContain('"failedQueue": "visits--visit-worker--visit-consumer.failed",\n');
    expect(worker).toMatch(
      /import \{[^}]*\bpubsubLoop\b[^}]*\} from "\.\.\/runtime\/module-clients\.ts";/,
    );
    expect(worker).not.toContain("brokerBinding");
    // The probe log its subscription's check writes to comes before the loop.
    expect(worker.indexOf("const probe = createProbeLog(config.tile);")).toBeLessThan(
      worker.indexOf("pubsubLoop(probe)"),
    );
    // Its subscription and dead-letter topic are the ones setup-pubsub creates.
    const plan = json(cloudExport, "infra/local.json");
    expect(plan.pubsub.subscriptions[0]).toMatchObject({
      name: "visits--visit-worker--visit-consumer",
      deadLetterPolicy: { deadLetterTopic: "visits--visit-worker--visit-consumer.failed" },
    });
    // RabbitMQ's loop stays on the broker for Uploaded.
    const links = text(cloudExport, "src/processes/links-api.ts");
    expect(links).toContain("  // Upload consumer: a loop on uploaded.\n");
    expect(links).toContain("    brokerBinding(),\n");
    expect(links).not.toContain("pubsubLoop");
    const clients = text(cloudExport, "src/runtime/module-clients.ts");
    expect(clients).toContain("export function pubsubLoop(log: ProbeLog): LoopTransport {");
    expect(clients).toContain(
      'import { UNREACHABLE_WAIT_MS, validateDeliveryBinding, createConsumerProgress, type Delivery } from "./delivery.ts";',
    );
    expect(clients).not.toContain("// @");
    // A publisher-only Pub/Sub export has no subscriber.
    const publisherOnly = exported(
      runStudioCommands(cloud, [{ type: "disconnectModule", link: "visit-consumer-visits" }]),
    );
    expect(text(publisherOnly, "src/runtime/module-clients.ts")).not.toContain("pubsubLoop");
    expect(text(publisherOnly, "src/runtime/module-clients.ts")).toContain("pubsubPublisher");
  });

  it("needs no broker for a design whose only channels are Pub/Sub topics, its loops included (QG08)", () => {
    const only = exported(provider(cloud, "uploaded", "google-cloud"));
    const services = json(only, "compose.yaml").services;
    for (const name of Object.keys(services).filter((item) => item.startsWith("app-")))
      expect(Object.keys(services[name].environment ?? {}), name).not.toContain(
        "JEEVES_BROKER_HOST",
      );
    const links = text(only, "src/processes/links-api.ts");
    expect(links).toContain(
      "  // Upload consumer: a loop on the Pub/Sub subscription uploaded--links-api--upload-consumer.\n",
    );
    expect(links).not.toContain("brokerBinding");
    expect(services["app-links-api"].environment).toMatchObject({ JEEVES_PUBSUB_PROJECT: "local" });
    const report = json(only, ".jeeves/report.json");
    expect(report.gaps.filter((gap: { id: string }) => gap.id.startsWith("provider-"))).toEqual([]);
    expect(report.processes.runnable).toBe(true);
    expect(text(only, "src/runtime/module-clients.ts")).not.toContain("brokerBinding");
  });

  it("leaves a RabbitMQ design without Pub/Sub, and a design with only Pub/Sub channels without a broker", () => {
    const compose = json(rabbitExport, "compose.yaml");
    expect(compose.services["local-pubsub"]).toBeUndefined();
    expect(compose.services["setup-pubsub"]).toBeUndefined();
    expect(json(rabbitExport, "infra/local.json")).not.toHaveProperty("pubsub");
    expect(bytes(rabbitExport, "scripts/pubsub-init.mjs")).toBeUndefined();
    expect(text(rabbitExport, "src/runtime/module-clients.ts")).not.toContain("pubsub");
    expect(text(rabbitExport, "README.md")).not.toContain("Pub/Sub");

    const only = exported(provider(cloud, "uploaded", "google-cloud"));
    const services = json(only, "compose.yaml").services;
    expect(services["local-broker"]).toBeUndefined();
    expect(services["setup-broker"]).toBeUndefined();
    expect(services["local-pubsub"]).toBeDefined();
    const plan = json(only, "infra/local.json");
    expect(plan.broker).toEqual([]);
    expect(plan.secrets).not.toContain("broker-password");
    expect(plan.pubsub.topics).toEqual([
      "uploaded",
      "uploaded--links-api--upload-consumer.failed",
      "visits",
      "visits--visit-worker--visit-consumer.failed",
    ]);
    // Both publishers are Pub/Sub ones; no RabbitMQ publisher is emitted.
    const clients = text(only, "src/runtime/module-clients.ts");
    expect(clients).not.toContain("createPublisher");
    expect(text(only, "src/processes/upload-api.ts")).toContain(
      '"uploaded": await pubsubPublisher(scope, probe, { topic: "uploaded" }),',
    );
  });

  it("makes a publisher-only Pub/Sub design runnable, with no subscription to create", () => {
    const design = runStudioCommands(cloud, [
      { type: "disconnectModule", link: "visit-consumer-visits" },
    ]);
    const report = json(exported(design), ".jeeves/report.json");
    expect(report.gaps.filter((gap: { id: string }) => gap.id.startsWith("provider-"))).toEqual([]);
    expect(report.processes.runnable).toBe(true);
    expect(json(exported(design), "infra/local.json").pubsub).toEqual({
      topics: ["visits"],
      subscriptions: [],
    });
  });

  it("gives each loop stub of a tile its own subscription, in either mode (QG28)", () => {
    // A second loop stub on Visit worker, consuming Visits beside Visit consumer.
    const twoLoops = runStudioCommands(cloud, [
      {
        type: "addModule",
        host: "visit-worker",
        kind: "event-consumer",
        id: "visit-auditor",
        name: "Visit auditor",
      },
      {
        type: "connectModule",
        module: "visit-auditor",
        slot: "channel",
        target: { tile: "visits" },
      },
    ]);
    const settings = {
      ackDeadlineSeconds: 60,
      retryPolicy: { minimumBackoffSeconds: 1, maximumBackoffSeconds: 10 },
    };
    const own = (module: string) => `visits--visit-worker--${module}`;
    // Visits saved as a work queue: Pub/Sub still gives each loop stub its own subscription.
    const saved = twoLoops.architecture?.studio?.elements.find((row) => row.element === "visits");
    const workQueue = runStudioCommands(twoLoops, [
      {
        type: "edit",
        element: "visits",
        settings: { ...saved?.settings, mode: "work-queue" },
      } as StudioCommand,
    ]);
    expect(
      workQueue.architecture?.studio?.elements.find((row) => row.element === "visits")?.settings,
    ).toEqual({ kind: "queue", mode: "work-queue", provider: "google-cloud" });
    for (const design of [twoLoops, workQueue]) {
      const bundle = exported(design);
      const plan = json(bundle, "infra/local.json");
      expect(plan.pubsub).toEqual({
        topics: ["visits", `${own("visit-auditor")}.failed`, `${own("visit-consumer")}.failed`],
        subscriptions: ["visit-auditor", "visit-consumer"].flatMap((module) => [
          {
            name: own(module),
            topic: "visits",
            ...settings,
            deadLetterPolicy: {
              deadLetterTopic: `${own(module)}.failed`,
              maxDeliveryAttempts: 100,
            },
          },
          { name: `${own(module)}.failed`, topic: `${own(module)}.failed` },
        ]),
      });
      // No subscription is the tile's.
      expect(JSON.stringify(plan.pubsub)).not.toMatch(/"visits--visit-worker(\.failed)?"/);
      // Each loop consumes its own subscription and sends terminal failures to its own .failed.
      const worker = text(bundle, "src/processes/visit-worker.ts");
      for (const module of ["visit-auditor", "visit-consumer"]) {
        expect(worker).toContain(`"queue": "${own(module)}",\n`);
        expect(worker).toContain(`"failedQueue": "${own(module)}.failed",\n`);
        expect(worker).toContain(`a loop on the Pub/Sub subscription ${own(module)}.\n`);
      }
      expect(worker.match(/pubsubLoop\(probe\)/g)).toHaveLength(2);
      const report = json(bundle, ".jeeves/report.json");
      const tile = report.processes.tiles.find(
        (row: { tile: string }) => row.tile === "visit-worker",
      );
      expect(tile.stores.find((row: { store: string }) => row.store === "visits")).toEqual({
        store: "visits",
        name: "Visits",
        kind: "queue",
        access: "consume",
        modules: expect.arrayContaining(["visit-auditor", "visit-consumer"]),
        provisioned: `Google Cloud Pub/Sub subscriptions ${own("visit-auditor")}, ${own("visit-consumer")} on topic visits, one per consuming module, each with its dead-letter topic <subscription>.failed and its subscription (locally the emulator local-pubsub)`,
      });
      expect(
        tile.loops.map((row: { queue: string; module: string }) => [row.module, row.queue]).sort(),
      ).toEqual([
        ["visit-auditor", own("visit-auditor")],
        ["visit-consumer", own("visit-consumer")],
      ]);
      expect(report.processes.runnable).toBe(true);
    }
  });

  it("keeps a stub's link to a template's queue on its provider gap, never Pub/Sub", () => {
    // View events: Watch views (a stub) publishes and the event counter template consumes; its
    // Provider has no control, so this is a saved value from outside the studio's commands.
    const design = runStudioCommands(runStudioCommands(v2ModuleDesign(), [on]), [
      {
        type: "edit",
        element: "view-events",
        settings: { kind: "queue", mode: "topic", provider: "google-cloud" },
      },
    ]);
    const model = resolveGeneration(design, registry.installed).model;
    const watch = model?.processes?.find((row) => row.tile === "watch");
    if (!model || !watch) throw new Error("No Watch process");
    const plan = stubStores(watch, model.selections);
    expect(plan.stores.find((store) => store.element === "view-events")).toMatchObject({
      kind: "queue",
      access: "publish",
      unsupported:
        "View events uses the google-cloud provider; a stub's queue is provisioned locally only when its provider is unspecified or self-hosted.",
    });
    expect(plan.stores.some((store) => store.pubsub)).toBe(false);
    expect(plan.gaps).toEqual([
      expect.objectContaining({
        id: "provider-watch-views-view-events",
        required: true,
        status: "unsupported",
      }),
    ]);
  });
});

/** The gRPC channel options QG09 gives every Pub/Sub client. */
const reconnectBound = {
  "grpc.initial_reconnect_backoff_ms": 500,
  "grpc.max_reconnect_backoff_ms": 2000,
};

describe("Installs, the metadata lookup and the reconnect bound (QG09)", () => {
  it("gives every export its own pnpm-workspace.yaml, so a plain install skips protobufjs's install script, and says so (F1)", () => {
    // Processes off (a pinned export), RabbitMQ only, and with a Pub/Sub topic.
    for (const bundle of [exported(v2ModuleDesign()), rabbitExport, cloudExport]) {
      expect(
        bundle.manifest.files.find((row) => row.path === "pnpm-workspace.yaml")?.ownership,
      ).toBe("generated-extension");
      expect(bytes(bundle, "pnpm-workspace.yaml")).toEqual(
        new Uint8Array(asset("pnpm-workspace.yaml")),
      );
      // Its one setting: protobufjs's install script doesn't run.
      expect(
        text(bundle, "pnpm-workspace.yaml")
          .split("\n")
          .filter((line) => line !== "" && !line.startsWith("#")),
      ).toEqual(["allowBuilds:", "  protobufjs: false"]);
      const readme = text(bundle, "README.md");
      expect(readme).toContain("Run `pnpm install --frozen-lockfile` then `pnpm build`.");
      expect(readme).toContain(
        "`pnpm-workspace.yaml`'s `allowBuilds` says which packages' install scripts run: the template's dependencies run none (`protobufjs: false`), so neither command needs `--ignore-scripts`.",
      );
      expect(readme).not.toContain("pnpm install --frozen-lockfile --ignore-scripts");
      // The image still installs exactly the lock, running no install script.
      expect(text(bundle, "Dockerfile")).toContain(
        "COPY package.json pnpm-lock.yaml ./\nRUN pnpm install --frozen-lockfile --ignore-scripts\n",
      );
    }
  });

  it("tells each service that publishes to or consumes a Pub/Sub topic to look for no metadata server, only locally (F2)", () => {
    const services = json(cloudExport, "compose.yaml").services as Record<
      string,
      { environment?: Record<string, string> }
    >;
    const told = Object.keys(services).filter(
      (name) => services[name]?.environment?.METADATA_SERVER_DETECTION !== undefined,
    );
    // Links API publishes to Visits and Visit worker consumes it; setup-pubsub is neither.
    expect(told).toEqual(["app-links-api", "app-visit-worker"]);
    for (const name of told)
      expect(services[name]?.environment).toMatchObject({
        METADATA_SERVER_DETECTION: "none",
        JEEVES_PUBSUB_PROJECT: "local",
        PUBSUB_EMULATOR_HOST: "local-pubsub:8085",
      });
    const rabbitServices = json(rabbitExport, "compose.yaml").services as Record<
      string,
      { environment?: Record<string, string> }
    >;
    expect(
      Object.values(rabbitServices).some(
        (service) => service.environment?.METADATA_SERVER_DETECTION !== undefined,
      ),
    ).toBe(false);
    // The report lists it with what each of those processes reads; the README says a deployment
    // leaves it unset.
    const report = json(cloudExport, ".jeeves/report.json");
    for (const tile of ["links-api", "visit-worker"])
      expect(
        report.processes.tiles.find((row: { tile: string }) => row.tile === tile).environment,
      ).toContain("METADATA_SERVER_DETECTION");
    expect(text(cloudExport, "README.md")).toContain(
      "`compose.yaml` also sets `PUBSUB_EMULATOR_HOST` for the local emulator and `METADATA_SERVER_DETECTION: none`, so the client looks for no Google metadata server; a deployment leaves both unset.",
    );
    // No universe domain: it would take the client out of emulator mode.
    expect(text(cloudExport, "src/runtime/module-clients.ts")).not.toContain("universeDomain");
  });

  it("builds every Pub/Sub client in the export with the reconnect bound, 500 ms doubling to at most 2000 ms (F3)", () => {
    const clients = text(cloudExport, "src/runtime/module-clients.ts");
    expect(clients).toContain(
      [
        "const pubsubChannel = {",
        '  "grpc.initial_reconnect_backoff_ms": 500,',
        '  "grpc.max_reconnect_backoff_ms": 2000,',
        "};",
      ].join("\n"),
    );
    // The publisher's client and the loop's: each `new PubSub(` spreads the bound in. Its project
    // comes through `pubsubProjectId` (QG31), which reads `JEEVES_PUBSUB_PROJECT`.
    const built = clients.split("new PubSub(").slice(1);
    expect(built).toHaveLength(2);
    for (const call of built)
      expect(call.slice(0, call.indexOf("});"))).toBe(
        "{\n    projectId: pubsubProjectId(),\n    ...pubsubChannel,\n  ",
      );
    expect(clients).toContain('  return endpoint("JEEVES_PUBSUB_PROJECT", pubsubProject);\n');
    const init = text(cloudExport, "scripts/pubsub-init.mjs");
    expect(init.split("new PubSub(")).toHaveLength(2);
    expect(init).toContain(
      'new PubSub({\n  projectId,\n  "grpc.initial_reconnect_backoff_ms": 500,\n  "grpc.max_reconnect_backoff_ms": 2000,\n});',
    );
  });
});

// The emitted setup script, run by Node against a fake `@google-cloud/pubsub` that keeps the
// emulator's state in a file and reports it as the emulator does (durations as strings).
const fakeClient = `import { readFileSync, writeFileSync } from "node:fs";
const path = process.env.FAKE_PUBSUB_STATE;
const load = () => JSON.parse(readFileSync(path, "utf8"));
const save = (state) => writeFileSync(path, JSON.stringify(state));
const call = (...args) => { const state = load(); state.calls.push(args); save(state); };
const exists = () => Object.assign(new Error("6 ALREADY_EXISTS"), { code: 6 });
const duration = (value) => ({ seconds: String(value.seconds), nanos: 0 });
export class PubSub {
  constructor(options) { this.project = options.projectId; call("PubSub", options); }
  name(id) { return "projects/" + this.project + "/topics/" + id; }
  topic(id) {
    return {
      exists: async () => [load().topics.includes(this.name(id))],
      createSubscription: async (name, options) => {
        call("createSubscription", id, name, options);
        const state = load();
        if (state.subscriptions[name]) throw exists();
        state.subscriptions[name] = {
          topic: this.name(id),
          ackDeadlineSeconds: options.ackDeadlineSeconds ?? 10,
          retryPolicy: options.retryPolicy ? { minimumBackoff: duration(options.retryPolicy.minimumBackoff), maximumBackoff: duration(options.retryPolicy.maximumBackoff) } : null,
          deadLetterPolicy: options.deadLetterPolicy ?? null,
        };
        save(state);
      },
    };
  }
  async createTopic(id) {
    call("createTopic", id);
    const state = load();
    if (state.topics.includes(this.name(id))) throw exists();
    state.topics.push(this.name(id));
    save(state);
  }
  subscription(name) {
    return {
      exists: async () => [!!load().subscriptions[name]],
      getMetadata: async () => [load().subscriptions[name]],
    };
  }
  async close() { call("close"); }
}
`;
const scratch = mkdtempSync(join(tmpdir(), "jeeves-pubsub-init-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
function install(bundle: Bundle) {
  for (const path of ["infra/local.json", "scripts/common.mjs", "scripts/pubsub-init.mjs"]) {
    mkdirSync(dirname(join(scratch, path)), { recursive: true });
    writeFileSync(join(scratch, path), bytes(bundle, path) ?? "");
  }
  const sdk = join(scratch, "node_modules/@google-cloud/pubsub");
  mkdirSync(sdk, { recursive: true });
  writeFileSync(
    join(sdk, "package.json"),
    JSON.stringify({ name: "@google-cloud/pubsub", type: "module", exports: "./index.js" }),
  );
  writeFileSync(join(sdk, "index.js"), fakeClient);
  writeFileSync(
    join(scratch, "state.json"),
    JSON.stringify({ topics: [], subscriptions: {}, calls: [] }),
  );
}
const state = () => JSON.parse(readFileSync(join(scratch, "state.json"), "utf8"));
function run(environment: Record<string, string> = { JEEVES_PUBSUB_PROJECT: "local" }) {
  try {
    const stdout = execFileSync(process.execPath, ["scripts/pubsub-init.mjs"], {
      cwd: scratch,
      env: {
        PATH: process.env.PATH ?? "",
        FAKE_PUBSUB_STATE: join(scratch, "state.json"),
        ...environment,
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const failed = error as { status: number; stdout: string; stderr: string };
    return { status: failed.status, stdout: failed.stdout, stderr: failed.stderr };
  }
}

describe("scripts/pubsub-init.mjs (QG07, locally only)", () => {
  it("creates each missing topic and subscription with the plan's settings, then creates nothing", () => {
    install(cloudExport);
    expect(run()).toMatchObject({
      status: 0,
      stdout:
        "Pub/Sub topics and subscriptions asserted (4 created); existing ones keep their messages.\n",
    });
    const created = state();
    expect(created.topics).toEqual([
      "projects/local/topics/visits",
      "projects/local/topics/visits--visit-worker--visit-consumer.failed",
    ]);
    expect(created.calls.filter(([name]: [string]) => name === "createSubscription")).toEqual([
      [
        "createSubscription",
        "visits",
        "visits--visit-worker--visit-consumer",
        {
          ackDeadlineSeconds: 60,
          retryPolicy: { minimumBackoff: { seconds: 1 }, maximumBackoff: { seconds: 10 } },
          deadLetterPolicy: {
            deadLetterTopic: "projects/local/topics/visits--visit-worker--visit-consumer.failed",
            maxDeliveryAttempts: 100,
          },
        },
      ],
      [
        "createSubscription",
        "visits--visit-worker--visit-consumer.failed",
        "visits--visit-worker--visit-consumer.failed",
        {},
      ],
    ]);
    expect(created.calls.at(-1)).toEqual(["close"]);
    // Every start runs it again: what exists with the same settings stays as it is.
    expect(run()).toMatchObject({ status: 0, stdout: expect.stringContaining("(0 created)") });
    expect(
      state()
        .calls.slice(created.calls.length)
        .map(([name]: [string]) => name),
    ).toEqual(["PubSub", "close"]);
  });

  it("stops at a subscription that exists with other settings, naming it, and changes nothing", () => {
    install(cloudExport);
    expect(run().status).toBe(0);
    for (const [change, setting] of [
      [
        (row: Record<string, unknown>) => Object.assign(row, { ackDeadlineSeconds: 30 }),
        "ackDeadlineSeconds",
      ],
      [(row: Record<string, unknown>) => Object.assign(row, { retryPolicy: null }), "retryPolicy"],
      [
        (row: Record<string, unknown>) =>
          Object.assign(row, {
            deadLetterPolicy: {
              deadLetterTopic: "projects/local/topics/other",
              maxDeliveryAttempts: 100,
            },
          }),
        "deadLetterPolicy",
      ],
      [
        (row: Record<string, unknown>) =>
          Object.assign(row, { topic: "projects/local/topics/other" }),
        "topic",
      ],
    ] as const) {
      const before = state();
      const original = structuredClone(
        before.subscriptions["visits--visit-worker--visit-consumer"],
      );
      change(before.subscriptions["visits--visit-worker--visit-consumer"]);
      writeFileSync(join(scratch, "state.json"), JSON.stringify(before));
      const result = run();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        `Pub/Sub subscription visits--visit-worker--visit-consumer exists with other settings (${setting}); remove it or keep the design's.`,
      );
      const after = state();
      expect(after.calls.slice(before.calls.length).map(([name]: [string]) => name)).toEqual([
        "PubSub",
        "close",
      ]);
      after.subscriptions["visits--visit-worker--visit-consumer"] = original;
      writeFileSync(join(scratch, "state.json"), JSON.stringify(after));
    }
    // The inspection subscription has no policy of its own.
    const before = state();
    before.subscriptions["visits--visit-worker--visit-consumer.failed"].retryPolicy = {
      minimumBackoff: { seconds: "1", nanos: 0 },
      maximumBackoff: { seconds: "10", nanos: 0 },
    };
    writeFileSync(join(scratch, "state.json"), JSON.stringify(before));
    expect(run().stderr).toContain(
      "Pub/Sub subscription visits--visit-worker--visit-consumer.failed exists with other settings (retryPolicy)",
    );
  });

  it("builds its client in the project with the reconnect bound (QG09, F3)", () => {
    install(cloudExport);
    expect(run().status).toBe(0);
    expect(state().calls[0]).toEqual(["PubSub", { projectId: "local", ...reconnectBound }]);
  });

  it("needs JEEVES_PUBSUB_PROJECT", () => {
    install(cloudExport);
    const result = run({});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Set JEEVES_PUBSUB_PROJECT.");
    expect(state().calls).toEqual([]);
  });
});
