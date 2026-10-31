import { mkdirSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { PageProblems } from "@jeeves/template-kit/browser";
import { expect, type Page } from "@playwright/test";

export async function proveResourceWorkspace(
  page: Page,
  problems: PageProblems,
  origin: string,
  evidence: string,
  options: {
    beforePaper?: () => Promise<void>;
    stateLabel?: string;
    onStage?: (stage: string) => void;
  } = {},
) {
  mkdirSync(evidence, { recursive: true });
  options.onStage?.("account restoration and registration");
  const api = `${origin}/_api/inventory`;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route(
    `${api}/auth/session`,
    (route) =>
      route.fulfill({
        status: 500,
        json: { error: "SERVICE_UNAVAILABLE", message: "Disposable failure" },
      }),
    { times: 1 },
  );
  const unavailable = problems.expectHttp({
    scenario: "session service unavailable",
    method: "GET",
    url: `${api}/auth/session`,
    resourceType: "fetch",
    status: 500,
  });
  await page.goto(origin);
  await expect(page.getByRole("button", { name: "Retry connection", exact: true })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  unavailable.finish();
  const anonymous = problems.expectHttp({
    scenario: "new visitor has no session",
    method: "GET",
    url: `${api}/auth/session`,
    resourceType: "fetch",
    status: 401,
  });
  await page.getByRole("button", { name: "Retry connection", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  anonymous.finish();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: join(evidence, "account.png"), animations: "disabled" });
  const suffix = crypto.randomUUID().slice(0, 8),
    password = "inventory-proof-password";
  const signIn = async (email: string, register: boolean) => {
    if (register)
      await page.getByRole("button", { name: "Create an account", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: register ? "Create account" : "Sign in", exact: true })
      .click();
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  };
  const alice = `alice-${suffix}@example.test`;
  await signIn(alice, true);
  await expect(page.getByRole("heading", { name: "No warehouses yet", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New record", exact: true }).first().click();
  let dialog = page.getByRole("dialog", { name: "New Warehouse", exact: true });
  await dialog.getByLabel(/^Name/).fill("Main warehouse");
  await dialog.getByLabel(/^Website/).fill("https://warehouse.example.test");
  await dialog.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "View Main warehouse", exact: true }),
  ).toBeVisible();
  const session = await (await page.request.get(`${api}/auth/session`)).json();
  const headers = { Origin: origin, "X-CSRF-Token": session.csrfToken };
  const rows = await (await page.request.get(`${api}/api/warehouse?limit=10`)).json();
  const warehouse = rows.items[0];
  for (let i = 1; i <= 11; i++)
    expect(
      (
        await page.request.post(`${api}/api/warehouse`, {
          headers,
          data: { name: `Depot ${String(i).padStart(2, "0")}`, website: null },
        })
      ).status(),
    ).toBe(201);
  options.onStage?.("stock item creation");
  await page.getByRole("link", { name: "Stock items", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No stock items yet", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New record", exact: true }).first().click();
  dialog = page.getByRole("dialog", { name: "New Stock item", exact: true });
  await dialog.getByLabel(/^Title/).fill("First widget");
  await dialog.getByLabel(/^Quantity/).fill("7");
  await dialog
    .getByLabel(new RegExp(`^${options.stateLabel ?? "Status"}`))
    .selectOption("available");
  await dialog.getByLabel(/^Notes/).fill("Original note");
  await expect(dialog.getByRole("button", { name: "Next choices", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Next choices", exact: true }).click();
  await expect(dialog.getByRole("option", { name: "Main warehouse", exact: true })).toHaveCount(1);
  await dialog.getByLabel(/^Warehouse/).selectOption({ label: "Main warehouse" });
  await expect(dialog.getByLabel(/^Recorded at/)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: join(evidence, "record-form.png"), animations: "disabled" });
  await dialog.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "View First widget", exact: true })).toBeVisible();
  const items = await (await page.request.get(`${api}/api/stockItem?limit=10`)).json();
  const item = items.items[0];
  expect(item).toMatchObject({
    title: "First widget",
    quantity: 7,
    state: "available",
    notes: "Original note",
    warehouseId: warehouse.id,
  });
  expect(item.recordedAt).toBeTruthy();
  options.onStage?.("record paging and edit");
  for (let i = 1; i <= 10; i++)
    expect(
      (
        await page.request.post(`${api}/api/stockItem`, {
          headers,
          data: {
            title: `Stock ${i}`,
            quantity: i,
            state: "available",
            notes: null,
            warehouseId: warehouse.id,
          },
        })
      ).status(),
    ).toBe(201);
  await page.getByRole("button", { name: "Refresh records", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next page", exact: true })).toBeEnabled();
  await expect(page.getByText("10 records on this page", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByRole("button", { name: "View First widget", exact: true })).toBeVisible();
  await expect(page.getByText("1 record on this page", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit First widget", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Edit Stock item", exact: true });
  await dialog.getByLabel(/^Title/).fill("Discarded name");
  await expect(dialog.getByRole("button", { name: "Next choices", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "View First widget", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View First widget", exact: true }).click();
  const details = page.getByRole("dialog", { name: "First widget", exact: true });
  await expect(details.getByText("Original note", { exact: true })).toBeVisible();
  await details.getByRole("button", { name: "Edit record", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Edit Stock item", exact: true });
  await dialog.getByLabel(/^Quantity/).fill("8");
  const mutation = page.waitForRequest((request) => request.method() === "PATCH");
  await dialog.getByRole("button", { name: "Save record", exact: true }).click();
  expect((await mutation).postDataJSON()).toEqual({
    title: "First widget",
    quantity: 8,
    state: "available",
    warehouseId: warehouse.id,
  });
  await expect(dialog).not.toBeVisible();
  expect(await (await page.request.get(`${api}/api/stockItem/${item.id}`)).json()).toMatchObject({
    quantity: 8,
    notes: "Original note",
    recordedAt: item.recordedAt,
    warehouseId: warehouse.id,
  });
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(page.getByText("10 records on this page", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: join(evidence, "workspace-midnight.png"), animations: "disabled" });
  options.onStage?.("Paper regeneration and narrow form");
  if (options.beforePaper) {
    await options.beforePaper();
    // The hash route is unchanged: explicitly load the newly generated application bundle.
    await page.reload();
  } else await page.goto(`${origin}/?theme=paper#collection/stock-item`);
  await expect(page.locator(".jrw-root")).toHaveAttribute("data-preset", "paper");
  await expect(page.getByText("10 records on this page", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: join(evidence, "workspace-paper.png"), animations: "disabled" });
  await page.setViewportSize({ width: 480, height: 900 });
  expect(await page.evaluate("document.documentElement.scrollWidth <= innerWidth")).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: join(evidence, "workspace-narrow.png"), animations: "disabled" });
  await page.getByRole("button", { name: "New record", exact: true }).first().click();
  dialog = page.getByRole("dialog", { name: "New Stock item", exact: true });
  await expect(dialog.getByRole("button", { name: "Save record", exact: true })).toBeInViewport();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: join(evidence, "record-form-narrow.png"), animations: "disabled" });
  await expect(dialog.getByRole("button", { name: "Next choices", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  options.onStage?.("session revocation");
  // Revoke the browser's session outside the mounted UI, then exercise its protected read.
  const expired = problems.expectHttp({
    scenario: "revoked session clears private workspace",
    method: "GET",
    url: `${api}/api/stockItem?limit=10`,
    resourceType: "fetch",
    status: 401,
  });
  expect((await page.request.post(`${api}/auth/logout`, { headers })).status()).toBe(204);
  await page.getByRole("button", { name: "Refresh records", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  expired.finish();
  await expect(page.getByRole("region", { name: "Stock items records", exact: true })).toHaveCount(
    0,
  );
  options.onStage?.("re-login and explicit logout");
  await signIn(alice, false);
  await expect(page.getByText("10 records on this page", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  options.onStage?.("second account isolation");
  await signIn(`bob-${suffix}@example.test`, true);
  await expect(
    page.getByRole("heading", { name: "No stock items yet", exact: true }),
  ).toBeVisible();
  options.onStage?.("second account loaded; independent owner check");
  expect((await page.request.get(`${api}/api/stockItem/${item.id}`)).status()).toBe(404);
  options.onStage?.("second account switches collection");
  await page.getByRole("link", { name: "Warehouses", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No warehouses yet", exact: true })).toBeVisible();
  expect(await page.evaluate("localStorage.length + sessionStorage.length")).toBe(0);
  await expect(
    page.getByText("Fieldwork inventory help · project content", { exact: true }),
  ).toBeVisible();
  problems.assert(
    "Compiled resource workspace: accounts, owner data, forms, paging and narrow accessibility",
  );
  return [
    "account access",
    "owner isolation",
    "resource forms",
    "relationship paging",
    "record paging",
    "session lifecycle and responsive accessibility",
  ];
}
