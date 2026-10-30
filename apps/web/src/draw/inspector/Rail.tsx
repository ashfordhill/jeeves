/**
 * The right-hand rail of the Draw view: Inspector, Findings, and Chat tabs. It can be collapsed to a
 * thin strip (remembered per browser) that still shows the findings count.
 */
import { Button, Tabs } from "@mantine/core";
import {
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconMessageCircle,
} from "@tabler/icons-react";
import { useState } from "react";
import { ChatPanel } from "../../chat/ChatPanel.tsx";
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
  const notice = useDraw((s) => s.notice);
  const edit = useDraw((s) => s.edit);
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
      <aside className="draw-rail is-collapsed" aria-label="Inspector, findings, and chat">
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
        <button
          type="button"
          className="rail-toggle"
          aria-label="Show chat"
          title="Show chat"
          onClick={() => {
            setRailTab("chat");
            setCollapsed(false);
          }}
        >
          <IconMessageCircle size={18} aria-hidden />
        </button>
      </aside>
    );
  }

  return (
    <aside className="draw-rail" aria-label="Inspector, findings, and chat">
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
            <Tabs.Tab value="chat">Chat</Tabs.Tab>
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
          {notice?.actions?.length ? (
            <section className="inspector-section" aria-label="Connection choices">
              <h3>Connection choices</h3>
              {notice.actions.map((action) => (
                <Button
                  key={action.label}
                  variant="default"
                  size="xs"
                  onClick={() => {
                    useDraw.getState().setNotice(undefined);
                    void edit(action.ops);
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </section>
          ) : null}
          <Inspector />
        </Tabs.Panel>
        <Tabs.Panel value="findings" className="rail-panel">
          <FindingsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="chat" className="rail-panel rail-panel-chat">
          <ChatPanel />
        </Tabs.Panel>
      </Tabs>
    </aside>
  );
}
