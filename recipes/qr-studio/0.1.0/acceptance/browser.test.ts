import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { Destination } from "./_support/destinations.ts";
import { assertNoPageProblems, observePageProblems } from "./_support/page-problems.ts";
import { decodeQr } from "./_support/qr.ts";

const web = process.env.JEEVES_TEST_WEB_URL ?? "";
const api = `/_api/qrwty/api/qr`;
// Computed once per test. A run that crosses 00:00 UTC can flake, so treat this as a known limit.
const today = new Date().toISOString().slice(0, 10);

test("QR-09: register, create, edit, download and activity agree with the API", async ({
  page,
}) => {
  test.setTimeout(120_000);
  expect(web).toBeTruthy();
  const destinationA = await Destination.start("/browser-a");
  const destinationB = await Destination.start("/browser-b");
  const problems = observePageProblems(page);
  const signedOut = problems.expectHttp({
    scenario: "fresh signed-out session",
    method: "GET",
    url: `${web}/_api/qrwty/auth/session`,
    resourceType: "fetch",
    status: 401,
  });
  try {
    await page.goto(web, { waitUntil: "networkidle" });
    await expect(page.getByTestId("auth-email")).toBeVisible();
    signedOut.finish();
    const email = `qrwty-browser-${crypto.randomUUID()}@example.test`;
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill("qrwty-fixed-password");
    await page.getByTestId("auth-register").click();
    await expect(page.getByTestId("qr-create-form")).toBeVisible();

    await page.getByTestId("qr-destination").fill(destinationA.url);
    await page.getByTestId("qr-title").fill("Browser acceptance");
    await page.getByTestId("qr-create").click();
    const row = page.getByTestId("qr-row").filter({ hasText: "Browser acceptance" }).first();
    await expect(row).toBeVisible();
    const id = await row.getAttribute("data-qr-id");
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    const publicLink = row.getByTestId("qr-public-link");
    await expect(publicLink).toHaveAttribute("href", `${web}/q/${id}`);
    await expect(publicLink).toHaveText(`${web}/q/${id}`);

    const firstRedirect = await fetch(`${web}/q/${id}`, { redirect: "manual" });
    expect(firstRedirect.status).toBe(302);
    expect(firstRedirect.headers.get("location")).toBe(destinationA.url);
    await firstRedirect.arrayBuffer();

    await row.getByTestId("qr-select").click();
    await page.getByTestId("qr-edit-destination").fill(destinationB.url);
    await page.getByTestId("qr-edit-title").fill("Browser acceptance edited");
    await page.getByTestId("qr-edit-save").click();
    await expect(
      page.getByTestId("qr-row").filter({ hasText: "Browser acceptance edited" }),
    ).toBeVisible();

    for (let i = 0; i < 2; i++) {
      const redirect = await fetch(`${web}/q/${id}`, { redirect: "manual" });
      expect(redirect.status).toBe(302);
      expect(redirect.headers.get("location")).toBe(destinationB.url);
      await redirect.arrayBuffer();
    }

    const downloadStarted = page.waitForEvent("download");
    await row.getByTestId("qr-image-download").click();
    const download = await downloadStarted;
    const path = await download.path();
    expect(path).toBeTruthy();
    const png = await readFile(path as string);
    expect(decodeQr(png)).toBe(`${web}/q/${id}`);

    await row.getByTestId("qr-activity").click();
    await page.getByTestId("activity-from").fill(today);
    await page.getByTestId("activity-to").fill(today);
    await page.getByTestId("activity-apply").click();
    await expect(page.getByTestId("activity-total")).toHaveText(/3/);
    await expect(
      page.locator(`[data-testid="activity-day"][data-date="${today}"]`),
    ).toHaveAttribute("data-count", "3");

    const apiResponse = await page.request.get(
      `${web}${api}/${id}/activity?from=${today}&to=${today}`,
    );
    expect(apiResponse.status()).toBe(200);
    expect(await apiResponse.json()).toEqual({
      total: 3,
      days: [{ date: today, count: 3 }],
    });

    await page.getByTestId("auth-logout").click();
    await expect(page.getByTestId("auth-email")).toBeVisible();
    expect(destinationA.requests()).toBe(0);
    assertNoPageProblems(problems, "QR-09 browser journey");
  } finally {
    problems.stop();
    await destinationA.close();
    await destinationB.close();
  }
});
