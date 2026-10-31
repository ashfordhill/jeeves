import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { assertNoPageProblems, observePageProblems } from "./_support/page-problems.ts";
import { decodeQr, sha256 } from "./_support/qr.ts";

const web = process.env.JEEVES_TEST_WEB_URL ?? "";

test("QR-14: Studio presets, immutable exports and draft recovery work by mouse", async ({
  page,
}) => {
  test.setTimeout(120_000);
  expect(web).toBeTruthy();
  const problems = observePageProblems(page);
  const signedOut = problems.expectHttp({
    scenario: "fresh Studio acceptance session",
    method: "GET",
    url: `${web}/_api/qrwty/auth/session`,
    resourceType: "fetch",
    status: 401,
  });
  let workers = 0;
  page.on("worker", () => workers++);
  try {
    await page.goto(web, { waitUntil: "networkidle" });
    await expect(page.getByTestId("auth-email")).toBeVisible();
    signedOut.finish();
    await page.getByTestId("auth-email").fill(`studio-${crypto.randomUUID()}@example.test`);
    await page.getByTestId("auth-password").fill("qrwty-fixed-password");
    await page.getByTestId("auth-register").click();
    await page.getByTestId("qr-destination").fill("https://example.test/studio-browser");
    await page.getByTestId("qr-title").fill("Studio journey");
    await page.getByTestId("qr-create").click();
    const row = page.getByTestId("qr-row").filter({ hasText: "Studio journey" }).first();
    await expect(row).toBeVisible();
    const id = await row.getAttribute("data-qr-id");
    await row.getByTestId("studio-open").click();
    await expect(page.getByTestId("studio-preview")).toBeVisible();
    await expect(page.getByTestId("studio-export-png")).toBeDisabled();
    await page.getByRole("button", { name: "Forest Canopy", exact: true }).click();
    await expect(page.getByTestId("studio-foreground")).toHaveValue("#193F35");
    await page.getByTestId("studio-save").click();
    await expect(page.getByTestId("studio-export-png")).toBeEnabled();
    const downloads: Record<string, string> = {};
    for (const format of ["png", "svg"]) {
      const pending = page.waitForEvent("download");
      await page.getByTestId(`studio-export-${format}`).click();
      const download = await pending;
      const path = await download.path();
      expect(path).toBeTruthy();
      const bytes = await readFile(path as string);
      downloads[format] = sha256(bytes);
      if (format === "png") expect(decodeQr(bytes)).toBe(`${web}/q/${id}`);
      else expect(bytes.toString()).toMatch(/^<svg /);
    }
    await page.getByTestId("studio-foreground").fill("#132C25");
    await expect(page.getByTestId("studio-export-png")).toBeDisabled();
    await page.getByRole("link", { name: "QR library", exact: true }).click();
    await row.getByTestId("studio-open").click();
    await expect(page.getByTestId("studio-foreground")).toHaveValue("#132C25");
    await expect(page.getByTestId("studio-export-png")).toBeDisabled();
    await page.getByTestId("studio-reset").click();
    await page.getByRole("button", { name: "Discard changes", exact: true }).click();
    await expect(page.getByTestId("studio-foreground")).toHaveValue("#193F35");
    await expect(page.getByTestId("studio-export-png")).toBeEnabled();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("studio-export-png")).toBeEnabled();
    const pending = page.waitForEvent("download");
    await page.getByTestId("studio-export-png").click();
    const download = await pending;
    expect(sha256(await readFile((await download.path()) as string))).toBe(downloads.png);
    expect(workers).toBe(0);
    assertNoPageProblems(problems, "QR-14 Studio workflow");
  } finally {
    problems.stop();
  }
});
