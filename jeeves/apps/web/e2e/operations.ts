import {
  applyOperations,
  buildStudioCommand,
  type DesignDocument,
  designSchema,
  type StudioCommand,
} from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { expect, ready, tile } from "./studio.ts";

/** Historical source setup, independent of normal editable template support. Contract
 * declaration below must still validate this exact source and must never rewrite it. */
async function seedLegacySettings(
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
async function openLegacyRole(page: Page, name: string, owned: boolean) {
  if (owned) {
    const owner = tile(page, "Links · logical owner");
    await expect(owner).toBeVisible();
    await owner.getByRole("button", { name: "Expand roles", exact: true }).click();
  }
  await ready(page);
  await tile(page, name).click();
}
export async function alignCreateTimeout(page: Page, owned = true) {
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
  await openLegacyRole(page, "Shorten service", owned);
  await expect(page.getByLabel("Request timeout", { exact: true })).toHaveCount(0);
}
export async function declareCreate(page: Page) {
  await page.getByRole("button", { name: "Operation contracts", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Operation contracts" });
  await form.getByLabel("Create receiver role", { exact: true }).selectOption("shorten");
  await form.getByRole("button", { name: "Declare Create link", exact: true }).click();
  await form.getByRole("tab", { name: "Callers", exact: true }).click();
  await form.getByRole("button", { name: /^Bind upload entry/ }).click();
  await form.getByRole("button", { name: "Preview operations", exact: true }).click();
  await expect(
    form.getByText("Operation declarations preview · 2 affected bindings"),
  ).toBeVisible();
  await expect(
    form.getByText(/Trusted runtime auth verifier is unspecified and unavailable/),
  ).toBeVisible();
  await form.getByRole("button", { name: /^(Upgrade & save operations|Save operations)$/ }).click();
  await expect(form).toBeHidden();
  await ready(page);
}

/** Explicit historical source alignment. These policies stay unavailable in normal forms. */
export async function alignResolveSettings(page: Page, owned = true) {
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
  await openLegacyRole(page, "Redirect service", owned);
  await expect(page.getByLabel("Request timeout", { exact: true })).toHaveCount(0);
}
export async function declareResolve(page: Page) {
  await page.getByRole("button", { name: "Operation contracts", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Operation contracts" });
  await form.getByLabel("Operation", { exact: true }).selectOption("resolve-link");
  await form.getByLabel("Resolve receiver role", { exact: true }).selectOption("redirect");
  await form.getByRole("button", { name: "Declare Resolve link", exact: true }).click();
  await form.getByRole("tab", { name: "Callers", exact: true }).click();
  await form.getByRole("button", { name: /^Bind download entry/ }).click();
  await form.getByRole("button", { name: "Preview operations", exact: true }).click();
  await expect(
    form.getByText("Operation declarations preview · 2 affected bindings", { exact: true }),
  ).toBeVisible();
  await form.getByRole("button", { name: /^(Upgrade & save operations|Save operations)$/ }).click();
  await expect(form).toBeHidden();
  await ready(page);
}
