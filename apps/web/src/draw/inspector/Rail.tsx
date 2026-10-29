/**
 * The right-hand rail of the Draw view: Inspector and Findings tabs. It can be collapsed to a
 * thin strip (remembered per browser) that still shows the findings count.
 */
import { Tabs } from "@mantine/core";
import { IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand } from "@tabler/icons-react";
import { useState } from "react";
import { type RailTab, useDraw } from "../store.ts";
import { FindingsPanel } from "./FindingsPanel.tsx";
import { Inspector } from "./Inspector.tsx";

const RAIL_KEY = "jeeves.rail";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === "collapsed";
  } catch {
    return false;
  }
}

function FindingsCount({ count }: { count: number }) {
  return (
    <span className="rail-count" data-zero={count === 0 || undefined}>
      {count}
    </span>
  );
}

export function Rail() {
  const tab = useDraw((s) => s.railTab);
  const setRailTab = useDraw((s) => s.setRailTab);
  const count = useDraw((s) => s.loaded?.findings.length ?? 0);
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  const setCollapsed = (next: boolean) => {
    setCollapsedState(next);
    try {
      localStorage.setItem(RAIL_KEY, next ? "collapsed" : "open");
    } catch {
      // Not remembered; harmless.
    }
  };

  if (collapsed) {
    return (
      <aside className="draw-rail is-collapsed" aria-label="Inspector and findings">
        <button
          type="button"
          className="rail-toggle"
          aria-label="Show inspector"
          title="Show inspector"
          onClick={() => setCollapsed(false)}
        >
          <IconLayoutSidebarRightExpand size={18} aria-hidden />
        </button>
        <button
          type="button"
          className="rail-toggle"
          aria-label={`Show findings (${count})`}
          title="Show findings"
          onClick={() => {
            setRailTab("findings");
            setCollapsed(false);
          }}
        >
          <FindingsCount count={count} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="draw-rail" aria-label="Inspector and findings">
      <Tabs
        value={tab}
        onChange={(value) => value && setRailTab(value as RailTab)}
        className="rail-tabs"
        keepMounted={false}
      >
        <div className="rail-head">
          <Tabs.List className="rail-tab-list">
            <Tabs.Tab value="inspector">Inspector</Tabs.Tab>
            <Tabs.Tab value="findings" rightSection={<FindingsCount count={count} />}>
              Findings
            </Tabs.Tab>
          </Tabs.List>
          <button
            type="button"
            className="rail-toggle"
            aria-label="Hide inspector"
            title="Hide inspector"
            onClick={() => setCollapsed(true)}
          >
            <IconLayoutSidebarRightCollapse size={18} aria-hidden />
          </button>
        </div>
        <Tabs.Panel value="inspector" className="rail-panel">
          <Inspector />
        </Tabs.Panel>
        <Tabs.Panel value="findings" className="rail-panel">
          <FindingsPanel />
        </Tabs.Panel>
      </Tabs>
    </aside>
  );
}
