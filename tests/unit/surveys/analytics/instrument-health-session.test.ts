import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { InstrumentHealthData } from "@/features/surveys/analytics/instrument-health";
import {
  INSTRUMENT_HEALTH_ANALYSIS_VERSION,
  INSTRUMENT_HEALTH_METHODOLOGY_VERSION,
} from "@/features/surveys/analytics/instrument-health-semantics";
import {
  readInstrumentHealthSession,
  writeInstrumentHealthSession,
  subscribeInstrumentHealthSession,
  clearInstrumentHealthSessionsForTests,
} from "@/features/surveys/analytics/instrument-health-session";

const sample = {
  analysisVersion: INSTRUMENT_HEALTH_ANALYSIS_VERSION,
  methodologyVersion: INSTRUMENT_HEALTH_METHODOLOGY_VERSION,
  generatedAt: "2026-08-14T08:00:00.000Z",
  cacheKey: "survey-1:hash",
  scopes: {},
} as InstrumentHealthData;

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
    },
  });
});

afterEach(() => {
  sessionStorage.clear();
  clearInstrumentHealthSessionsForTests();
});

describe("instrument health session cache", () => {
  it("returns null when nothing is stored", () => {
    expect(readInstrumentHealthSession("survey-1")).toBeNull();
  });

  it("reads back a result without using the database", () => {
    writeInstrumentHealthSession("survey-1", sample);

    expect(readInstrumentHealthSession("survey-1")?.cacheKey).toBe("survey-1:hash");
    expect(readInstrumentHealthSession("survey-1")?.analysisVersion).toBe(INSTRUMENT_HEALTH_ANALYSIS_VERSION);
  });

  it("restores from sessionStorage after the memory map is empty", () => {
    writeInstrumentHealthSession("survey-2", { ...sample, cacheKey: "survey-2:hash" });
    clearInstrumentHealthSessionsForTests();
    expect(readInstrumentHealthSession("survey-2")?.cacheKey).toBe("survey-2:hash");
  });

  it("ignores a cached result from a previous analysis version", () => {
    writeInstrumentHealthSession("survey-3", { ...sample, analysisVersion: "instrument-health-v1" });
    clearInstrumentHealthSessionsForTests();
    expect(readInstrumentHealthSession("survey-3")).toBeNull();
  });

  it("ignores a cached result from a previous methodology version", () => {
    writeInstrumentHealthSession("survey-4", { ...sample, methodologyVersion: "v0" });
    clearInstrumentHealthSessionsForTests();
    expect(readInstrumentHealthSession("survey-4")).toBeNull();
  });

  it("notifies subscribers when a result is written", () => {
    let calls = 0;
    const unsubscribe = subscribeInstrumentHealthSession(() => {
      calls += 1;
    });
    writeInstrumentHealthSession("survey-1", sample);
    unsubscribe();
    expect(calls).toBe(1);
  });
});
