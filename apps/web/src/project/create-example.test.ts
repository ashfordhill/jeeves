import {
  applyOperations,
  DEFAULT_STUDIO_EXAMPLE_ID,
  emptyDesign,
  studioArchitectureExample,
} from "@jeeves/spec";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api.ts";
import { createExampleProject, DEFAULT_EXAMPLE_ID } from "./create-example.ts";

afterEach(() => vi.restoreAllMocks());
const project = { id: "new-project", name: "New", revision: 0, updatedAt: "2026-11-07T00:00:00Z" };
it("sends the complete v3 seed once at revision zero and keeps the shared fresh default", async () => {
  vi.spyOn(api, "createProject").mockResolvedValue(project);
  const edit = vi.spyOn(api, "edit").mockImplementation(async (id, revision, ops) => {
    expect(id).toBe(project.id);
    expect(revision).toBe(0);
    const result = applyOperations(emptyDesign(), ops);
    if (!result.ok) throw new Error(JSON.stringify(result));
    expect(result.design).toEqual({
      ...studioArchitectureExample(DEFAULT_EXAMPLE_ID).design,
      revision: 1,
    });
    return {
      ok: true,
      state: {
        projectId: id,
        design: result.design,
        findings: [],
        history: { canUndo: true, canRedo: false, latestEdit: 1 },
      },
    };
  });
  expect(DEFAULT_EXAMPLE_ID).toBe(DEFAULT_STUDIO_EXAMPLE_ID);
  expect(await createExampleProject(DEFAULT_EXAMPLE_ID)).toEqual(project);
  expect(edit).toHaveBeenCalledTimes(1);
});
it.each(["refusal", "transport"])(
  "deletes only its newly created project after seed %s",
  async (mode) => {
    vi.spyOn(api, "createProject").mockResolvedValue(project);
    const edit = vi.spyOn(api, "edit");
    if (mode === "transport") edit.mockRejectedValue(new Error("transport failed"));
    else edit.mockResolvedValue({ ok: false, reason: "invalid", message: "refused", errors: [] });
    const remove = vi.spyOn(api, "deleteProject").mockResolvedValue(undefined);
    await expect(createExampleProject(DEFAULT_EXAMPLE_ID)).rejects.toThrow();
    expect(remove.mock.calls).toEqual([[project.id]]);
  },
);
it("does not delete any project when creation itself fails", async () => {
  vi.spyOn(api, "createProject").mockRejectedValue(new Error("create failed"));
  const remove = vi.spyOn(api, "deleteProject");
  await expect(createExampleProject(DEFAULT_EXAMPLE_ID)).rejects.toThrow("create failed");
  expect(remove).not.toHaveBeenCalled();
});

it("fresh open creates the complete default but requested/remembered/newest selections stay preserved", async () => {
  vi.resetModules();
  const { api: client } = await import("./api.ts");
  const { useProject } = await import("./store.ts");
  const design = studioArchitectureExample(DEFAULT_STUDIO_EXAMPLE_ID).design;
  localStorage.clear();
  const create = vi.spyOn(client, "createProject").mockResolvedValue(project);
  vi.spyOn(client, "listProjects").mockResolvedValue([]);
  vi.spyOn(client, "getProject").mockResolvedValue(project);
  vi.spyOn(client, "getDesign").mockResolvedValue({
    projectId: project.id,
    design: { ...design, revision: 1 },
    findings: [],
    history: { canUndo: true, canRedo: false, latestEdit: 1 },
  });
  vi.spyOn(client, "edit").mockImplementation(async (id, _revision, ops) => {
    const result = applyOperations(emptyDesign(), ops);
    if (!result.ok) throw new Error();
    expect(result.design).toEqual({ ...design, revision: 1 });
    return {
      ok: true,
      state: {
        projectId: id,
        design: result.design,
        findings: [],
        history: { canUndo: true, canRedo: false, latestEdit: 1 },
      },
    };
  });
  await useProject.getState().open();
  expect(useProject.getState().loaded?.design).toEqual({ ...design, revision: 1 });
  expect(create).toHaveBeenCalledTimes(1);
  await useProject.getState().open("selected-old-project");
  expect(client.getProject).toHaveBeenCalledWith("selected-old-project");
  expect(create).toHaveBeenCalledTimes(1);
  await useProject.getState().open();
  expect(create).toHaveBeenCalledTimes(1);
  localStorage.clear();
  vi.mocked(client.listProjects).mockResolvedValue([project]);
  await useProject.getState().open();
  expect(create).toHaveBeenCalledTimes(1);
  localStorage.clear();
});
