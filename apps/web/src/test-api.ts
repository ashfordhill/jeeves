/**
 * In-memory stand-in for the design API, for unit tests: one project,
 * operations applied with the real `applyOperations`, and the server's linear undo/redo.
 */
import {
  applyOperations,
  buildStudioCommand,
  createStudioSettings,
  type DesignDocument,
  emptyDesign,
  emptyLayout,
  type LayoutDocument,
  type OperationInput,
  validateDesign,
} from "@jeeves/spec";

export const TEST_PROJECT = "00000000-0000-4000-8000-000000000001";

/** The ops that add one studio service to `design`. */
export function serviceOps(design: DesignDocument, id: string, name = id): OperationInput[] {
  return buildStudioCommand(design, {
    type: "create",
    system: { name: "System" },
    elements: [{ id, name, settings: createStudioSettings("service") }],
  }).ops;
}

export function fakeApi() {
  const state = {
    design: emptyDesign() as DesignDocument,
    layout: emptyLayout() as LayoutDocument,
    layoutPuts: 0,
    calls: [] as string[],
    /** Snapshots before/after each applied edit, and the edits undone (newest last). */
    done: [] as { before: DesignDocument; after: DesignDocument }[],
    undone: [] as { before: DesignDocument; after: DesignDocument }[],
  };
  const project = () => ({
    id: TEST_PROJECT,
    name: "Test design",
    revision: state.design.revision,
    updatedAt: "2026-10-28T00:00:00.000Z",
  });
  const designState = () => ({
    projectId: TEST_PROJECT,
    design: state.design,
    findings: validateDesign(state.design),
    history: {
      canUndo: state.done.length > 0,
      canRedo: state.undone.length > 0,
      latestEdit: state.done.length || null,
    },
  });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/api/, "");
    state.calls.push(`${method} ${path}`);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const projectPath = `/projects/${TEST_PROJECT}`;

    if (path === "/health") return json({ status: "ok" });
    if (path === "/projects") return json({ projects: [project()] });
    if (path === projectPath) return json({ project: project() });
    if (path === `${projectPath}/design`) return json(designState());
    if (path === `${projectPath}/layout` && method === "GET") return json({ layout: state.layout });
    if (path === `${projectPath}/layout` && method === "PUT") {
      state.layout = body;
      state.layoutPuts++;
      return json({ layout: body });
    }
    if (path === `${projectPath}/operations`) {
      if (body.baseRevision !== state.design.revision) {
        return json({ code: "REVISION_CONFLICT", message: "stale", ...designState() }, 409);
      }
      const result = applyOperations(state.design, body.ops);
      if (!result.ok) {
        return json({ code: "INVALID_OPERATION", message: "invalid", errors: result.errors }, 422);
      }
      state.done.push({ before: state.design, after: result.design });
      state.undone = [];
      state.design = result.design;
      return json({ ...designState(), operationId: state.design.revision });
    }
    if (path === `${projectPath}/undo` || path === `${projectPath}/redo`) {
      if (body.baseRevision !== state.design.revision) {
        return json({ code: "REVISION_CONFLICT", message: "stale", ...designState() }, 409);
      }
      const undo = path.endsWith("/undo");
      const step = undo ? state.done.pop() : state.undone.pop();
      if (!step) return json({ code: "NOTHING_TO_UNDO", message: "Nothing to undo." }, 422);
      (undo ? state.undone : state.done).push(step);
      const snapshot = undo ? step.before : step.after;
      state.design = { ...snapshot, revision: state.design.revision + 1 };
      return json({ ...designState(), operationId: state.design.revision });
    }
    return json({ code: "NOT_FOUND", message: `No route ${method} ${path}` }, 404);
  };

  return { state, fetch };
}
