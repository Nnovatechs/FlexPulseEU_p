import { describe, expect, it } from "vitest";
import ApiDocsPage from "@/app/(public)/docs/api/page";
import { renderToStaticMarkup } from "react-dom/server";

describe("interoperability public docs", () => {
  it("documents pagination, rate limits and export handling", () => {
    const html = renderToStaticMarkup(ApiDocsPage());
    expect(html).toContain("Rate limits");
    expect(html).toContain("120 requests per minute");
    expect(html).toContain("next_cursor");
    expect(html).toContain("pipeline_status");
    expect(html).toContain("Data protection");
    expect(html).toContain("fp_test_");
    expect(html).toContain("Retry-After");
  });
});
