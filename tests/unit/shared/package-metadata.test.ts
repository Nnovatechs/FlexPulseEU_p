import { describe, expect, it } from "vitest";

// This test preserves the original repository smoke check.
// It verifies that the project metadata keeps the expected governance defaults.
import packageJson from "../../../package.json";

describe("package metadata defaults", () => {
  it("keeps the repository private and Apache-licensed", () => {
    expect(packageJson.private).toBe(true);
    expect(packageJson.license).toBe("Apache-2.0");
    expect(packageJson.name).toBe("flexpulseeu");
  });
});
