import type { Page } from "@playwright/test";
import { design, expect, moveOnto, pull, ready, test, tile } from "./studio.ts";

const poolSize = async (page: Page, id: string) =>
  (await design(page, id)).architecture.studio.components.find((c) => c.name === "Link writer")
    ?.settings.poolSize;

test("autosaves a module setting, undoes and redoes it, and keeps it after reload", async ({
  page,
  tinyurl: id,
}) => {
  const inspector = page.locator(".studio-inspector");
  const pool = inspector.getByLabel("Pool size", { exact: true });
  const open = async () => {
    await tile(page, "Shorten service").click();
    await inspector.getByRole("tab", { name: "Modules", exact: true }).click();
    await inspector.getByRole("button", { name: "Link writer", exact: true }).click();
    await inspector.getByRole("tab", { name: "Options", exact: true }).click();
  };
  await open();
  await expect(pool).toHaveValue("20");
  await pool.fill("32");
  await expect.poll(() => poolSize(page, id)).toBe(32);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => poolSize(page, id)).toBe(20);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(() => poolSize(page, id)).toBe(32);

  await page.reload();
  await ready(page);
  expect(new URL(page.url()).searchParams.get("project")).toBe(id);
  await open();
  await expect(pool).toHaveValue("32");
});

test("the Type list switches a tile's kind to its presets and two languages", async ({
  page,
  tinyurl: id,
}) => {
  const inspector = page.locator(".studio-inspector");
  const types = inspector.getByRole("group", { name: "Type", exact: true });
  const settings = async (element: string) =>
    (await design(page, id)).architecture.studio.elements.find((b) => b.element === element)
      ?.settings;

  await tile(page, "Shorten service").click();
  // Each kind of the Service type by name; the current one pressed.
  await expect(types.getByRole("button")).toHaveText([
    "Microservice",
    "Worker service",
    "Redirect",
    "Identity",
    "Notifications",
    "Billing",
  ]);
  await expect(types.getByRole("button", { name: "Microservice" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await types.getByRole("button", { name: "Billing" }).click();
  await expect
    .poll(() => settings("shorten"))
    .toMatchObject({
      kind: "billing",
      provider: "stripe",
      language: "typescript",
    });
  await expect(types.getByRole("button", { name: "Billing" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(inspector.getByLabel("Language", { exact: true }).locator("option")).toHaveText([
    "TypeScript",
    "Go",
  ]);
  await inspector.getByRole("tab", { name: "Options", exact: true }).click();
  await expect(inspector.getByLabel("Payment provider", { exact: true })).toHaveValue("stripe");

  // An API tile from the Shorten action's `+` starts as a Gateway; switch it to CDN and back.
  await tile(page, "Shorten").click();
  await pull(page, "Shorten", "Add after");
  await moveOnto(
    page,
    page.locator(".board-pull").getByRole("button", { name: "API", exact: true }),
  );
  await page.mouse.up();
  await ready(page);
  await expect(types.getByRole("button", { name: "Gateway" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await types.getByRole("button", { name: "CDN" }).click();
  await expect.poll(() => settings("api")).toMatchObject({ kind: "cdn", provider: "cloudflare" });
  await types.getByRole("button", { name: "Gateway" }).click();
  await expect.poll(() => settings("api")).toMatchObject({ kind: "gateway", provider: "traefik" });
  expect(await settings("api")).not.toHaveProperty("language");
  await inspector.getByRole("tab", { name: "General", exact: true }).click();
  await expect(inspector.getByLabel("Language", { exact: true })).toHaveCount(0);
  await inspector.getByRole("tab", { name: "Options", exact: true }).click();
  await expect(inspector.getByLabel("Gateway product", { exact: true })).toHaveValue("traefik");
});
