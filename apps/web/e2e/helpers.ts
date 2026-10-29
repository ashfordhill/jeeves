/** Shared e2e helpers. Each test gets its own project so tests can run in parallel. */
import { type APIRequestContext, expect, type Page } from "@playwright/test";

export async function openNewProject(page: Page, request: APIRequestContext, name: string) {
  const res = await request.post("/api/projects", { data: { name } });
  expect(res.status()).toBe(201);
  const { project } = (await res.json()) as { project: { id: string } };
  await page.goto(`/?project=${project.id}#/draw`);
  await expect(page.getByRole("toolbar", { name: "Drawing tools" })).toBeVisible();
  return project.id;
}

export async function designOf(request: APIRequestContext, id: string) {
  const res = await request.get(`/api/projects/${id}/design`);
  return (await res.json()) as {
    design: {
      revision: number;
      elements: {
        id: string;
        name: string;
        config: Record<string, unknown>;
        notes: string;
        attachments: { id: string }[];
      }[];
      connections: { kind: string }[];
    };
  };
}

export async function layoutOf(request: APIRequestContext, id: string) {
  const res = await request.get(`/api/projects/${id}/layout`);
  return ((await res.json()) as { layout: { items: Record<string, { x: number; y: number }> } })
    .layout;
}

export const card = (page: Page, name: string) => page.getByRole("article", { name });
