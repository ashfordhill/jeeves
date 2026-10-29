import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptDetail, RunDetail, RunTask } from "../draw/api.ts";
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
    workspace: null,
    commit: null,
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
      gitStrategy: "branch-per-task",
      maxRetries: 2,
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
  const state = {
    detail: detail([task(1, "Links API", "links"), task(2, "Web page", "web")]),
    settings: { gitStrategy: "branch-per-task", maxRetries: 2 },
  };
  const json = (body: unknown, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const path = url.pathname.replace(/^\/api/, "");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (path === `/projects/${TEST_PROJECT}/run-settings`) {
      calls.push({ method, path: "settings", body });
      if (method === "PUT") state.settings = { ...state.settings, ...body };
      return json(state.settings);
    }
    if (!path.startsWith(base)) return design.fetch(input, init);
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
    if (path === `${base}/7/attempts/31` && method === "GET")
      return json({ attempt: attemptDetail });
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

const attemptDetail: AttemptDetail = {
  id: 31,
  number: 1,
  status: "failed",
  summary: "Added the endpoints.",
  usage: { inputTokens: 1200, outputTokens: 300, known: true },
  error: "Jeeves's checks failed. Type check: exit code 2",
  sessionId: "thr_1",
  checks: {
    ok: false,
    rejectedPaths: ["frontends/web/src/x.ts"],
    steps: [
      { step: "install", title: "Install dependencies", status: "passed", durationMs: 900 },
      {
        step: "typecheck",
        title: "Type check",
        status: "failed",
        durationMs: 300,
        message: "exit code 2",
      },
    ],
    checks: [],
  },
  changes: [{ path: "services/links/src/features/api.ts", status: "added" }],
  commit: null,
  startedAt: "2026-10-29T10:00:00.000Z",
  finishedAt: "2026-10-29T10:01:00.000Z",
  events: [
    { t: 10, kind: "log", text: "Starting a codex session" },
    { t: 900, kind: "command", text: "$ pnpm test → 0", status: "passed" },
    { t: 1500, kind: "message", text: "Added the endpoints." },
  ],
  diff: "diff --git a/x b/x\n+export const api = 1;\n",
  feedback: "fix it",
};

describe("Runs view: execution", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("saves the git strategy and retries for new runs", async () => {
    const api = runsApi();
    await renderView(api);
    const strategy = await screen.findByRole("combobox", { name: "Git strategy" });
    expect((strategy as HTMLSelectElement).value).toBe("branch-per-task");
    fireEvent.change(strategy, { target: { value: "direct" } });
    await waitFor(() =>
      expect(api.calls).toContainEqual({
        method: "PUT",
        path: "settings",
        body: { gitStrategy: "direct" },
      }),
    );
    expect(await screen.findByText(/work will go to/)).toBeTruthy();
  });

  it("shows an attempt's log, checks, changed files, and diff on demand", async () => {
    const api = runsApi();
    const failed = {
      ...task(1, "Links API", "links", "needs-attention"),
      attempts: [attemptDetail],
    };
    await renderView({
      ...api,
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await api.fetch(input, init);
        if (String(input).endsWith("/runs/7")) {
          const d = detail([failed], "needs-attention");
          return new Response(JSON.stringify({ ...d, actions: ["resume", "cancel"] }));
        }
        return res;
      },
    });
    const card = await screen.findByRole("article", { name: "Links API" });
    expect(screen.getByRole("button", { name: "Resume" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(within(card).getByRole("button", { name: /Attempt 1: failed/ }));
    expect(await within(card).findByText("Starting a codex session")).toBeTruthy();
    expect(within(card).getByText("$ pnpm test → 0")).toBeTruthy();
    fireEvent.click(within(card).getByRole("tab", { name: "Checks" }));
    expect(await within(card).findByText(/Type check: failed/)).toBeTruthy();
    expect(within(card).getByText("frontends/web/src/x.ts")).toBeTruthy();
    fireEvent.click(within(card).getByRole("tab", { name: "Changes (1)" }));
    expect(await within(card).findByText("services/links/src/features/api.ts")).toBeTruthy();
    expect(within(card).getByText("+export const api = 1;")).toBeTruthy();
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
