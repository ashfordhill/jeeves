/**
 * App shell: header (brand, Design / Settings tabs, project menu), the view stage on
 * paper, and the status bar. Layout and chrome follow automation-pitch. The design view lays out
 * its own inspector rail.
 */
import { MantineProvider } from "@mantine/core";
import { DesignView } from "./project/DesignView.tsx";
import { ProjectMenu } from "./project/ProjectMenu.tsx";
import { SettingsView } from "./settings/SettingsView.tsx";
import { StatusBar } from "./shell/StatusBar.tsx";
import { useColorScheme } from "./shell/useColorScheme.ts";
import { useHashView } from "./shell/useHashView.ts";
import { useServerHealth } from "./shell/useServerHealth.ts";
import { ViewTabs } from "./shell/ViewTabs.tsx";
import type { ViewId } from "./shell/views.ts";
import { mantineTheme } from "./theme/mantineTheme.ts";

function ViewBody({ view }: { view: ViewId }) {
  switch (view) {
    case "design":
      return <DesignView />;
    case "settings":
      return <SettingsView />;
  }
}

export function App() {
  const [view, setView] = useHashView();
  const [scheme, setScheme] = useColorScheme();
  const health = useServerHealth();

  return (
    <MantineProvider theme={mantineTheme} forceColorScheme={scheme}>
      <header className="app-header chrome-bar studio-app-header">
        <span className="app-brand">Jeeves</span>
        <ViewTabs view={view} onSelect={setView} />
        {view === "design" ? <div id="studio-header-controls" /> : null}
        <span className="app-header-end">
          <ProjectMenu />
        </span>
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
