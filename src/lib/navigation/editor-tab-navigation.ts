export type EditorTab = "configuration" | "questions" | "review" | "preview";

const EDITOR_TAB_PENDING_TITLES: Record<EditorTab, string> = {
  configuration: "Loading configuration…",
  questions: "Loading questions…",
  review: "Loading review…",
  preview: "Loading preview…",
};

export function getEditorTabPendingTitle(tab: EditorTab): string {
  return EDITOR_TAB_PENDING_TITLES[tab];
}

export function shouldShowEditorTabOverlay(
  activeTab: EditorTab,
  pendingTab: EditorTab | null,
): boolean {
  return pendingTab !== null && pendingTab !== activeTab;
}
