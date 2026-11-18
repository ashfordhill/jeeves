import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  deploymentAdmissionDesign,
  deploymentBrowserDesign,
  deploymentDesign,
} from "../../../field-projects/generator-system/fixtures/wd-deployment/design.ts";
import { expectedDeployment } from "../../../field-projects/generator-system/fixtures/wd-deployment/expected.ts";
import { runStudioCommands } from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { exportNewDirectory } from "../export.ts";
import { updateDirectory } from "../update.ts";
import { assembleV2 } from "./assemble.ts";

function must<T>(value: T | undefined | null): T {
  if (value == null) throw Error("Missing emitted audit value");
  return value;
}
const registry = loadLocalV2Registry();
const bundle = assembleV2({ designJson: JSON.stringify(deploymentDesign()) }, registry);
const text = (path: string) => {
  const file = bundle.files.find((f) => f.path === path);
  if (!file) throw Error(`Missing ${path}`);
  return new TextDecoder().decode(file.bytes);
};
const contract = JSON.parse(text("deploy/contract.json")) as typeof expectedDeployment;

/** Evaluate only generated configuration readers with fake file bytes, never modules/hooks,
 * sockets, databases, broker clients or libraries. Each process gets its own environment proxy.
 * Arguments come from its emitted entry/configuration and compiled bindings, not deployment.ts.
 * Four passes reach optional TLS and credential-location branches, including dynamic names. */
function auditEnvironment(id: string) {
  const seen = new Set<string>();
  const entry = text(`src/processes/${id}.ts`);
  const config = JSON.parse(must(entry.match(/export const config = ([\s\S]*?) as const;/)?.[1]));
  for (const secure of [false, true])
    for (const namedSecrets of [false, true]) {
      const env = new Proxy(
        {},
        {
          get: (_object, key) => {
            if (typeof key !== "string") throw Error("Unexpected env key");
            seen.add(key);
            if (key.startsWith("JEEVES_SECRET_"))
              return namedSecrets ? "/audit/credential" : undefined;
            if (key === "SECRET_DIR") return "/audit";
            if (key === "JEEVES_REQUIRE_TLS") return secure ? "true" : undefined;
            if (key === "NODE_TLS_REJECT_UNAUTHORIZED") return secure ? "1" : undefined;
            if (key.endsWith("_TLS")) return secure ? "verify-full" : "disable";
            if (key.endsWith("_TLS_SERVERNAME")) return secure ? "store.example" : undefined;
            if (key.endsWith("_CA_FILE")) return secure ? "/audit/ca" : undefined;
            if (key.endsWith("_HOST")) return "store.example";
            if (key.endsWith("_PORT")) return "5432";
            if (key.includes("WORKLOAD_") || key.endsWith("_URL"))
              return "https://identity.example/";
            throw Error(`Unhandled actual environment read ${key}`);
          },
        },
      );
      const globals: Record<string, unknown> = {
        process: { env },
        Buffer,
        URL,
        console,
        readFileSync: () => "audit-file",
        openSync: () => {
          throw Error("No actual file reads");
        },
      };
      function load(path: string, names: string[]) {
        const source = stripTypeScriptTypes(text(path))
          .replace(/^import\s[\s\S]*?;\s*/gm, "")
          .replace(/\bexport\s+(?=(?:const|let|function|async|class)\b)/g, "");
        return runInNewContext(`(() => {${source}\n;return {${names.join(",")}};})()`, globals);
      }
      const local = load("src/runtime/local.ts", ["readSecret"]);
      globals.readSecret = local.readSecret;
      const clients = load("src/runtime/module-clients.ts", ["databaseEndpoint", "brokerBinding"]);
      for (const match of entry.matchAll(/databaseEndpoint\("([^"]+)"\)/g))
        clients.databaseEndpoint(match[1]);
      for (const match of entry.matchAll(/readSecret\("([^"]+)"\)/g)) local.readSecret(match[1]);
      if (entry.includes("brokerBinding()")) clients.brokerBinding();
      if (config.workload) {
        const workload = load("src/runtime/workload.ts", ["workloadSettings", "serviceEndpoint"]);
        workload.workloadSettings(config.workload);
        for (const match of entry.matchAll(/serviceEndpoint\("([^"]+)"\)/g))
          workload.serviceEndpoint(match[1]);
      }
      if (entry.includes("positiveCacheBindings")) {
        const { positiveCacheBindings } = load("src/features/positive-cache-bindings.ts", [
          "positiveCacheBindings",
        ]);
        const valkey = load("src/runtime/valkey.ts", ["cacheEndpoint"]);
        globals.cacheEndpoint = valkey.cacheEndpoint;
        for (const template of Object.keys(config.templates)) {
          const binding = positiveCacheBindings[template];
          valkey.cacheEndpoint(binding.cache.resource);
          local.readSecret(binding.cache.secret);
        }
        const { selections } = load("src/features/application-bindings.ts", ["selections"]);
        const { localLogins } = load("src/features/local-bindings.ts", ["localLogins"]);
        globals.selections = selections;
        globals.localLogins = localLogins;
        load("src/features/service-resources.ts", [
          "validateTemplateSettings",
        ]).validateTemplateSettings(id);
      }
      if (/validateLocalOperationBinding\([^;]+, \["/.test(entry)) {
        // Allowed secret-bearing local-operation branch reads its private ring; fake bounded file
        // access then deliberately fails. No application operation/policy is constructed/executed.
        expect(() =>
          load("src/runtime/settings.ts", ["privateReplayKeys"]).privateReplayKeys(),
        ).toThrow("Invalid setting JEEVES_REPLAY_KEYS");
      }
    }
  return [...seen].sort();
}

describe("WD09 deployment contract", () => {
  it("reports browser maintenance and actual private configuration reads, not unused mounts", () => {
    const result = assembleV2({ designJson: JSON.stringify(deploymentBrowserDesign()) }, registry);
    const actual = JSON.parse(
      new TextDecoder().decode(
        must(result.files.find((f) => f.path === "deploy/contract.json")).bytes,
      ),
    );
    expect(actual.processes[0]).toMatchObject({ id: "browser", alwaysOn: true });
    expect(actual.processes[0].env).toEqual([
      "JEEVES_BROWSER_IDENTITY_ISSUER_ISSUER",
      "JEEVES_BROWSER_LOGIN_AUDIENCE",
      "JEEVES_BROWSER_LOGIN_CALLBACK",
      "JEEVES_DATABASE_SESSIONS_CA_FILE",
      "JEEVES_DATABASE_SESSIONS_HOST",
      "JEEVES_DATABASE_SESSIONS_PORT",
      "JEEVES_DATABASE_SESSIONS_TLS",
      "JEEVES_DATABASE_SESSIONS_TLS_SERVERNAME",
      "JEEVES_REQUIRE_TLS",
      "JEEVES_SECRET_JEEVES_BROWSER_LOGIN_CLIENT_SECRET_FILE",
      "JEEVES_SECRET_JEEVES_BROWSER_LOGIN_KEYS_FILE",
      "JEEVES_SECRET_SQL_SESSIONS__BROWSER_FILE",
      "NODE_TLS_REJECT_UNAUTHORIZED",
      "SECRET_DIR",
    ]);
  });
  it("keeps admission state original despite its physical cache kind", () => {
    const design = deploymentAdmissionDesign();
    const result = assembleV2({ designJson: JSON.stringify(design) }, registry);
    const actual = JSON.parse(
      new TextDecoder().decode(
        must(result.files.find((f) => f.path === "deploy/contract.json")).bytes,
      ),
    );
    expect(actual.stores.find((s: { id: string }) => s.id === "admission")).toMatchObject({
      name: "Shared admission",
      role: "original",
    });
    expect(
      new TextDecoder().decode(
        must(result.files.find((f) => f.path === "src/processes/catalog.ts")).bytes,
      ),
    ).toContain("cache.required()");
  });

  it("matches the independently handwritten design expectation, including optional reads", () => {
    expect(bundle.report.findings).toEqual([]);
    expect(contract).toEqual(expectedDeployment);
    expect(text("deploy/contract.json")).toBe(
      new TextDecoder().decode(
        must(
          assembleV2({ designJson: JSON.stringify(deploymentDesign()) }, registry).files.find(
            (f) => f.path === "deploy/contract.json",
          ),
        ).bytes,
      ),
    );
  });

  it("audits each process against actual emitted environment readers and compiled dynamic names", () => {
    for (const process of contract.processes)
      expect(auditEnvironment(process.id), process.id).toEqual(process.env);
    // Find every env-reading file in each emitted import closure. This catches a new reader
    // module being introduced without extending the independent execution audit above.
    for (const process of contract.processes) {
      const visited = new Set<string>();
      function visit(path: string) {
        if (visited.has(path)) return;
        visited.add(path);
        const source = stripTypeScriptTypes(text(path));
        for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g))
          visit(posix.join(posix.dirname(path), must(match[1])));
      }
      visit(`src/processes/${process.id}.ts`);
      expect(
        [...visited].filter((path) => /process\.env/.test(text(path))).sort(),
        process.id,
      ).toEqual(
        [
          "src/runtime/local.ts",
          "src/runtime/module-clients.ts",
          "src/runtime/settings.ts",
          ...(process.id === "catalog"
            ? ["src/features/service-resources.ts", "src/runtime/valkey.ts"]
            : []),
          ...(["catalog", "front"].includes(process.id) ? ["src/runtime/workload.ts"] : []),
        ].sort(),
      );
    }
  });

  it("declares every Mermaid arrow node and click heading, with real source folders", () => {
    const readme = text("deploy/README.md");
    const nodes = [...readme.matchAll(/^ {2}([ps]\d+)\[/gm)].map((m) => m[1]);
    expect(nodes).toHaveLength(contract.processes.length + contract.stores.length);
    const arrows = [...readme.matchAll(/^ {2}([ps]\d+) (?:-->|-\.->)(?:\|[^|]+\|)? ([ps]\d+)$/gm)];
    expect(arrows).toHaveLength(
      contract.processes.reduce((n, p) => n + p.uses.length + p.calls.length, 0),
    );
    for (const arrow of arrows) {
      expect(nodes).toContain(arrow[1]);
      expect(nodes).toContain(arrow[2]);
    }
    expect(readme).toContain("-.->|consume|");
    const headings = [...readme.matchAll(/^## (.+)$/gm)].map((m) =>
      must(m[1]).toLowerCase().replaceAll(" ", "-"),
    );
    const clicks = [...readme.matchAll(/^ {2}click ([ps]\d+) "#([^"]+)"$/gm)];
    expect(clicks).toHaveLength(nodes.length);
    for (const click of clicks) {
      expect(nodes).toContain(click[1]);
      expect(headings).toContain(click[2]);
    }
    for (const link of readme.matchAll(/Source folder: \[[^\]]+\]\(\.\.\/([^)]*)\)/g))
      expect(
        bundle.files.some((f) => f.path.startsWith(must(link[1]))),
        link[1],
      ).toBe(true);
  });

  it("omits workload identity with no process calls and exports facts with processes off", () => {
    const off = runStudioCommands(deploymentDesign(), [
      { type: "setRunnableProcesses", on: false },
    ]);
    const exported = assembleV2({ designJson: JSON.stringify(off) }, registry);
    const actual = JSON.parse(
      new TextDecoder().decode(
        must(exported.files.find((f) => f.path === "deploy/contract.json")).bytes,
      ),
    );
    expect(actual.processes).toEqual([]);
    expect(actual.identity).toBeUndefined();
    expect(actual.stores.length).toBeGreaterThan(0);
  });

  it("public updates replace both scaffolds and refuse manual edits", async () => {
    const root = await mkdtemp(join(tmpdir(), "jeeves-wd09-update-"));
    const destination = join(root, "export");
    try {
      await exportNewDirectory(bundle.files, destination);
      const design = deploymentDesign();
      const catalog = design.elements.find((e) => e.id === "catalog");
      if (!catalog) throw Error("Missing catalog");
      catalog.name = "Updated catalog";
      const next = assembleV2({ designJson: JSON.stringify(design) }, registry);
      const planned = await updateDirectory(next, destination, { check: true });
      for (const path of ["deploy/contract.json", "deploy/README.md"]) {
        expect(next.manifest.files.find((f) => f.path === path)?.ownership).toBe(
          "generated-scaffold",
        );
      }
      expect(planned.counts.replace).toBeGreaterThanOrEqual(2);
      const updated = await updateDirectory(next, destination, { check: false });
      expect(updated.refused).toEqual([]);
      for (const path of ["deploy/contract.json", "deploy/README.md"]) {
        expect(await readFile(join(destination, path), "utf8")).toContain("Updated catalog");
        // Deliberate tampering is the input of this ownership test, never implementation work.
        await writeFile(join(destination, path), "hand-edited deployment facts\n");
      }
      const refused = await updateDirectory(bundle, destination, { check: true });
      for (const path of ["deploy/contract.json", "deploy/README.md"])
        expect(refused.refused.some((reason) => reason.includes(path))).toBe(true);
      expect(refused.refused).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
