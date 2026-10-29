/**
 * App shell: header (brand + Draw / Runs / Settings tabs), the view stage on
 * paper, and the status bar. Layout and chrome follow automation-pitch.
 * The inspector rail and canvas arrive in S4–S5.
 */
import { MantineProvider } from "@mantine/core";
import { EmptyView } from "./shell/EmptyView.tsx";
import { StatusBar } from "./shell/StatusBar.tsx";
import { useColorScheme } from "./shell/useColorScheme.ts";
import { useHashView } from "./shell/useHashView.ts";
import { useServerHealth } from "./shell/useServerHealth.ts";
import { ViewTabs } from "./shell/ViewTabs.tsx";
import type { ViewId } from "./shell/views.ts";
import { mantineTheme } from "./theme/mantineTheme.ts";
import { PaperTextureSvg } from "./theme/PaperTexture.tsx";

function ViewBody({ view }: { view: ViewId }) {
  switch (view) {
    case "draw":
      return (
        <>
          <PaperTextureSvg />
          <EmptyView title="Draw">The design canvas will live here.</EmptyView>
        </>
      );
    case "runs":
      return <EmptyView title="Runs">Orchestration runs will be listed here.</EmptyView>;
    case "settings":
      return <EmptyView title="Settings">Provider keys and models will be set here.</EmptyView>;
  }
}

export function App() {
  const [view, setView] = useHashView();
  const [scheme, setScheme] = useColorScheme();
  const health = useServerHealth();

  return (
    <MantineProvider theme={mantineTheme} forceColorScheme={scheme}>
      <header className="app-header chrome-bar">
        <span className="app-brand">Jeeves</span>
        <ViewTabs view={view} onSelect={setView} />
        <span className="app-header-end" />
      </header>
      <main className="view-stage">
        <div
          id="view-panel"
          className="view-panel"
          role="tabpanel"
          aria-labelledby={`view-tab-${view}`}
          data-view={view}
        >
          <ViewBody view={view} />
        </div>
      </main>
      <StatusBar health={health} scheme={scheme} onScheme={setScheme} />
    </MantineProvider>
  );
}
