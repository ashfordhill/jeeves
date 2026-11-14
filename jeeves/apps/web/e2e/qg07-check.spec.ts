/**
 * QG07's mouse check (temporary): a stub publishing to a Queue, the Queue's Provider set to Google
 * Cloud in its Options, and Generate project's Preview saying the queue is a Pub/Sub topic.
 */
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import {
  addModuleFrom,
  createStudy,
  design,
  dragOnto,
  expect,
  pickFrom,
  ready,
  stillBoard,
  test,
  tile,
} from "./studio.ts";

const inspector = (page: Page) => page.locator(".studio-inspector");
const dot = (page: Page, module: string) =>
  page.locator(`.board .lane-container-row[data-module="${module}"] .lane-container-row-dot`);
const evidence = fileURLToPath(
  new URL("../../../../docs/plans/qrwty-gaps/evidence/qg07", import.meta.url),
);

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test("sets a stub-only Queue's Provider to Google Cloud and previews its Pub/Sub topic", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      const id = await createStudy(page, `E2E QG07 ${viewport.width}`, "blank", "Simple");
      const provider = async () =>
        (await design(page, id)).architecture.studio.elements.find(
          (row) => row.element === "message-channel",
        )?.settings as Record<string, unknown> | undefined;
      try {
        await pickFrom(page, "User", "Add action", "Consume");
        await ready(page);
        for (const [from, kind] of [
          ["Consume", "Microservice"],
          ["Microservice", "Message channel"],
        ]) {
          await stillBoard(page);
          await tile(page, from).click();
          await pickFrom(page, from, "Add linked tile", kind);
          await expect(tile(page, kind)).toHaveClass(/selected/);
          await ready(page);
        }
        // A stub publishing to the queue: an Event publisher connected to it in Connect mode.
        await tile(page, "Microservice").click();
        await addModuleFrom(page, tile(page, "Microservice"), "Event publisher");
        await page.getByRole("button", { name: "Detailed", exact: true }).click();
        await ready(page);
        await page.getByRole("button", { name: "Connect", exact: true }).click();
        await dragOnto(page, dot(page, "microservice-event-publisher"), tile(page, "Message channel"));
        await page.mouse.up();
        await expect(dot(page, "microservice-event-publisher")).toHaveAttribute(
          "data-connected",
          "true",
        );
        await page.getByRole("button", { name: "Pointer", exact: true }).click();
        // Off, the queue's Provider is no control.
        await tile(page, "Message channel").click();
        const select = inspector(page).getByLabel("Provider", { exact: true });
        await expect(select).toHaveCount(0);
        const generate = page.getByRole("button", { name: "Generate project", exact: true });
        const dialog = page.getByRole("dialog", { name: "Generate experimental project" });
        await generate.click();
        const box = dialog.getByRole("checkbox", { name: "Runnable processes" });
        await box.click();
        await expect(box).toBeChecked();
        await dialog.getByRole("button", { name: "Close generate experimental project" }).click();
        // On: Provider offers exactly what its stubs' processes run.
        await tile(page, "Message channel").click();
        await expect(select).toBeVisible();
        await expect(select).toHaveValue("unspecified");
        expect(await select.locator("option").allTextContents()).toEqual([
          "Unspecified",
          "Self-hosted",
          "Google Cloud",
        ]);
        await select.selectOption({ label: "Google Cloud" });
        await expect.poll(async () => (await provider())?.provider).toBe("google-cloud");
        await expect(select).toHaveValue("google-cloud");
        await page.screenshot({ path: `${evidence}/options-${viewport.width}.png` });
        // Preview: the publisher's row says the queue is a Pub/Sub topic.
        await generate.click();
        const result = page.waitForResponse((response) =>
          response.url().endsWith("/experimental-generation/preview"),
        );
        await dialog.getByRole("button", { name: "Preview scaffold", exact: true }).click();
        const preview = await (await result).json();
        expect(
          preview.report.processes.tiles.find(
            (row: { tile: string }) => row.tile === "microservice",
          ).stores,
        ).toEqual([
          expect.objectContaining({
            store: "message-channel",
            kind: "queue",
            access: "publish",
            provisioned:
              "Google Cloud Pub/Sub topic message-channel (locally the emulator local-pubsub)",
          }),
        ]);
        const row = dialog
          .getByRole("list", { name: "Runnable processes", exact: true })
          .getByRole("listitem")
          .filter({ hasText: "app-microservice" });
        await expect(row).toContainText("Provisioned: Message channel (queue, publish)");
        await row.getByText("Provisioned as", { exact: true }).click();
        await expect(
          row.getByText(
            "Message channel: Google Cloud Pub/Sub topic message-channel (locally the emulator local-pubsub)",
            { exact: true },
          ),
        ).toBeVisible();
        await row.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${evidence}/preview-${viewport.width}.png` });
        await dialog.getByRole("button", { name: "Close generate experimental project" }).click();
      } finally {
        await page.request.delete(`/api/projects/${id}`);
      }
      expect(errors).toEqual([]);
    });
  });
}
