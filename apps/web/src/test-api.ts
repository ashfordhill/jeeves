/**
 * In-memory stand-in for the design API, for unit tests: one project, the builtin registry,
 * and operations applied with the real `applyOperations`.
 */
import { builtinRegistry } from "@jeeves/registry";
import {
  applyOperations,
  type DesignDocument,
  emptyDesign,
  emptyLayout,
  type LayoutDocument,
  validateDesign,
} from "@jeeves/spec";

export const TEST_PROJECT = "00000000-0000-4000-8000-000000000001";

export function fakeApi() {
  const registry = builtinRegistry();
  const state = {
    design: emptyDesign() as DesignDocument,
    layout: emptyLayout() as LayoutDocument,
    layoutPuts: 0,
    calls: [] as string[],
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
    findings: validateDesign(state.design, registry),
    history: { canUndo: state.design.revision > 0, canRedo: false },
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
      const result = applyOperations(state.design, body.ops, registry);
      if (!result.ok) {
        return json({ code: "INVALID_OPERATION", message: "invalid", errors: result.errors }, 422);
      }
      state.design = result.design;
      return json({ ...designState(), operationId: state.design.revision });
    }
    if (path === "/templates") {
      return json({
        templates: registry.list().map((m) => registry.describe(m)),
        palette: registry.palette().map(({ group, templates }) => ({
          group,
          templates: templates.map(({ id, version }) => ({ id, version })),
        })),
      });
    }
    return json({ code: "NOT_FOUND", message: `No route ${method} ${path}` }, 404);
  };

  return { state, fetch };
}
