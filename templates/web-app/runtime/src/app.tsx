import {
  Component,
  createContext,
  type ErrorInfo,
  type ReactNode,
  StrictMode,
  useContext,
} from "react";
import { createRoot } from "react-dom/client";
import {
  CONFIG_URL,
  loadRuntimeConfig,
  type RuntimeConfig,
  STATUS_PATH,
  setRuntimeConfig,
} from "./config.ts";
import { StatusPage } from "./status.tsx";

/** The app as the design describes it; written by Jeeves into `src/jeeves.generated.ts`. */
export interface AppDefinition<Apis extends Record<string, unknown> = Record<string, unknown>> {
  /** The element ID. */
  name: string;
  /** The design's title, used until the runtime config is loaded. */
  title: string;
  /** Generated API clients (rest-api-client attachments), by target element ID. */
  apis: Apis;
}

export function defineApp<Apis extends Record<string, unknown>>(
  definition: AppDefinition<Apis>,
): AppDefinition<Apis> {
  return definition;
}

interface JeevesContextValue {
  config: RuntimeConfig;
  apis: Record<string, unknown>;
}

const JeevesContext = createContext<JeevesContextValue | undefined>(undefined);

/**
 * Provides the runtime config and the API clients to components. `startApp` renders it; tests
 * render it themselves to pass a config and fake clients.
 */
export function JeevesProvider(props: {
  config: RuntimeConfig;
  apis: Record<string, unknown>;
  children?: ReactNode;
}) {
  return (
    <JeevesContext.Provider value={{ config: props.config, apis: props.apis }}>
      {props.children}
    </JeevesContext.Provider>
  );
}

function useJeeves(hook: string): JeevesContextValue {
  const value = useContext(JeevesContext);
  if (!value) throw new Error(`${hook}() must be used inside <JeevesProvider> (startApp adds it)`);
  return value;
}

export function useRuntimeConfig(): RuntimeConfig {
  return useJeeves("useRuntimeConfig").config;
}

/** The app's API clients: `const { links } = useApis<typeof app.apis>()`. */
export function useApis<Apis extends Record<string, unknown> = Record<string, unknown>>(): Apis {
  return useJeeves("useApis").apis as Apis;
}

interface ErrorBoundaryProps {
  children?: ReactNode;
  /** Renders instead of the children after an error; `reset` tries them again. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

/**
 * Catches errors thrown while rendering, so one broken component shows a message instead of a
 * blank page. `startApp` wraps the whole app in one; add more around risky parts.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | undefined }> {
  override state: { error: Error | undefined } = { error: undefined };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Rendering failed:", error, info.componentStack);
  }

  reset = () => this.setState({ error: undefined });

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div role="alert" className="jeeves-error">
        <h1>Something went wrong</h1>
        <p>{error.message}</p>
        <button type="button" onClick={this.reset}>
          Try again
        </button>
      </div>
    );
  }
}

/** What `startApp` exposes on `window.__JEEVES__`, for test packs and debugging. */
export interface JeevesGlobal {
  app: string;
  config: RuntimeConfig;
  apis: Record<string, unknown>;
}

export interface StartAppOptions {
  /** Defaults to the element with ID `root`. */
  element?: HTMLElement | null;
  configUrl?: string;
}

/**
 * Starts the app: loads the runtime config, sets the page title, and renders `root` inside the
 * provider and an error boundary. At `/_jeeves/status` it renders the status page instead.
 */
export async function startApp(
  app: AppDefinition,
  root: ReactNode,
  options: StartAppOptions = {},
): Promise<void> {
  const element = options.element ?? document.getElementById("root");
  if (!element) throw new Error('startApp: no element with id "root" to render into');
  const reactRoot = createRoot(element);
  let config: RuntimeConfig;
  try {
    config = await loadRuntimeConfig(options.configUrl ?? CONFIG_URL);
  } catch (error) {
    reactRoot.render(
      <div role="alert" className="jeeves-error">
        <h1>{app.title} can't start</h1>
        <p>{(error as Error).message}</p>
      </div>,
    );
    throw error;
  }
  setRuntimeConfig(config);
  document.title = config.title || app.title;
  const global: JeevesGlobal = { app: app.name, config, apis: app.apis };
  (window as unknown as { __JEEVES__: JeevesGlobal }).__JEEVES__ = global;
  const page = window.location.pathname === STATUS_PATH ? <StatusPage app={app.name} /> : root;
  reactRoot.render(
    <StrictMode>
      <JeevesProvider config={config} apis={app.apis}>
        <ErrorBoundary>{page}</ErrorBoundary>
      </JeevesProvider>
    </StrictMode>,
  );
}
