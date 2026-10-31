import { expect, test } from "@playwright/test";
import { observePageProblems } from "./_support/page-problems.ts";

const web = process.env.JEEVES_TEST_WEB_URL ?? "";
test("QR-16: Analytics ranges, daily table and Studio navigation work by mouse", async ({
  page,
  request,
}) => {
  const problems = observePageProblems(page);
  const signedOut = problems.expectHttp({
    scenario: "fresh analytics session",
    method: "GET",
    url: `${web}/_api/qrwty/auth/session`,
    resourceType: "fetch",
    status: 401,
  });
  try {
    await page.goto(web, { waitUntil: "networkidle" });
    await expect(page.getByTestId("auth-email")).toBeVisible();
    signedOut.finish();
    await page.getByTestId("auth-email").fill(`analytics-${crypto.randomUUID()}@example.test`);
    await page.getByTestId("auth-password").fill("qrwty-fixed-password");
    await page.getByTestId("auth-register").click();
    await page.getByTestId("qr-destination").fill("https://example.test/analytics");
    await page.getByTestId("qr-title").fill("Analytics journey");
    await page.getByTestId("qr-create").click();
    const row = page.getByTestId("qr-row").filter({ hasText: "Analytics journey" });
    await expect(row).toBeVisible();
    const id = await row.getAttribute("data-qr-id");
    await page.getByRole("link", { name: "Analytics", exact: true }).click();
    await expect(page.getByTestId("analytics-total")).toHaveText("0");
    await expect(page.getByText("Your next scan starts the story.")).toBeVisible();
    const scan = await request.get(`${web}/q/${id}`, { maxRedirects: 0 });
    expect(scan.status()).toBe(302);
    await scan.body();
    await page.getByRole("button", { name: "Refresh analytics" }).click();
    await expect(page.getByTestId("analytics-total")).toHaveText("1");
    await page.getByRole("button", { name: "Last 7 days", exact: true }).click();
    await expect(page.getByTestId("analytics-result-range")).toContainText("7 days");
    await page.getByText("View daily counts", { exact: true }).click();
    await expect(page.getByRole("table", { name: /Scans over time/ })).toBeVisible();
    await page.getByRole("link", { name: /Analytics journey.*Studio/ }).click();
    await expect(page.getByTestId("studio-preview")).toBeVisible();
    problems.assert("Analytics acceptance");
  } finally {
    problems.stop();
  }
});
