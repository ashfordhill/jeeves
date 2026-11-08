/**
 * Top-bar Design / Settings tabs, styled as automation-pitch's view switch.
 * Arrow keys move between tabs; mouse alone is always enough.
 */
import type { KeyboardEvent } from "react";
import { VIEWS, type ViewId } from "./views.ts";

export function ViewTabs({ view, onSelect }: { view: ViewId; onSelect: (next: ViewId) => void }) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const i = VIEWS.findIndex((v) => v.id === view);
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = VIEWS[(i + step + VIEWS.length) % VIEWS.length];
    if (!next) return;
    e.preventDefault();
    onSelect(next.id);
    document.getElementById(`view-tab-${next.id}`)?.focus();
  };

  return (
    <div className="view-switch">
      <div className="view-switch-track" role="tablist" aria-label="Views" onKeyDown={onKeyDown}>
        {VIEWS.map((v) => {
          const on = v.id === view;
          return (
            <button
              key={v.id}
              id={`view-tab-${v.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="view-panel"
              tabIndex={on ? 0 : -1}
              className={`view-switch-btn${on ? " is-on" : ""}`}
              onClick={() => onSelect(v.id)}
            >
              {v.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
