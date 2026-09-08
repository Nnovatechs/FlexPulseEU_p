import { readFileSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";
import { supportedSurveyLanguages } from "@/features/surveys/languages";

vi.mock("@/components/pending-nav-link", () => ({
  PendingNavLink: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/pending-view-overlay", () => ({
  FormPendingOverlay: () => null,
  PendingSubmitButton: ({ children }: { children: ReactNode }) => (
    <button type="submit">{children}</button>
  ),
}));

vi.mock("@/components/layout/page-header", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

function pageSource(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("canonical language selectors", () => {
  it("gives create and edit primary-language options explicit canonical values", async () => {
    const { default: NewSurveyPage } = await import("@/app/(app)/surveys/new/page");
    const html = renderToStaticMarkup(await NewSurveyPage({ searchParams: Promise.resolve({}) }));

    for (const language of supportedSurveyLanguages) {
      expect(html).toContain(`value="${language}"`);
      expect(html).toMatch(new RegExp(`<option value="${language}"[^>]*>${language}</option>`));
    }

    const editSource = pageSource("src/app/(app)/surveys/[surveyId]/edit/page.tsx");
    expect(editSource).toContain("<option key={language} value={language}>");
  });

  it("opts the authenticated shell out of browser translation", () => {
    const html = renderToStaticMarkup(
      <AppShell userName="Pilot user" userEmail="pilot@example.com">
        workspace
      </AppShell>,
    );

    expect(html).toContain('translate="no"');
    expect(html).toContain("notranslate");
    expect(html).not.toContain("<html");
  });
});
