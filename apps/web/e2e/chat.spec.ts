import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { card, designOf, layoutOf, openNewProject } from "./helpers.ts";

/**
 * S6: the design chat against the scripted fake model (fixtures/chat/e2e-script.json). Every
 * step is a mouse click; message text is typed or picked from an example.
 */

const rail = (page: Page) => page.getByRole("complementary", { name: "Chat panel" });

async function openChat(page: Page) {
  await expect(page.getByRole("region", { name: "Architecture workspace" })).toBeVisible();
  if (!(await rail(page).isVisible()))
    await page.getByRole("button", { name: "Open chat", exact: true }).click();
  return rail(page).getByRole("region", { name: "Design chat" });
}

async function send(page: Page, text: string) {
  const chat = rail(page);
  await chat.getByRole("textbox", { name: "Message" }).fill(text);
  await chat.getByRole("button", { name: "Send" }).click();
}

test("chat subtype review requires a human click and preserves the design on Cancel", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "P3 chat review");
  const chat = await openChat(page);
  await send(page, "Make me a link shortener like bit.ly");
  await expect(chat.getByText(/I drew a link shortener/)).toBeVisible();
  await expect(chat.getByText("Applied 5 changes as one undo step")).toBeVisible();
  const before = (await designOf(request, id)).design;
  await send(page, "review subtype of links");
  let review = chat.locator(".chat-question").last();
  await expect(review).toContainText("component: links-api");
  await review.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await designOf(request, id)).design).toEqual(before);
  await send(page, "review subtype of links");
  await expect(chat.locator(".chat-question")).toHaveCount(2);
  review = chat.locator(".chat-question").last();
  await review.getByRole("button", { name: "Confirm subtype change", exact: true }).click();
  await expect
    .poll(async () => (await designOf(request, id)).design.revision)
    .toBe(before.revision + 1);
  expect((await designOf(request, id)).design.elements[0]?.attachments).toEqual([]);
  await page.locator(".editor-header").getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await designOf(request, id)).design)
    .toEqual({
      ...before,
      revision: before.revision + 2,
    });
});

test("a chat message draws a link shortener as one undo step", async ({ page, request }) => {
  const id = await openNewProject(page, request, "E2E chat");
  const chat = await openChat(page);

  // Pick the example, then send it.
  await chat.getByRole("button", { name: "Make me a link shortener like bit.ly" }).click();
  await chat.getByRole("button", { name: "Send" }).click();

  await expect(chat.getByText(/I drew a link shortener/)).toBeVisible();
  await expect(chat.getByText("Let me look at the templates.")).toBeVisible();
  await expect(chat.getByText("Applied 5 changes as one undo step")).toBeVisible();
  for (const name of ["Links service, HTTP service", "Links DB, PostgreSQL", "Web app, Web app"]) {
    await expect(card(page, name)).toBeVisible();
  }
  await expect(page.locator(".connection-chip", { hasText: "Reads and writes" })).toBeVisible();

  const saved = await designOf(request, id);
  expect(saved.design.elements.map((e) => e.id)).toEqual(["links", "links-db", "web"]);
  expect(saved.design.connections.map((c) => c.kind)).toEqual(["uses-database", "calls"]);
  // The server placed the new cards, so they have saved positions.
  expect(Object.keys((await layoutOf(request, id)).items).sort()).toEqual([
    "links",
    "links-db",
    "web",
  ]);

  // Clicking a changed item selects it on the board and opens nothing else.
  await chat.getByRole("button", { name: "Links DB", exact: true }).click();
  await expect(
    page.locator(".react-flow__node.selected", { has: card(page, "Links DB, PostgreSQL") }),
  ).toHaveCount(1);

  await page.mouse.move(1, 1);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);

  // The turn's Undo removes everything it did in one step; the toolbar's Redo brings it back.
  await chat.getByRole("button", { name: "Undo" }).click();
  await expect(card(page, "Links service, HTTP service")).toHaveCount(0);
  await expect.poll(async () => (await designOf(request, id)).design.elements).toEqual([]);
  await expect(chat.getByRole("button", { name: "Undo" })).toBeDisabled();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(card(page, "Links service, HTTP service")).toBeVisible();
  await expect.poll(async () => (await designOf(request, id)).design.elements.length).toBe(3);

  // The conversation is saved with the project.
  await page.reload();
  const reloaded = await openChat(page);
  await expect(reloaded.getByText(/I drew a link shortener/)).toBeVisible();
});

test("askUser shows clickable choices and the answer continues the conversation", async ({
  page,
  request,
}) => {
  await openNewProject(page, request, "E2E chat question");
  const chat = await openChat(page);
  await send(page, "Do people need accounts?");

  const question = chat.getByRole("group", { name: "Should people sign in?" });
  await expect(question).toBeVisible();
  await question.getByRole("button", { name: "No accounts" }).click();

  await expect(chat.getByText("Got it: no accounts, so links are public.")).toBeVisible();
  await expect(question.getByRole("button", { name: "No accounts" })).toBeDisabled();
});

test("an unknown capability becomes a needs-a-template element, and files can be attached", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "E2E chat files");
  const chat = await openChat(page);

  await chat.locator('input[type="file"]').setInputFiles({
    name: "brief.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Brief\nShort links for everyone.\n"),
  });
  await expect(
    chat.getByRole("list", { name: "Files to send" }).getByText("brief.md"),
  ).toBeVisible();
  await send(page, "Here is my brief");
  await expect(chat.getByText("I read your brief.")).toBeVisible();
  await expect(
    chat.getByRole("list", { name: "Attached files" }).getByText("brief.md"),
  ).toBeVisible();

  // Unsupported files are refused before upload, and can be removed.
  await chat.locator('input[type="file"]').setInputFiles({
    name: "brief.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7"),
  });
  await expect(chat.getByText(/Attach Markdown, text, PNG/)).toBeVisible();
  await chat.getByRole("button", { name: "Remove brief.pdf" }).click();

  await send(page, "Text me by SMS when a link gets popular");
  await expect(chat.getByText(/added an element that needs a template/)).toBeVisible();
  await expect(card(page, "SMS gateway, Needs a template")).toBeVisible();
  const saved = await designOf(request, id);
  expect(saved.design.elements).toMatchObject([{ id: "sms", template: null }]);
});

test("settings show connections and save the design and implementation models", async ({
  page,
}) => {
  await page.goto("/#/settings");
  await expect(page.getByText(/replaying a scripted fake model/)).toBeVisible();
  await expect(page.getByText("No API key", { exact: true })).toBeVisible();
  await expect(page.getByText("Coming later", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connections" })).toBeVisible();
  await expect(
    page.locator(".settings-providers").getByText("OpenCode", { exact: true }),
  ).toBeVisible();
  const codexSetup = page.getByRole("button", { name: "Copy Codex setup command" });
  await expect(codexSetup).toContainText("codex login");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await codexSetup.click();
  await expect(codexSetup).toContainText("Copied");

  // The coding role offers Codex, and the local provider only as "coming later".
  const implementationProvider = page.getByRole("combobox", {
    name: "Implementation provider",
  });
  await expect(implementationProvider).toHaveValue("codex");
  await expect(
    implementationProvider.getByRole("option", { name: "Local model (coming later)" }),
  ).toBeDisabled();

  // Runs share one settings file, so each run saves its own names.
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const designModel = `e2e-design-${suffix}`;
  const implementationModel = `e2e-code-${suffix}`;
  await page.getByRole("combobox", { name: "Design model" }).fill(designModel);
  await page.getByRole("combobox", { name: "Implementation model" }).fill(implementationModel);
  await page.getByRole("combobox", { name: "Implementation effort" }).selectOption("high");
  await page.getByRole("button", { name: "Save models" }).click();
  await expect(page.getByText(/^Saved to /)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("combobox", { name: "Design model" })).toHaveValue(designModel);
  await expect(page.getByRole("combobox", { name: "Implementation model" })).toHaveValue(
    implementationModel,
  );
  await expect(page.getByRole("combobox", { name: "Implementation effort" })).toHaveValue("high");

  // The planner moved behind Advanced and is still reachable by mouse.
  await page.getByText("Advanced", { exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Planner provider" })).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});
