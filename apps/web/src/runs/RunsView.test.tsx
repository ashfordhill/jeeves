import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunDetail, RunTask } from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";
import { fakeApi, TEST_PROJECT } from "../test-api.ts";
import { RunsView } from "./RunsView.tsx";
import { isLive, movedOrder } from "./store.ts";

const base = `/projects/${TEST_PROJECT}/runs`;

function task(id: number, title: string, element: string, status: RunTask["status"] = "pending") {
  return {
    id,
    position: id,
    key: element,
    element,
    attachment: null,
    title,
    description: `Build ${title}`,
    acceptance: [`${title} works`],
    ownedPaths: [`services/${element}/`],
    dependsOn: [],
    source: "planner",
    edited: false,
    status,
    attempts: [],
  } satisfies RunTask;
}

function detail(tasks: RunTask[], status: RunDetail["run"]["status"] = "planned"): RunDetail {
  return {
    run: {
      id: 7,
      projectId: TEST_PROJECT,
      status,
      statusReason: null,
      outputDir: "/tmp/shorty",
      designRevision: 1,
      planner: { mode: "refined", model: "fake-planner", message: "Split it.", usage: null },
      warnings: [],
      createdAt: "2026-10-29T10:00:00.000Z",
      startedAt: null,
      finishedAt: null,
    },
    tasks,
    actions: status === "planned" ? ["start", "replan", "cancel"] : ["pause", "cancel"],
    editable: status === "planned",
    orderProblems: [],
    usage: {
      planner: null,
      attempts: { inputTokens: 0, outputTokens: 0, known: true },
      total: { inputTokens: 0, outputTokens: 0, known: false },
    },
  };
}

/** The design fake plus a runs API with one planned run; records every runs request. */
function runsApi(ready = true) {
  const design = fakeApi();
  const calls: { method: string; path: string; body: unknown }[] = [];
  const state = { detail: detail([task(1, "Links API", "links"), task(2, "Web page", "web")]) };
  const json = (body: unknown, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const path = url.pathname.replace(/^\/api/, "");
    if (!path.startsWith(base)) return design.fetch(input, init);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: path.slice(base.length), body });
    const run = state.detail.run;
    if (path === base && method === "GET") {
      return json({
        runs: ready ? [{ ...run, taskCount: state.detail.tasks.length, doneCount: 0 }] : [],
        readiness: ready
          ? { outputDir: "/tmp/shorty", ready: true, reason: null }
          : { outputDir: null, ready: false, reason: "Generate the project first." },
      });
    }
    if (path === `${base}/7` && method === "GET") return json(state.detail);
    if (path === `${base}/7/start`) {
      state.detail = detail(state.detail.tasks, "running");
      return json({ run: state.detail.run });
    }
    if (path === `${base}/7/order`) {
      const ids = body.taskIds as number[];
      state.detail.tasks = ids.map((id) => state.detail.tasks.find((t) => t.id === id) as RunTask);
      return json(undefined, 204);
    }
    const taskPath = /\/7\/tasks\/(\d+)$/.exec(path);
    if (taskPath && method === "PATCH") {
      const id = Number(taskPath[1]);
      state.detail.tasks = state.detail.tasks.map((t) =>
        t.id === id ? { ...t, ...body, edited: true } : t,
      );
      return json({ task: state.detail.tasks.find((t) => t.id === id) });
    }
    if (taskPath && method === "DELETE") {
      state.detail.tasks = state.detail.tasks.filter((t) => t.id !== Number(taskPath[1]));
      return json(undefined, 204);
    }
    return json({ code: "NOT_FOUND", message: `No route ${method} ${path}` }, 404);
  };
  return { calls, fetch };
}

async function renderView(api: ReturnType<typeof runsApi>) {
  vi.stubGlobal("fetch", vi.fn(api.fetch));
  await useDraw.getState().open(TEST_PROJECT);
  render(
    <MantineProvider>
      <RunsView />
    </MantineProvider>,
  );
}

const taskCard = (name: string) => screen.getByRole("article", { name });

describe("Runs view", () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("explains why a project can't be planned yet", async () => {
    await renderView(runsApi(false));
    expect(await screen.findByText("Generate the project first.")).toBeTruthy();
    const plan = screen.getByRole("button", { name: "Plan a run" });
    expect(plan.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Nothing planned yet")).toBeTruthy();
  });

  it("shows the plan and reorders, edits, and removes tasks by mouse", async () => {
    const api = runsApi();
    await renderView(api);
    expect(await screen.findByRole("heading", { name: "Run 7" })).toBeTruthy();
    expect(screen.getByText(/Refined by the planner \(fake-planner\)/)).toBeTruthy();
    expect(within(taskCard("Links API")).getByText("Links API works")).toBeTruthy();
    const up = within(taskCard("Links API")).getByRole("button", { name: 'Move "Links API" up' });
    expect(up.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: 'Move "Links API" down' }));
    await waitFor(() =>
      expect(api.calls).toContainEqual({
        method: "PUT",
        path: "/7/order",
        body: { taskIds: [2, 1] },
      }),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("article").map((a) => a.querySelector("h3")?.textContent)).toEqual(
        ["Web page", "Links API"],
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: 'Edit "Web page"' }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Shorten form" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Acceptance tests/ }), {
      target: { value: "Shows a code\n\n  Lists recent links  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));
    await waitFor(() =>
      expect(api.calls).toContainEqual({
        method: "PATCH",
        path: "/7/tasks/2",
        body: {
          title: "Shorten form",
          description: "Build Web page",
          acceptance: ["Shows a code", "Lists recent links"],
        },
      }),
    );
    expect(await screen.findByText("edited")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: 'Remove "Links API"' }));
    fireEvent.click(screen.getByRole("button", { name: "Remove task" }));
    await waitFor(() => expect(screen.queryByRole("article", { name: "Links API" })).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() =>
      expect(api.calls).toContainEqual({ method: "POST", path: "/7/start", body: undefined }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Run status" }).textContent).toBe("Running"),
    );
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
  });

  it("asks before cancelling a run", async () => {
    const api = runsApi();
    await renderView(api);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel run" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(api.calls.some((c) => c.path === "/7/cancel")).toBe(false);
    expect(screen.getByRole("button", { name: "Cancel run" })).toBeTruthy();
  });
});

describe("runs store helpers", () => {
  it("moves pending tasks only, within bounds", () => {
    const d = detail([task(1, "A", "a", "done"), task(2, "B", "b"), task(3, "C", "c")]);
    expect(movedOrder(d, 3, -1)).toEqual([3, 2]);
    expect(movedOrder(d, 2, -1)).toBeUndefined();
    expect(movedOrder(d, 1, 1)).toBeUndefined();
  });

  it("polls while planning or running", () => {
    expect(isLive(detail([], "planned"))).toBe(false);
    expect(isLive(detail([], "running"))).toBe(true);
    expect(isLive(detail([task(1, "A", "a", "running")], "planned"))).toBe(true);
  });
});
