"use client";

import { useState } from "react";

type Tab = "configuration" | "questions" | "preview";

type SurveyEditorTabsProps = {
  configurationTab: React.ReactNode;
  questionsTab: React.ReactNode;
  defaultTab?: Tab;
};

export function SurveyEditorTabs({
  configurationTab,
  questionsTab,
  defaultTab = "configuration",
}: SurveyEditorTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  return (
    <div className="editor-tabs">
      <nav className="editor-tabs__nav" role="tablist" aria-label="Survey editor sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "configuration"}
          className={`editor-tabs__tab${activeTab === "configuration" ? " editor-tabs__tab--active" : ""}`}
          onClick={() => setActiveTab("configuration")}
        >
          Configuration
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "questions"}
          className={`editor-tabs__tab${activeTab === "questions" ? " editor-tabs__tab--active" : ""}`}
          onClick={() => setActiveTab("questions")}
        >
          Questions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={false}
          className="editor-tabs__tab editor-tabs__tab--disabled"
          disabled
          title="Preview will be available after publishing"
        >
          Preview
        </button>
      </nav>

      <div
        role="tabpanel"
        aria-label="Configuration"
        className={activeTab !== "configuration" ? "editor-tabs__panel--hidden" : undefined}
      >
        {configurationTab}
      </div>

      <div
        role="tabpanel"
        aria-label="Questions"
        className={activeTab !== "questions" ? "editor-tabs__panel--hidden" : undefined}
      >
        {questionsTab}
      </div>
    </div>
  );
}
