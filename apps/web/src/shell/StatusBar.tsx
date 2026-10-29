/**
 * Full-width bottom status bar, adapted from automation-pitch's StatusBar:
 * server health on the left; color scheme and version on the right.
 */
import { IconMoon, IconSun } from "@tabler/icons-react";
import type { ColorScheme } from "./useColorScheme.ts";
import type { ServerHealth } from "./useServerHealth.ts";

const HEALTH_LABEL: Record<ServerHealth, string> = {
  checking: "Checking server…",
  ok: "Server healthy",
  degraded: "Server up, database unreachable",
  offline: "Server offline",
};

export function StatusBar({
  health,
  scheme,
  onScheme,
}: {
  health: ServerHealth;
  scheme: ColorScheme;
  onScheme: (next: ColorScheme) => void;
}) {
  const dark = scheme === "dark";
  return (
    <footer className="status-bar chrome-bar" role="contentinfo" aria-label="Status">
      <span className="status-icon" data-status="health" role="status">
        <span className="health-dot" data-health={health} aria-hidden />
        {HEALTH_LABEL[health]}
      </span>
      <div className="status-end">
        <button
          type="button"
          className={`status-toggle status-icon${dark ? " is-on" : ""}`}
          aria-pressed={dark}
          onClick={() => onScheme(dark ? "light" : "dark")}
        >
          {dark ? <IconMoon size={14} aria-hidden /> : <IconSun size={14} aria-hidden />}
          Dark mode
        </button>
        <span className="status-version" title={`Jeeves version ${__APP_VERSION__}`}>
          v{__APP_VERSION__}
        </span>
      </div>
    </footer>
  );
}
