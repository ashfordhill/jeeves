import {
  applyOperations,
  type DesignDocument,
  designSchema,
  type OperationInput,
} from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { expect, ready } from "./studio.ts";

export async function savedSource(page: Page): Promise<DesignDocument> {
  const id = new URL(page.url()).searchParams.get("project");
  return designSchema.parse(
    (await (await page.request.get(`/api/projects/${id}/design`)).json()).design,
  );
}
/** Explicit historical source setup; normal generation authoring exposes no declaration forms.
 * Assert the complete saved source, then reload it through the real application. */
export async function commitSource(
  page: Page,
  build: (design: DesignDocument) => { ops: OperationInput[] },
) {
  const id = new URL(page.url()).searchParams.get("project");
  const before = await savedSource(page);
  const { ops } = build(before);
  const expected = applyOperations(before, ops);
  if (!expected.ok) throw new Error(JSON.stringify(expected.errors));
  const response = await page.request.post(`/api/projects/${id}/operations`, {
    data: { baseRevision: before.revision, source: "canvas", ops },
  });
  expect(response.ok()).toBe(true);
  expect((await response.json()).design).toEqual({
    ...expected.design,
    revision: before.revision + 1,
  });
  await page.reload();
  await ready(page);
  expect(await savedSource(page)).toEqual({ ...expected.design, revision: before.revision + 1 });
}
export async function openDiagnostics(page: Page) {
  await page.getByRole("button", { name: "Export diagram", exact: true }).click();
  await page.getByRole("button", { name: "Source & diagnostics", exact: true }).click();
  return page.getByRole("dialog", { name: "Source & diagnostics", exact: true });
}
export async function selectOperation(page: Page, id: string) {
  const dialog = await openDiagnostics(page);
  await dialog.getByText(/^Operation declarations ·/).click();
  await dialog.getByRole("button", { name: `Select operation ${id}`, exact: true }).click();
  await expect(dialog).toBeHidden();
}
