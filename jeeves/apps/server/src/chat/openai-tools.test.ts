/** Real tool schemas + mocked Responses transport + the authoritative Workspace command path. */
import { createOpenAIProvider, type ModelItem, toOpenAIInput } from "@jeeves/providers";
import {
  buildOperationsCommand,
  buildOwnershipCommand,
  createLinkOperation,
  designBlueprintV3,
  emptyDesign,
  operationContractsSchema,
  ownershipSchema,
  positiveCachePolicy,
  studioArchitectureExample,
  tinyurlDesignScope,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import ownershipFixture from "../../../../packages/spec/src/fixtures/nc02-ownership-v1.json" with {
  type: "json",
};
import operationFixture from "../../../../packages/spec/src/fixtures/nc03-create-v1.json" with {
  type: "json",
};
import { toolDefinitions, Workspace } from "./tools.ts";

const tools = toolDefinitions();
const wire = (name: string, args: unknown) => {
  const [call] = toOpenAIInput(
    [{ type: "tool-call", callId: "c", name, arguments: JSON.stringify(args) }],
    tools,
  );
  if (call?.type !== "function_call") throw new Error("Expected a function call");
  return call.arguments;
};
type Call = { name: string; arguments: string };
function transport(rounds: Call[][]) {
  const requests: { tools: unknown[]; input: Record<string, unknown>[] }[] = [];
  const provider = createOpenAIProvider({
    apiKey: "sk-mocked",
    maxRetries: 0,
    fetch: async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      const calls = rounds[requests.length - 1] ?? [];
      const event = {
        type: "response.completed",
        response: {
          status: "completed",
          output: calls.map((call, i) => ({
            ...call,
            type: "function_call",
            call_id: `c-${requests.length}-${i}`,
          })),
        },
      };
      return new Response(`event: response.completed\ndata: ${JSON.stringify(event)}\n\n`, {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  return { provider, requests };
}
const request = (items: ModelItem[] = []) => ({ model: "mock", instructions: "", tools, items });

import { compatibleResolveDesign } from "../../../../packages/spec/src/fixtures/nc04-compatible.ts";
import resolveFixture from "../../../../packages/spec/src/fixtures/nc04-resolve-v1.json" with {
  type: "json",
};

const execute = (workspace: Workspace, calls: { name: string; arguments: string }[]) =>
  calls.map((call) => JSON.parse(workspace.run(call.name, call.arguments)));

describe("strict OpenAI studio tools", () => {
  it("round-trips the resolve union, null policy/connection and unknown exact policy through actual strict wire/history", async () => {
    const base = compatibleResolveDesign(),
      workspace = new Workspace(base),
      operations = operationContractsSchema.parse(resolveFixture),
      binding = operations.receivers[1]?.binding;
    if (binding?.kind !== "resolve-link") throw new Error();
    binding.cachePolicy = null;
    binding.cacheConnection = null;
    const args = { baseRevision: base.revision, action: "preview", operations },
      apply = { ...args, action: "apply" };
    const { provider, requests } = transport([
      [{ name: "configureOperations", arguments: wire("configureOperations", args) }],
      [{ name: "configureOperations", arguments: wire("configureOperations", apply) }],
      [],
    ]);
    let items: ModelItem[] = [];
    for (const expected of [args, apply]) {
      const response = await provider.respond(request(items));
      expect(JSON.parse(response.toolCalls[0]?.arguments ?? "null")).toEqual(expected);
      const [result] = execute(workspace, response.toolCalls);
      expect(result.ok).toBe(true);
      items = [
        ...items,
        ...response.items,
        {
          type: "tool-result",
          callId: response.toolCalls[0]?.callId ?? "",
          output: JSON.stringify(result),
        },
      ];
    }
    expect(workspace.pending).toEqual(buildOperationsCommand(base, { operations }).ops);
    await provider.respond(request(items));
    const replay = JSON.parse(
      String(requests[2]?.input.find((x) => x.type === "function_call")?.arguments),
    );
    expect(replay.upgrade).toBeNull();
    expect(replay.operations.receivers[1].binding).toEqual(binding);
    binding.cacheConnection = "redirect-cache";
    binding.cachePolicy = { ...positiveCachePolicy.ref, version: "99.0.0", sha256: "a".repeat(64) };
    const raw = wire("configureOperations", { ...args, operations });
    expect(JSON.parse(raw).operations.receivers[1].binding.cachePolicy).toEqual(
      binding.cachePolicy,
    );
    const bad = JSON.parse(raw);
    bad.operations.receivers[1].binding.successRetentionHours = null;
    const invalid = transport([[{ name: "configureOperations", arguments: JSON.stringify(bad) }]]);
    await expect(invalid.provider.respond(request())).rejects.toThrow();
  });
  it("transmits exact tagged operation refs, nullable verifier/retention, omission defaults and canonical history; refuses unknown fields", async () => {
    const base = structuredClone(studioArchitectureExample("studio-tinyurl").design);
    const shorten = base.architecture?.studio?.elements.find((x) => x.element === "shorten");
    if (!shorten || !("requestTimeoutMs" in shorten.settings)) throw new Error();
    shorten.settings.requestTimeoutMs = 10000;
    const workspace = new Workspace(base),
      operations = operationContractsSchema.parse(operationFixture);
    if (!operations.receivers[0]) throw new Error();
    if (operations.receivers[0].binding.kind !== "create-link") throw new Error();
    operations.receivers[0].binding.successRetentionHours = null;
    const args = { baseRevision: base.revision, action: "preview", operations },
      apply = { ...args, action: "apply", upgrade: true };
    const { provider, requests } = transport([
      [{ name: "configureOperations", arguments: wire("configureOperations", args) }],
      [{ name: "configureOperations", arguments: wire("configureOperations", apply) }],
      [],
    ]);
    let items: ModelItem[] = [];
    for (const expected of [args, apply]) {
      const response = await provider.respond(request(items));
      expect(JSON.parse(response.toolCalls[0]?.arguments ?? "null")).toEqual(expected);
      const [result] = execute(workspace, response.toolCalls);
      expect(result.ok).toBe(true);
      items = [
        ...items,
        ...response.items,
        {
          type: "tool-result",
          callId: response.toolCalls[0]?.callId ?? "",
          output: JSON.stringify(result),
        },
      ];
    }
    expect(workspace.pending).toEqual(
      buildOperationsCommand(base, { operations, upgrade: true }).ops,
    );
    await provider.respond(request(items));
    const replay = JSON.parse(
      String(requests[2]?.input.find((x) => x.type === "function_call")?.arguments),
    );
    expect(replay.upgrade).toBeNull();
    expect(replay.operations.receivers[0].binding.authVerifier).toBeNull();
    expect(replay.operations.receivers[0].binding.successRetentionHours).toBeNull();
    expect(replay.operations.receivers[0].id).toBe("create-link");
    expect(
      JSON.parse(
        workspace.run("describeOperation", JSON.stringify({ ref: createLinkOperation.ref })),
      ).status,
    ).toBe("known");
    expect(
      JSON.parse(
        workspace.run(
          "describeOperation",
          JSON.stringify({ ref: { ...createLinkOperation.ref, sha256: "d".repeat(64) } }),
        ),
      ).status,
    ).toBe("unresolved");
    const encoded = JSON.parse(wire("configureOperations", apply));
    encoded.operations.receivers[0].binding.extra = "refuse";
    const { provider: invalid } = transport([
      [{ name: "configureOperations", arguments: JSON.stringify(encoded) }],
    ]);
    await expect(invalid.respond(request())).rejects.toThrow();
  });
  it("transmits bounded ownership with omitted deployables/boundaries, defaults, canonical history and atomic grant refusal", async () => {
    const base = studioArchitectureExample("studio-tinyurl").design,
      workspace = new Workspace(base),
      ownership = ownershipSchema.parse(ownershipFixture);
    delete ownership.roles[0]?.deployable;
    const args = { baseRevision: base.revision, action: "preview", ownership };
    const apply = { ...args, action: "apply", upgrade: true };
    const { provider, requests } = transport([
      [{ name: "configureOwnership", arguments: wire("configureOwnership", args) }],
      [{ name: "configureOwnership", arguments: wire("configureOwnership", apply) }],
      [],
    ]);
    let items: ModelItem[] = [];
    for (const expected of [args, apply]) {
      const response = await provider.respond(request(items));
      expect(JSON.parse(response.toolCalls[0]?.arguments ?? "null")).toEqual(expected);
      const [result] = execute(workspace, response.toolCalls);
      expect(result.ok).toBe(true);
      items = [
        ...items,
        ...response.items,
        {
          type: "tool-result",
          callId: response.toolCalls[0]?.callId ?? "",
          output: JSON.stringify(result),
        },
      ];
    }
    expect(workspace.pending).toEqual(
      buildOwnershipCommand(base, { ownership, upgrade: true }).ops,
    );
    await provider.respond(request(items));
    const first = JSON.parse(
      String(requests[2]?.input.find((x) => x.type === "function_call")?.arguments),
    );
    expect(first.upgrade).toBeNull();
    expect(first.ownership.roles[0].deployable).toBeNull();
    expect(first.ownership.grants[0].boundary).toBeNull();
    expect(() =>
      wire("configureOwnership", { ...args, ownership: { ...ownership, owners: null } }),
    ).toThrow();
    const before = designBlueprintV3(workspace.working),
      bad = structuredClone(ownership);
    bad.dependencies[0] = { connection: "shorten-db", access: "read-write" };
    expect(
      JSON.parse(workspace.run("configureOwnership", JSON.stringify({ ...apply, ownership: bad })))
        .ok,
    ).toBe(false);
    expect(designBlueprintV3(workspace.working)).toEqual(before);
    const encoded = JSON.parse(wire("configureOwnership", apply));
    encoded.ownership.roles[0].extra = "refuse";
    const { provider: invalid } = transport([
      [{ name: "configureOwnership", arguments: JSON.stringify(encoded) }],
    ]);
    await expect(invalid.respond(request())).rejects.toThrow();
  });

  it("transmits persistent scope with exact nullable references, omission defaults and canonical history replay", async () => {
    const workspace = new Workspace(emptyDesign());
    const scope = tinyurlDesignScope();
    scope.customRequirements.push({
      id: "custom-rule",
      requirement: "Define tenant policy",
      criticality: "required",
    });
    const preview = { baseRevision: 0, action: "preview", scope };
    const missingUpgrade = { ...preview, action: "apply" };
    const apply = { ...missingUpgrade, upgrade: true };
    const { provider, requests } = transport(
      [preview, missingUpgrade, apply]
        .map((args) => [
          { name: "configureDesignScope", arguments: wire("configureDesignScope", args) },
        ])
        .concat([[]]),
    );
    let items: ModelItem[] = [];
    for (const [index, args] of [preview, missingUpgrade, apply].entries()) {
      const response = await provider.respond(request(items));
      expect(JSON.parse(response.toolCalls[0]?.arguments ?? "null")).toEqual(args);
      const [result] = execute(workspace, response.toolCalls);
      expect(result.ok).toBe(index !== 1);
      items = [
        ...items,
        ...response.items,
        {
          type: "tool-result",
          callId: response.toolCalls[0]?.callId ?? "",
          output: JSON.stringify(result),
        },
      ];
    }
    expect(workspace.working).toMatchObject({ schemaVersion: 3, scope });
    await provider.respond(request(items));
    const firstWire = JSON.parse(
      String(requests[3]?.input.find((item) => item.type === "function_call")?.arguments),
    );
    expect(firstWire).toMatchObject({
      upgrade: null,
      scope: { customRequirements: [{ element: null, connection: null }] },
    });
    const noProfile = { ...preview, scope: { ...scope, profile: null } };
    expect(JSON.parse(wire("configureDesignScope", noProfile)).scope.profile).toBeNull();
  });
  it("transmits every current schema as strict, preserves nested commands/defaults, and replays wire history", async () => {
    const args = {
      commands: [
        {
          type: "addTile",
          from: { lane: "upload" },
          tile: { id: "service", name: "Publisher", kind: "service" },
          linkId: "upload-service",
          system: { name: "Strict studio" },
        },
        { type: "addTile", from: { tile: "service" }, tile: { name: "Cache", kind: "cache" } },
        { type: "addTile", from: { tile: "service" }, tile: { name: "Jobs", kind: "queue" } },
        { type: "addTile", from: { tile: "jobs" }, tile: { name: "Worker", kind: "worker" } },
        { type: "addModule", host: "service", kind: "cache-reader", name: "Read cache" },
        {
          type: "connectModule",
          module: "service-read-cache",
          slot: "cache",
          target: { tile: "cache" },
        },
        { type: "editModule", module: "service-read-cache", description: "Preserve me" },
        { type: "editConnection", connection: "service-cache", label: "Lookup cache" },
        { type: "setSetting", tile: "cache", setting: "engine", value: "redis-compatible" },
      ],
    };
    const encoded = wire("applyStudioCommands", args);
    const raw = JSON.parse(encoded);
    expect(raw).toMatchObject({ preview: null });
    expect(raw.commands[0]).toMatchObject({
      link: null,
      system: { name: "Strict studio", description: null },
      tile: { description: null },
    });
    expect(raw.commands[1]).toMatchObject({ linkId: null, tile: { id: null } });
    expect(raw.commands[8]).toMatchObject({ module: null, value: "redis-compatible" });
    const { provider, requests } = transport([
      [{ name: "applyStudioCommands", arguments: encoded }],
      [],
    ]);
    const response = await provider.respond(request());
    expect(JSON.parse(response.toolCalls[0]?.arguments ?? "null")).toEqual(args);
    const workspace = new Workspace(emptyDesign());
    const [result] = execute(workspace, response.toolCalls);
    // A setting that isn't a normal control is refused, by command, and nothing is kept.
    expect(result).toMatchObject({
      ok: false,
      problems: [
        {
          command: 9,
          type: "setSetting",
          problem: expect.stringContaining('Cache has no editable setting "engine"'),
        },
      ],
    });
    expect(workspace.working).toEqual(emptyDesign());
    expect(workspace.pending).toEqual([]);
    // Without it, the batch goes through: IDs follow names, and the module keeps its description.
    const accepted = execute(workspace, [
      {
        name: "applyStudioCommands",
        arguments: JSON.stringify({ ...args, commands: args.commands.slice(0, 8) }),
      },
    ])[0];
    expect(accepted).toMatchObject({ ok: true, commands: 8 });
    expect(workspace.working.architecture?.studio?.components).toEqual([
      expect.objectContaining({ id: "service-read-cache", description: "Preserve me" }),
    ]);
    expect(workspace.working.connections.map((item) => item.id)).toEqual(
      expect.arrayContaining(["service-cache", "service-jobs", "jobs-worker"]),
    );
    await provider.respond(
      request([
        ...response.items,
        {
          type: "tool-result",
          callId: response.toolCalls[0]?.callId ?? "",
          output: JSON.stringify(result),
        },
      ]),
    );
    expect(requests[1]?.input[0]).toMatchObject({ type: "function_call", arguments: encoded });
    expect(requests[0]?.tools).toEqual(requests[1]?.tools);
    expect(requests[0]?.tools).toHaveLength(16);
    // Inspect the actual HTTP body recursively, including all settings/module/scope unions.
    function inspect(schema: Record<string, unknown>) {
      expect(schema).not.toHaveProperty("oneOf");
      expect(schema).not.toHaveProperty("$ref");
      expect(schema).not.toHaveProperty("default");
      if (schema.type === "object") {
        expect(schema.additionalProperties).toBe(false);
        const properties = schema.properties as Record<string, Record<string, unknown>>;
        expect(schema.required).toEqual(Object.keys(properties));
        Object.values(properties).forEach(inspect);
      }
      if (schema.items) inspect(schema.items as Record<string, unknown>);
      if (schema.anyOf) (schema.anyOf as Record<string, unknown>[]).forEach(inspect);
    }
    for (const tool of requests[0]?.tools ?? []) {
      expect(tool).toMatchObject({ strict: true });
      inspect((tool as { parameters: Record<string, unknown> }).parameters);
    }
    expect(tools).toEqual(toolDefinitions());
  });

  it("round-trips target and value discriminators without filling optional fields", async () => {
    const args = {
      commands: [
        { type: "connectModule", module: "m", slot: "cache", target: { tile: "cache" } },
        { type: "connectModule", module: "m", slot: "loader", target: { module: "loader" } },
        ...["optional", 5000, true, null].map((value) => ({
          type: "setSetting",
          module: "guard",
          setting: "signIn",
          value,
        })),
      ],
    };
    const { provider } = transport([
      [{ name: "applyStudioCommands", arguments: wire("applyStudioCommands", args) }],
    ]);
    expect(
      JSON.parse((await provider.respond(request())).toolCalls[0]?.arguments ?? "null"),
    ).toEqual(args);
  });

  it("distinguishes omitted ownership, clear and set through Workspace and subsequent Responses requests", async () => {
    const workspace = new Workspace(studioArchitectureExample("studio-tinyurl").design);
    const owner = () =>
      workspace.working.architecture?.studio?.elements.find((item) => item.element === "url-db")
        ?.owner;
    expect(owner()).toEqual({ kind: "element", id: "shorten" });
    let items: ModelItem[] = [];
    const edits = [
      { type: "editTile", tile: "url-db", name: "Links" },
      { type: "editTile", tile: "url-db", owner: null },
      { type: "editTile", tile: "url-db", owner: "shorten" },
    ];
    const rounds = edits.map((edit) => [
      {
        name: "applyStudioCommands",
        arguments: wire("applyStudioCommands", {
          commands: [edit],
        }),
      },
    ]);
    const { provider, requests } = transport([...rounds, []]);
    for (const [index, edit] of edits.entries()) {
      const response = await provider.respond(request(items));
      expect(JSON.parse(response.toolCalls[0]?.arguments ?? "null").commands).toEqual([edit]);
      const [result] = execute(workspace, response.toolCalls);
      expect(result.ok).toBe(true);
      expect(owner()).toEqual(index === 1 ? undefined : { kind: "element", id: "shorten" });
      items = [
        ...items,
        ...response.items,
        {
          type: "tool-result",
          callId: response.toolCalls[0]?.callId ?? "",
          output: JSON.stringify(result),
        },
      ];
    }
    await provider.respond(request(items));
    expect(JSON.parse(rounds[0]?.[0]?.arguments ?? "null").commands[0].owner).toBeNull();
    expect(JSON.parse(rounds[1]?.[0]?.arguments ?? "null").commands[0].owner).toEqual({
      value: null,
    });
    const replay = requests[3]?.input.filter((item) => item.type === "function_call");
    expect(replay?.map((item) => item.arguments)).toEqual(
      rounds.map((round) => round[0]?.arguments),
    );
  });

  it("preserves addAction and askUser defaults and RF04 optional targets", async () => {
    const scope = {
      patterns: [{ id: "durable-background-job", checklistIds: [] }],
      assumptions: ["Topology only"],
      obligations: [{ id: "lifecycle", requirement: "Specify lifecycle" }],
    };
    const calls = [
      {
        name: "applyStudioCommands",
        arguments: wire("applyStudioCommands", {
          commands: [{ type: "addAction", lane: "download", system: { name: "Example" } }],
        }),
      },
      { name: "declareReviewScope", arguments: wire("declareReviewScope", scope) },
      {
        name: "askUser",
        arguments: '{"question":"Scope?","choices":["Small","Large"],"allowFreeText":null}',
      },
    ];
    const { provider } = transport([calls]);
    const response = await provider.respond(request());
    const workspace = new Workspace(emptyDesign());
    expect(execute(workspace, response.toolCalls).every((result) => result.ok)).toBe(true);
    expect(workspace.question?.allowFreeText).toBe(true);
    expect(workspace.scope).toEqual(scope);
    expect(workspace.working.architecture?.studio?.actions).toEqual([
      { lane: "download", name: "Consume" },
    ]);
    const explicit = transport([
      [
        {
          name: "askUser",
          arguments: '{"question":"Scope?","choices":["Small"],"allowFreeText":false}',
        },
      ],
    ]);
    execute(workspace, (await explicit.provider.respond(request())).toolCalls);
    expect(workspace.question?.allowFreeText).toBe(false);
  });

  it("keeps canonical refinements, command validation and lane rules authoritative", async () => {
    const workspace = new Workspace(studioArchitectureExample("studio-tinyurl").design);
    const before = workspace.working;
    const invalidCommands = [
      { type: "editTile", tile: "ghost", name: "Missing" },
      { type: "linkTiles", from: { tile: "url-cache" }, to: "shorten", linkId: "invalid" },
      // The catalog's host rules are not expressible in the wire JSON Schema. The server refuses.
      { type: "addModule", host: "redirect", kind: "video-encoder" },
    ];
    const { provider } = transport(
      invalidCommands.map((command) => [
        {
          name: "applyStudioCommands",
          arguments: wire("applyStudioCommands", {
            commands: [command],
          }),
        },
      ]),
    );
    for (const _command of invalidCommands) {
      const response = await provider.respond(request());
      expect(execute(workspace, response.toolCalls)[0]?.ok).toBe(false);
      expect(workspace.working).toBe(before);
      expect(workspace.pending).toEqual([]);
    }
  });

  it("refuses malformed and extra nested wire arguments without sanitizing them", async () => {
    const args = JSON.parse(
      wire("applyStudioCommands", { commands: [{ type: "editTile", tile: "x" }] }),
    );
    const variants = [
      { ...args, extra: null },
      { ...args, commands: [{ ...args.commands[0], surprise: null }] },
      { ...args, commands: [{ ...args.commands[0], owner: { value: null, extra: null } }] },
      { ...args, commands: [{ type: "editTile", tile: "x" }] },
      { ...args, commands: [{ ...args.commands[0], name: 42 }] },
    ];
    const { provider } = transport(
      variants.map((args) => [{ name: "applyStudioCommands", arguments: JSON.stringify(args) }]),
    );
    for (const _args of variants)
      await expect(provider.respond(request())).rejects.toMatchObject({ kind: "bad-request" });
  });
});
