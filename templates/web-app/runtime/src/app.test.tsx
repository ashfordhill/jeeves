import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defineApp,
  ErrorBoundary,
  JeevesProvider,
  startApp,
  useApis,
  useRuntimeConfig,
} from "./app.tsx";
import { setRuntimeConfig } from "./config.ts";

const config = { title: "Links (local)", apis: { links: { url: "/_api/links" } } };

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify(config)));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  setRuntimeConfig(undefined);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

function Title() {
  return <h1>{useRuntimeConfig().title}</h1>;
}

const fakeLinks = {
  GET: vi.fn(async (path: string) => ({
    data: { message: `pong from ${path}` },
    response: new Response(null, { status: 200 }),
  })),
};
const app = defineApp({ name: "web", title: "Links", apis: { links: fakeLinks } });

describe("startApp", () => {
  it("loads the runtime config, sets the title, and renders the app with its clients", async () => {
    await act(() => startApp(app, <Title />));
    expect(await screen.findByRole("heading", { name: "Links (local)" })).toBeTruthy();
    expect(document.title).toBe("Links (local)");
    const global = (window as unknown as { __JEEVES__: { app: string; apis: unknown } }).__JEEVES__;
    expect(global.app).toBe("web");
    expect(global.apis).toEqual({ links: fakeLinks });
  });

  it("shows why the app can't start when the config is missing", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }));
    await act(() => expect(startApp(app, <Title />)).rejects.toThrow("404"));
    expect((await screen.findByRole("alert")).textContent).toContain("Links can't start");
  });

  it("renders the status page at /_jeeves/status and calls the API from the query", async () => {
    window.history.replaceState(null, "", "/_jeeves/status?api=links&path=/ping?message=hi");
    await act(() => startApp(app, <Title />));
    await waitFor(() => expect(document.querySelector("[data-jeeves-result]")).not.toBeNull());
    const result = document.querySelector('[data-jeeves-result="links"]');
    expect(JSON.parse(result?.textContent ?? "")).toEqual({
      status: 200,
      data: { message: "pong from /ping?message=hi" },
    });
    expect(result?.getAttribute("data-jeeves-ok")).toBe("true");
    expect(fakeLinks.GET).toHaveBeenCalledWith("/ping?message=hi");
  });
});

describe("the status page form", () => {
  it("calls the chosen API by mouse and shows typed errors", async () => {
    const failing = {
      GET: async () => {
        throw Object.assign(new Error("no answer"), {
          name: "RestClientTimeoutError",
          code: "TIMEOUT",
        });
      },
    };
    window.history.replaceState(null, "", "/_jeeves/status");
    await act(() =>
      startApp(defineApp({ name: "web", title: "x", apis: { slow: failing } }), null),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Call" }));
    await waitFor(() =>
      expect(document.querySelector('[data-jeeves-result="slow"]')).not.toBeNull(),
    );
    const result = document.querySelector('[data-jeeves-result="slow"]');
    expect(JSON.parse(result?.textContent ?? "")).toEqual({
      error: "TIMEOUT",
      message: "no answer",
    });
    expect(result?.getAttribute("data-jeeves-ok")).toBe("false");
  });
});

describe("JeevesProvider", () => {
  it("gives components the config and (fake) clients", () => {
    function Uses() {
      const { links } = useApis<{ links: string }>();
      return <p>{`${useRuntimeConfig().title} via ${links}`}</p>;
    }
    render(
      <JeevesProvider config={config} apis={{ links: "fake" }}>
        <Uses />
      </JeevesProvider>,
    );
    expect(screen.getByText("Links (local) via fake")).toBeTruthy();
  });

  it("explains a hook used outside it", () => {
    expect(() => render(<Title />)).toThrow(
      "useRuntimeConfig() must be used inside <JeevesProvider>",
    );
  });
});

describe("ErrorBoundary", () => {
  it("shows the error instead of a blank page, and tries again on click", () => {
    let fail = true;
    function Flaky() {
      if (fail) throw new Error("broken component");
      return <p>recovered</p>;
    }
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain("broken component");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("recovered")).toBeTruthy();
  });
});
