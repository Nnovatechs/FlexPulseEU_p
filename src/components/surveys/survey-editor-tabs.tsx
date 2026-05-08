"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Tab = "configuration" | "questions" | "review" | "preview";

type SurveyEditorTabsProps = {
  configurationTab: React.ReactNode;
  questionsTab: React.ReactNode;
  reviewTab: React.ReactNode;
  previewTab: React.ReactNode;
  previewUnlocked: boolean;
  defaultTab?: Tab;
};

export function SurveyEditorTabs({
  configurationTab,
  questionsTab,
  reviewTab,
  previewTab,
  previewUnlocked,
  defaultTab = "configuration",
}: SurveyEditorTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab: Tab =
    tabParam === "configuration" ||
    tabParam === "questions" ||
    tabParam === "review" ||
    (tabParam === "preview" && previewUnlocked)
      ? (tabParam as Tab)
      : defaultTab;

  function goToTab(tab: Tab) {
    if (tab === "preview" && !previewUnlocked) {
      return;
    }
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="editor-tabs">
      <nav className="editor-tabs__nav" role="tablist" aria-label="Survey editor sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "configuration"}
          className={`editor-tabs__tab${activeTab === "configuration" ? " editor-tabs__tab--active" : ""}`}
          onClick={() => goToTab("configuration")}
        >
          Configuration
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "questions"}
          className={`editor-tabs__tab${activeTab === "questions" ? " editor-tabs__tab--active" : ""}`}
          onClick={() => goToTab("questions")}
        >
          Questions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "review"}
          className={`editor-tabs__tab${activeTab === "review" ? " editor-tabs__tab--active" : ""}`}
          onClick={() => goToTab("review")}
        >
          Review
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "preview"}
          className={`editor-tabs__tab${
            activeTab === "preview"
              ? " editor-tabs__tab--active"
              : !previewUnlocked
                ? " editor-tabs__tab--disabled"
                : ""
          }`}
          disabled={!previewUnlocked}
          onClick={() => goToTab("preview")}
          title={
            !previewUnlocked
              ? "Add questions first to open the preview"
              : "Preview all language versions"
          }
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

      <div
        role="tabpanel"
        aria-label="Review"
        className={activeTab !== "review" ? "editor-tabs__panel--hidden" : undefined}
      >
        {reviewTab}
      </div>

      <div
        role="tabpanel"
        aria-label="Preview"
        className={activeTab !== "preview" ? "editor-tabs__panel--hidden" : undefined}
      >
        {previewTab}
      </div>
    </div>
  );
}
