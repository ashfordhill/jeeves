# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: front-door.spec.ts >> WD10 edits the public front door by mouse and offline chat with export parity
- Location: jeeves/apps/web/e2e/front-door.spec.ts:5:1

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator: locator('.studio-inspector').getByLabel('Front door', { exact: true })
Expected: "none"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveValue" locator('.studio-inspector').getByLabel('Front door', { exact: true }) with timeout 5000ms
  - waiting for locator('.studio-inspector').getByLabel('Front door', { exact: true })

```

```yaml
- banner:
  - text: Jeeves
  - tablist "Views":
    - tab "Design" [selected]
    - tab "Settings"
  - button "Export diagram":
    - img
    - text: Export diagram
  - button "Undo":
    - img
  - button "Redo" [disabled]:
    - img
  - button "Collapse chat" [pressed]:
    - img
  - button "Collapse inspector" [pressed]:
    - img
  - button "Generate project"
  - 'button "Project: E2E WD10 front door"': E2E WD10 front door
- main:
  - tabpanel "Design":
    - complementary "Chat rail":
      - strong: Chat
      - button "Close chat":
        - img
      - region "Design chat":
        - paragraph: Describe the app you want and the assistant draws it on the board. You can attach a Markdown brief or a sketch.
        - button "Make me a link shortener like bit.ly"
        - button "Add a cache after the selected service"
        - button "What is still undecided in this design?"
        - log "Conversation":
          - list
        - textbox "Message":
          - /placeholder: Describe what you want to build or change…
        - 'button "Design model: gpt-5.4-mini, OpenAI API"': gpt-5.4-mini
        - button "Attach"
        - button "Send" [disabled]
    - separator "Chat width"
    - application:
      - img:
        - group "User to Consume"
      - img:
        - group "Consume to Public API"
      - group "User"
      - group "Consume"
      - group "Public API":
        - text: Public API Service
        - list "Modules":
          - listitem "Echo":
            - button "Open Echo in Public API": Echo
        - button "Add module"
        - button "Add linked tile"
      - img
      - link "React Flow attribution":
        - /url: https://reactflow.dev/attribution
        - text: React Flow
    - note "Line guide": Async
    - toolbar "Canvas tools":
      - button "Pointer" [pressed]:
        - img
      - button "Connect":
        - img
      - button "Fit":
        - img
      - group "View":
        - button "Detailed" [pressed]
        - button "Simple"
    - separator "Inspector width"
    - complementary "Inspector rail":
      - strong: Inspector
      - button "Close inspector":
        - img
      - button "Back to Public API": Public API
      - form "Custom settings":
        - text: Name
        - textbox "Name": Echo
        - paragraph: Custom
        - paragraph:
          - strong: You write it
          - text: "Your own logic: you write it."
        - list "Readiness":
          - listitem: A custom component needs a one-line purpose for its generated stub.
        - text: Description
        - textbox "Description"
        - button "Remove module"
- contentinfo "Status":
  - status: Server healthy
  - button "Dark mode"
```

# Test source

```ts
  1  | import { studioStudySeedOperations } from "@jeeves/spec";
  2  | import { frontDoorDesign } from "../../../../field-projects/generator-system/fixtures/wd-front-door/design.ts";
  3  | import { createStudy, design, expect, ready, test, tile } from "./studio.ts";
  4  | 
  5  | test("WD10 edits the public front door by mouse and offline chat with export parity", async ({
  6  |   page,
  7  |   tinyurl,
  8  | }, testInfo) => {
  9  |   await expect(tile(page, "Redirect service")).toBeVisible();
  10 |   const id = await createStudy(page, "E2E WD10 front door", "blank");
  11 |   try {
  12 |     const source = frontDoorDesign();
  13 |     const ops = studioStudySeedOperations(source);
  14 |     if (source.schemaVersion !== 3 || !source.generation) throw Error("Missing generation");
  15 |     ops.push({ op: "setGeneration", generation: source.generation });
  16 |     const seeded = await page.request.post(`/api/projects/${id}/operations`, {
  17 |       data: { baseRevision: 0, source: "api", ops },
  18 |     });
  19 |     expect(seeded.ok(), await seeded.text()).toBe(true);
  20 |     await page.reload();
  21 |     await ready(page);
  22 |     await tile(page, "Public API").click();
  23 |     const field = page.locator(".studio-inspector").getByLabel("Front door", { exact: true });
> 24 |     await expect(field).toHaveValue("none");
     |                         ^ Error: expect(locator).toHaveValue(expected) failed
  25 |     await field.selectOption("required");
  26 |     await expect
  27 |       .poll(
  28 |         async () =>
  29 |           (await design(page, id)).architecture?.studio?.elements.find((e) => e.element === "front")
  30 |             ?.settings,
  31 |       )
  32 |       .toMatchObject({ frontDoor: "required" });
  33 |     const blueprintRequired = await (
  34 |       await page.request.get(`/api/projects/${id}/blueprint?version=3`)
  35 |     ).json();
  36 |     expect(
  37 |       blueprintRequired.services.find((s: { id: string }) => s.id === "front").settings.frontDoor,
  38 |     ).toBe("required");
  39 |     await page.screenshot({ path: testInfo.outputPath("wd10-mouse-required.png") });
  40 |     await field.selectOption("none");
  41 |     await expect.poll(async () => (await design(page, id)).revision).toBe(3);
  42 |     const open = page.getByRole("button", { name: "Open chat" });
  43 |     if (await open.isVisible()) await open.click();
  44 |     await page.getByLabel("Message").fill("Require the WD10 front door");
  45 |     await page.getByRole("button", { name: "Send", exact: true }).click();
  46 |     await expect(page.getByText("WD10 front door required.", { exact: true })).toBeVisible();
  47 |     await ready(page);
  48 |     await expect(field).toHaveValue("required");
  49 |     const blueprintChat = await (
  50 |       await page.request.get(`/api/projects/${id}/blueprint?version=3`)
  51 |     ).json();
  52 |     expect(blueprintChat.services.find((s: { id: string }) => s.id === "front").settings).toEqual(
  53 |       blueprintRequired.services.find((s: { id: string }) => s.id === "front").settings,
  54 |     );
  55 |     await page.getByRole("button", { name: "Generate project", exact: true }).click();
  56 |     const preview = page.waitForResponse((r) =>
  57 |       r.url().endsWith("/experimental-generation/preview"),
  58 |     );
  59 |     await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
  60 |     const result = await (await preview).json();
  61 |     expect(result.report.findings).toEqual([]);
  62 |     expect(
  63 |       result.report.processes.tiles.find((p: { tile: string }) => p.tile === "front"),
  64 |     ).toMatchObject({
  65 |       frontDoor: "required",
  66 |       environment: expect.arrayContaining([
  67 |         "JEEVES_EDGE_STAMP_KEY",
  68 |         "JEEVES_EDGE_STAMP_KEY_PREVIOUS",
  69 |       ]),
  70 |     });
  71 |     expect(tinyurl).not.toBe(id);
  72 |   } finally {
  73 |     await page.request.delete(`/api/projects/${id}`);
  74 |   }
  75 | });
  76 | 
```