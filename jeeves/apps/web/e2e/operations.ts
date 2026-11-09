import {
  applyOperations,
  buildOperationsCommand,
  buildStudioCommand,
  createLinkSignature,
  type DesignDocument,
  designSchema,
  positiveCachePolicy,
  previewOperations,
  resolveLinkSignature,
  type StudioCommand,
} from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { commitSource } from "./source.ts";
import { expect, ready, tile } from "./studio.ts";

/** Historical source setup, independent of normal editable template support. Contract
 * declaration below must still validate this exact source and must never rewrite it. */
export async function seedLegacySettings(
  page: Page,
  commands: (design: DesignDocument) => StudioCommand[],
) {
  const id = new URL(page.url()).searchParams.get("project");
  if (!id) throw new Error("Missing project");
  const state = await (await page.request.get(`/api/projects/${id}/design`)).json();
  let design = designSchema.parse(state.design);
  const ops = [];
  for (const command of commands(design)) {
    const batch = buildStudioCommand(design, command);
    const result = applyOperations(design, batch.ops);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    design = result.design;
    ops.push(...batch.ops);
  }
  const saved = await page.request.post(`/api/projects/${id}/operations`, {
    data: { baseRevision: state.design.revision, source: "canvas", ops },
  });
  expect(saved.ok()).toBe(true);
  expect((await saved.json()).design).toEqual({ ...design, revision: state.design.revision + 1 });
  await page.reload();
  await ready(page);
}
export async function alignCreateTimeout(page: Page) {
  await seedLegacySettings(page, (design) => {
    const row = design.architecture?.studio?.elements.find((row) => row.element === "shorten");
    if (row?.settings.kind !== "service") throw new Error("Missing create service");
    return [
      {
        type: "edit",
        element: row.element,
        settings: { ...row.settings, requestTimeoutMs: 10000 },
      },
    ];
  });
  await tile(page, "Shorten service").click();
  await expect(page.getByLabel("Request timeout", { exact: true })).toHaveCount(0);
}
export async function declareCreate(page: Page) {
  await declareOperation(page, false);
}

/** Explicit historical source alignment. These policies stay unavailable in normal forms. */
export async function alignResolveSettings(page: Page) {
  await seedLegacySettings(page, (design) => {
    const studio = design.architecture?.studio;
    const redirect = studio?.elements.find((row) => row.element === "redirect");
    const cache = studio?.elements.find((row) => row.element === "url-cache");
    if (redirect?.settings.kind !== "redirect" || cache?.settings.kind !== "cache")
      throw new Error("Missing legacy resources");
    const commands: StudioCommand[] = [
      {
        type: "edit",
        element: redirect.element,
        settings: { ...redirect.settings, requestTimeoutMs: 1200 },
      },
      { type: "edit", element: cache.element, settings: { ...cache.settings, ttlSeconds: 300 } },
    ];
    for (const component of studio?.components ?? []) {
      if (component.host !== "redirect") continue;
      const settings = component.settings;
      if (settings.kind === "data-access")
        commands.push({
          type: "editComponent",
          component: component.id,
          settings: { ...settings, readRouting: "primary" },
        });
      if (settings.kind === "cache-reader") {
        const {
          l1TtlSeconds: _ttl,
          l1MaxEntries: _size,
          negativeTtlSeconds: _negative,
          ...kept
        } = settings;
        commands.push({
          type: "editComponent",
          component: component.id,
          settings: { ...kept, l2TtlSeconds: 300, stampede: "none" },
        });
      }
      if (settings.kind === "redirect-responder")
        commands.push({
          type: "editComponent",
          component: component.id,
          settings: { ...settings, status: "307" },
        });
    }
    return commands;
  });
  await tile(page, "Redirect service").click();
  await expect(page.getByLabel("Request timeout", { exact: true })).toHaveCount(0);
}
export async function declareResolve(page: Page) {
  await declareOperation(page, true);
}
async function declareOperation(page: Page, resolve: boolean) {
  await commitSource(page, (design) => {
    const implementation = resolve ? resolveLinkSignature() : createLinkSignature();
    const role = resolve ? "redirect" : "shorten";
    const entry = design.architecture?.studio?.entries?.find((row) => row.element === role);
    if (!entry) throw new Error("Missing operation entry");
    const operations = {
      receivers: [
        {
          id: "operation-1",
          role,
          implementation,
          binding: resolve
            ? {
                kind: "resolve-link" as const,
                storeConnection: "redirect-db",
                cacheConnection: "redirect-cache",
                cachePolicy: { ...positiveCachePolicy.ref },
              }
            : {
                kind: "create-link" as const,
                storeConnection: "shorten-db",
                successRetentionHours: 24 as const,
                authVerifier: null,
              },
        },
      ],
      calls: [
        {
          id: "call-1",
          caller: {
            kind: "entry" as const,
            entry: entry.id,
            lane: entry.lane,
            element: entry.element,
          },
          receiverBinding: "operation-1",
          receiverRole: role,
          expects: implementation,
        },
      ],
    };
    const preview = previewOperations(design, operations);
    expect(preview.changes).toHaveLength(2);
    if (!resolve)
      expect(preview.findings.map((row) => row.message).join(" ")).toContain(
        "Trusted runtime auth verifier",
      );
    return buildOperationsCommand(design, { operations, upgrade: true });
  });
  await tile(page, resolve ? "Redirect service" : "Shorten service").click();
}
