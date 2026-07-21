import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRawLocationRetentionUntil,
  getRawLocationRetentionHours,
  getRawLocationRetentionLabel,
} from "@/lib/config/response-retention";

describe("raw location retention config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to 72 hours", () => {
    vi.stubEnv("RAW_LOCATION_RETENTION_HOURS", "");

    expect(getRawLocationRetentionHours()).toBe(72);
    expect(getRawLocationRetentionLabel()).toBe("3 days");
  });

  it("supports the seven-day validation window", () => {
    vi.stubEnv("RAW_LOCATION_RETENTION_HOURS", "168");

    expect(getRawLocationRetentionHours()).toBe(168);
    expect(getRawLocationRetentionLabel()).toBe("7 days");
    expect(buildRawLocationRetentionUntil(Date.parse("2026-07-15T10:00:00.000Z"))).toBe(
      "2026-07-22T10:00:00.000Z",
    );
  });

  it("rejects invalid or excessive retention periods", () => {
    vi.stubEnv("RAW_LOCATION_RETENTION_HOURS", "0");
    expect(() => getRawLocationRetentionHours()).toThrow(
      "RAW_LOCATION_RETENTION_HOURS must be an integer between 1 and 720.",
    );

    vi.stubEnv("RAW_LOCATION_RETENTION_HOURS", "721");
    expect(() => getRawLocationRetentionHours()).toThrow(
      "RAW_LOCATION_RETENTION_HOURS must be an integer between 1 and 720.",
    );

    vi.stubEnv("RAW_LOCATION_RETENTION_HOURS", "3.5");
    expect(() => getRawLocationRetentionHours()).toThrow(
      "RAW_LOCATION_RETENTION_HOURS must be an integer between 1 and 720.",
    );
  });
});
