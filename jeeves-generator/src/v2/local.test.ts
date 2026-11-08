import { designSchema, generationRuntime } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import type { V2Emitter } from "./registry.ts";

const source = () => {
  const generation = generationSelectionsFixture();
  return designSchema.parse({
    ...generationSourceFixture(),
    generation: {
      version: 1,
      runtime: generationRuntime.ref,
      selections: generation.selections.filter((s) => s.id === "ready-reader"),
    },
  });
};
const emit = (design = source(), features: V2Emitter[] = []) =>
  assembleV2({ designJson: JSON.stringify(design) }, loadLocalV2Registry(features));
const text = (bundle: ReturnType<typeof emit>, path: string) =>
  new TextDecoder().decode(bundle.files.find((f) => f.path === path)?.bytes);
const hook = (id: string, local: NonNullable<V2Emitter["local"]>): V2Emitter => ({
  id,
  version: "0.1.0",
  status: "diagnostic",
  description: "Offline composition probe, not installed feature support.",
  sourcePaths: ["jeeves-generator/src/v2/local.test.ts"],
  local,
  render: () => ({ files: [] }),
});

describe("standalone local foundation", () => {
  it("emits only selected providers and no domain application, secrets or blanket table grants", () => {
    const bundle = emit();
    const compose = JSON.parse(text(bundle, "compose.yaml"));
    expect(Object.keys(compose.services).sort()).toEqual([
      "cache-metadata-cache",
      "local-postgres",
      "setup-migrate",
    ]);
    expect(compose.services["local-postgres"].secrets).toEqual(["postgres-admin"]);
    expect(compose.services["setup-migrate"].profiles).toEqual(["setup"]);
    const plan = JSON.parse(text(bundle, "infra/local.json"));
    expect(plan.databases).toMatchObject([
      { resource: "metadata-db", database: "d_metadata_db", owner: "o_metadata_db" },
    ]);
    expect(plan.logins).toEqual([]);
    expect(plan.application).toEqual([]);
    expect(plan.objects).toEqual([]);
    expect(bundle.files.some((f) => f.path.startsWith(".runtime/"))).toBe(false);
    expect(bundle.files.some((f) => f.path.startsWith("src/services/"))).toBe(false);
    expect(text(bundle, "scripts/migrate.mjs")).not.toContain("GRANT SELECT ON ALL");
    expect(text(bundle, "scripts/migrate.mjs")).toContain("quote(db.database)");
    expect(text(bundle, "scripts/local.mjs")).toContain("No replacement will be created");
    expect(bundle.report.applicationComplete).toBe(false);
    const empty = source();
    if (empty.schemaVersion !== 3 || !empty.generation) throw new Error();
    empty.generation.selections = [];
    expect(JSON.parse(text(emit(empty), "compose.yaml")).services).toEqual({});
    const full = emit(
      designSchema.parse({
        ...generationSourceFixture(),
        generation: generationSelectionsFixture(),
      }),
    );
    const fullPlan = JSON.parse(text(full, "infra/local.json"));
    expect(
      fullPlan.databases.find((db: { resource: string }) => db.resource === "identity"),
    ).toMatchObject({ owner: "io_identity", secret: "identity-owner-identity" });
    expect(fullPlan.providerLogins).toMatchObject([
      { user: "ik_identity", secret: "identity-identity", provider: "identity" },
    ]);
    const fullCompose = JSON.parse(text(full, "compose.yaml"));
    expect(fullCompose.services["identity-identity"].environment.KC_DB_USERNAME).toBe(
      "ik_identity",
    );
    expect(fullCompose.services["identity-identity"].secrets).toBeUndefined();
    expect(fullCompose.services["setup-migrate"].secrets).toContain("identity-owner-identity");
  });

  it("composes typed cross-module logins/views/grants with exact contributors and setup-only owner mounts", () => {
    const features = [
      hook("probe.a-grant", () => ({
        sourcePaths: ["/generation/selections/0"],
        grants: [
          {
            resource: "metadata-db",
            host: "watch",
            schema: "published",
            relation: "ready_records",
            kind: "view",
            privileges: ["SELECT"],
          },
        ],
      })),
      hook("probe.z-view", () => ({
        sourcePaths: ["/generation/selections/0"],
        logins: [{ resource: "metadata-db", host: "watch" }],
        migrations: [
          { resource: "metadata-db", id: "001-probe.sql", sql: 'CREATE SCHEMA "published";' },
        ],
        views: [
          {
            resource: "metadata-db",
            schema: "published",
            name: "ready_records",
            selectSql: "SELECT 1 AS id",
          },
        ],
        services: [
          {
            host: "watch",
            command: ["node", "scripts/status.mjs"],
            dependsOn: ["metadata-db"],
            sql: ["metadata-db"],
          },
        ],
      })),
    ];
    const bundle = emit(source(), features);
    const compose = JSON.parse(text(bundle, "compose.yaml"));
    expect(compose.services["app-watch"].secrets).toEqual(["sql-metadata-db--watch"]);
    expect(compose.services["app-watch"].secrets).not.toContain("owner-metadata-db");
    expect(compose.services["setup-migrate"].secrets).toContain("owner-metadata-db");
    const plan = JSON.parse(text(bundle, "infra/local.json"));
    expect(plan.logins[0].user).toBe("r_metadata_db__watch");
    expect(plan.grants[0]).toMatchObject({ schema: "published", privileges: ["SELECT"] });
    expect(
      bundle.manifest.files
        .find((f) => f.path === "infra/local.json")
        ?.contributors.map((c) => c.emitter.id),
    ).toEqual(["probe.a-grant", "probe.z-view"]);
    expect(
      bundle.manifest.files.find((f) => f.path === "src/runtime/local.ts")?.contributors,
    ).toEqual([]);
    const grant = features[0];
    if (!grant) throw new Error();
    expect(() =>
      emit(source(), [
        {
          ...grant,
          local: () => ({
            sourcePaths: ["/generation/selections/0"],
            logins: [{ resource: "metadata-db", host: "watch" }],
            grants: [
              {
                resource: "metadata-db",
                host: "watch",
                relation: "private_records",
                kind: "table",
                privileges: ["SELECT"],
              },
            ],
          }),
        },
      ]),
    ).toThrow(/publication|boundary/i);
  });

  it("refuses composed provider limits without truncation and changes actual provider output with canonical bindings", () => {
    const design = source();
    const longId = `d${"a".repeat(62)}`;
    const rename = JSON.stringify(design).replaceAll('"metadata-db"', JSON.stringify(longId));
    expect(() => emit(designSchema.parse(JSON.parse(rename)))).toThrowError(
      expect.objectContaining({ code: "LOCAL_IDENTITY_LIMIT" }),
    );
    const renamed = designSchema.parse(
      JSON.parse(JSON.stringify(design).replaceAll('"metadata-db"', '"select"')),
    );
    const plan = JSON.parse(text(emit(renamed), "infra/local.json"));
    expect(plan.databases[0]).toMatchObject({
      resource: "select",
      database: "d_select",
      owner: "o_select",
    });
    expect(text(emit(renamed), "infra/postgres/select/000-foundation.sql")).toContain("REVOKE ALL");
    expect(text(emit(renamed), "infra/local.json")).not.toBe(text(emit(), "infra/local.json"));
  });
});
