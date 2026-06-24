"use client";

import { useState, type ReactNode } from "react";

export type AnalyticsTab = {
  id: string;
  label: string;
  panel: ReactNode;
};

/**
 * Client shell that switches between server-rendered analytics panels.
 * All panels are rendered once on the server and toggled with `hidden`,
 * so form state inside a panel (e.g. the segment builder) survives tab
 * switches. The active tab is mirrored to the `view` search param so a
 * server navigation (filter apply, segment build) lands on the same tab.
 */
export function AnalyticsTabs({
  tabs,
  defaultTab,
}: {
  tabs: AnalyticsTab[];
  defaultTab?: string;
}) {
  const initial = tabs.some((tab) => tab.id === defaultTab) ? defaultTab! : tabs[0]?.id;
  const [active, setActive] = useState(initial);

  function select(id: string) {
    setActive(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", id);
      window.history.replaceState(null, "", url);
    }
  }

  return (
    <>
      <nav className="analytics-section-nav" aria-label="Analytics sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`analytics-section-nav__tab${active === tab.id ? " is-active" : ""}`}
            aria-current={active === tab.id ? "page" : undefined}
            onClick={() => select(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="analytics-sections-body">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="analytics-panel"
            role="tabpanel"
            hidden={active !== tab.id}
          >
            {tab.panel}
          </div>
        ))}
      </div>
    </>
  );
}
