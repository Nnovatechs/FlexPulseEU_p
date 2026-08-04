import { describe, expect, it } from "vitest";
import {
  clearDimensionSelection,
  isDfcInventoryLocked,
  toggleConceptSelection,
} from "@/components/surveys/concept-picker";

describe("concept picker DFC dependency", () => {
  it("locks owned assets while DFC remains selected", () => {
    expect(
      isDfcInventoryLocked([
        "declared_flexibility_capability",
        "owned_der_assets",
      ]),
    ).toBe(true);
    expect(isDfcInventoryLocked(["owned_der_assets"])).toBe(false);
  });

  it("does not allow toggling off owned assets while DFC is active", () => {
    expect(
      Array.from(
        toggleConceptSelection(
          ["declared_flexibility_capability", "owned_der_assets"],
          "owned_der_assets",
        ),
      ),
    ).toEqual([
      "declared_flexibility_capability",
      "owned_der_assets",
    ]);
  });

  it("preserves owned assets during deselect-all when DFC is active", () => {
    expect(
      Array.from(
        clearDimensionSelection(
          [
            "declared_flexibility_capability",
            "owned_der_assets",
            "trust_in_automation",
          ],
          ["owned_der_assets", "trust_in_automation"],
        ),
      ),
    ).toEqual([
      "declared_flexibility_capability",
      "owned_der_assets",
    ]);
  });
});
