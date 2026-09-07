import { describe, expect, it } from "vitest";
import {
  clearDimensionSelection,
  isDfcInventoryLocked,
  resolveInitialConceptSelection,
  toggleConceptSelection,
} from "@/components/surveys/concept-picker";
import { flexpulsePrimaryProfileAxisKeys } from "@/features/ontology/flexpulse-behavioural-schema";

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
            "manual_override_need",
          ],
          ["owned_der_assets", "manual_override_need"],
        ),
      ),
    ).toEqual([
      "declared_flexibility_capability",
      "owned_der_assets",
    ]);
  });
});

describe("concept picker primary profile axes", () => {
  it("selects the seven core axes and the DFC inventory on a fresh draft", () => {
    expect(Array.from(resolveInitialConceptSelection([]))).toEqual([
      ...flexpulsePrimaryProfileAxisKeys,
      "owned_der_assets",
    ]);
  });

  it("keeps saved optional concepts while restoring the core baseline", () => {
    expect(
      Array.from(resolveInitialConceptSelection(["manual_override_need"])),
    ).toEqual([
      ...flexpulsePrimaryProfileAxisKeys,
      "manual_override_need",
      "owned_der_assets",
    ]);
  });

  it("does not allow toggling off a primary profile axis", () => {
    const selected = resolveInitialConceptSelection([]);
    expect(
      Array.from(toggleConceptSelection(selected, "trust_in_automation")),
    ).toEqual(Array.from(selected));
  });

  it("preserves primary axes when clearing a dimension", () => {
    expect(
      Array.from(
        clearDimensionSelection(
          resolveInitialConceptSelection(["manual_override_need"]),
          ["trust_in_automation", "manual_override_need"],
        ),
      ),
    ).toEqual([
      ...flexpulsePrimaryProfileAxisKeys,
      "owned_der_assets",
    ]);
  });
});
