import type { InstrumentHealthData } from "./instrument-health";
import { INSTRUMENT_HEALTH_ANALYSIS_VERSION, INSTRUMENT_HEALTH_METHODOLOGY_VERSION } from "./instrument-health-semantics";

const STORAGE_PREFIX = "flexpulse.analytics-v2.instrument-health.";

const memory = new Map<string, InstrumentHealthData>();
const listeners = new Set<() => void>();

function storageKey(surveyId: string) {
  return `${STORAGE_PREFIX}${surveyId}`;
}

function notifyInstrumentHealthSession() {
  for (const listener of listeners) {
    listener();
  }
}

function isInstrumentHealthData(value: unknown): value is InstrumentHealthData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<InstrumentHealthData>;
  return (
    record.analysisVersion === INSTRUMENT_HEALTH_ANALYSIS_VERSION &&
    record.methodologyVersion === INSTRUMENT_HEALTH_METHODOLOGY_VERSION &&
    record.scopes != null &&
    typeof record.scopes === "object"
  );
}

export function subscribeInstrumentHealthSession(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function readInstrumentHealthSession(surveyId: string): InstrumentHealthData | null {
  const remembered = memory.get(surveyId);
  if (remembered) {
    if (
      remembered.analysisVersion === INSTRUMENT_HEALTH_ANALYSIS_VERSION &&
      remembered.methodologyVersion === INSTRUMENT_HEALTH_METHODOLOGY_VERSION
    ) {
      return remembered;
    }
    memory.delete(surveyId);
  }

  if (typeof sessionStorage === "undefined") {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(storageKey(surveyId));
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isInstrumentHealthData(parsed)) {
      return null;
    }

    memory.set(surveyId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeInstrumentHealthSession(surveyId: string, data: InstrumentHealthData) {
  memory.set(surveyId, data);

  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(storageKey(surveyId), JSON.stringify(data));
    } catch {
      // Quota, private mode, or serialization limits — memory still keeps the tab session.
    }
  }

  notifyInstrumentHealthSession();
}

export function clearInstrumentHealthSessionsForTests() {
  memory.clear();
  notifyInstrumentHealthSession();
}
