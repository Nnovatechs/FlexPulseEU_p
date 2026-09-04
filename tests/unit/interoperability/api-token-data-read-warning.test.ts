import { describe, expect, it } from "vitest";
import { DATA_READ_SCOPE_WARNING } from "@/app/(app)/account/api/token-manager";

describe("API token data:read warning", () => {
  it("warns that data:read exports personal respondent-level data", () => {
    expect(DATA_READ_SCOPE_WARNING).toContain("respondent-level answers");
    expect(DATA_READ_SCOPE_WARNING).toContain("mapped profiles");
    expect(DATA_READ_SCOPE_WARNING.toLowerCase()).toContain("personal data");
    expect(DATA_READ_SCOPE_WARNING).toContain("DPA");
  });
});
