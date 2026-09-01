import type { SurveyAnalyticsSchema } from "@/features/surveys/survey-analytics";
import { emptySegmentDefinition, normalizeSegmentDefinition, segmentDefinitionsEqual } from "./normalize";
import type { ComparisonTrayState, SavedSegmentRecord, SegmentDefinition } from "./types";
import { sanitizeStoredSegmentDefinition } from "./validation";

export const SEGMENT_STORAGE_VERSION = 1 as const;
const SEGMENT_STORAGE_EVENT = "flexpulse-segment-storage";

const savedSnapshotCache = new Map<string, { raw: string | null; records: SavedSegmentRecord[] }>();
const traySnapshotCache = new Map<string, { raw: string | null; tray: ComparisonTrayState }>();

export function subscribeSegmentStorage(onChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onChange);
  window.addEventListener(SEGMENT_STORAGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SEGMENT_STORAGE_EVENT, onChange);
  };
}

function notifySegmentStorage() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(SEGMENT_STORAGE_EVENT));
}

type SavedSegmentStore = {
  version: typeof SEGMENT_STORAGE_VERSION;
  surveyId: string;
  measurementHash: string | null;
  records: SavedSegmentRecord[];
};

export type SegmentStorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function browserAdapter(): SegmentStorageAdapter | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function savedSegmentsStorageKey(surveyId: string, measurementHash: string | null) {
  return `flexpulse.analytics-v2.segments.v${SEGMENT_STORAGE_VERSION}.${surveyId}.${measurementHash ?? "none"}`;
}

export function comparisonTrayStorageKey(surveyId: string, measurementHash: string | null) {
  return `flexpulse.analytics-v2.comparison.v${SEGMENT_STORAGE_VERSION}.${surveyId}.${measurementHash ?? "none"}`;
}

function parseJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function emptyTray(): ComparisonTrayState {
  return { version: 1, slots: [null, null] };
}

function sanitizeTraySlot(
  slot: unknown,
  surveyId: string,
  measurementHash: string | null,
  schema?: SurveyAnalyticsSchema,
): SegmentDefinition | null {
  if (typeof slot !== "object" || slot == null) {
    return null;
  }

  const candidate = slot as SegmentDefinition;
  if (candidate.surveyId !== surveyId || candidate.measurementHash !== measurementHash) {
    return null;
  }

  if (schema) {
    return sanitizeStoredSegmentDefinition(candidate, schema);
  }

  return normalizeSegmentDefinition(candidate);
}

export function comparisonTrayCount(tray: ComparisonTrayState) {
  return tray.slots.filter((slot) => slot != null).length;
}

export function readSavedSegments(
  surveyId: string,
  measurementHash: string | null,
  adapter: SegmentStorageAdapter | null = browserAdapter(),
  schema?: SurveyAnalyticsSchema,
): SavedSegmentRecord[] {
  if (!adapter) {
    return [];
  }

  const parsed = parseJson(adapter.getItem(savedSegmentsStorageKey(surveyId, measurementHash)));
  if (typeof parsed !== "object" || parsed == null) {
    return [];
  }

  const store = parsed as Partial<SavedSegmentStore>;
  if (store.version !== SEGMENT_STORAGE_VERSION) {
    return [];
  }
  if (store.surveyId !== surveyId || store.measurementHash !== measurementHash) {
    return [];
  }
  if (!Array.isArray(store.records)) {
    return [];
  }

  return store.records
    .filter(
      (record) =>
        typeof record?.id === "string" &&
        typeof record.name === "string" &&
        record.definition?.surveyId === surveyId &&
        record.definition.measurementHash === measurementHash,
    )
    .flatMap((record) => {
      if (!schema) {
        return [record];
      }
      const definition = sanitizeStoredSegmentDefinition(record.definition, schema);
      return definition ? [{ ...record, definition }] : [];
    });
}

export function writeSavedSegments(
  surveyId: string,
  measurementHash: string | null,
  records: SavedSegmentRecord[],
  adapter: SegmentStorageAdapter | null = browserAdapter(),
) {
  if (!adapter) {
    return;
  }

  const store: SavedSegmentStore = {
    version: SEGMENT_STORAGE_VERSION,
    surveyId,
    measurementHash,
    records,
  };
  adapter.setItem(savedSegmentsStorageKey(surveyId, measurementHash), JSON.stringify(store));
  notifySegmentStorage();
}

export function saveNamedSegment(
  input: {
    surveyId: string;
    measurementHash: string | null;
    name: string;
    definition: SegmentDefinition;
    id?: string;
  },
  adapter: SegmentStorageAdapter | null = browserAdapter(),
) {
  const now = new Date().toISOString();
  const records = readSavedSegments(input.surveyId, input.measurementHash, adapter);
  const id = input.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${now}-${records.length}`);
  const existingIndex = records.findIndex((record) => record.id === id);
  const next: SavedSegmentRecord = {
    id,
    name: input.name.trim() || "Untitled segment",
    createdAt: existingIndex >= 0 ? records[existingIndex].createdAt : now,
    updatedAt: now,
    definition: normalizeSegmentDefinition(input.definition),
  };
  const updated =
    existingIndex >= 0
      ? records.map((record, index) => (index === existingIndex ? next : record))
      : [...records, next];
  writeSavedSegments(input.surveyId, input.measurementHash, updated, adapter);
  return next;
}

export function renameSavedSegment(
  surveyId: string,
  measurementHash: string | null,
  id: string,
  name: string,
  adapter: SegmentStorageAdapter | null = browserAdapter(),
) {
  const records = readSavedSegments(surveyId, measurementHash, adapter).map((record) =>
    record.id === id
      ? { ...record, name: name.trim() || record.name, updatedAt: new Date().toISOString() }
      : record,
  );
  writeSavedSegments(surveyId, measurementHash, records, adapter);
}

export function duplicateSavedSegment(
  surveyId: string,
  measurementHash: string | null,
  id: string,
  adapter: SegmentStorageAdapter | null = browserAdapter(),
) {
  const records = readSavedSegments(surveyId, measurementHash, adapter);
  const source = records.find((record) => record.id === id);
  if (!source) {
    return null;
  }

  return saveNamedSegment(
    {
      surveyId,
      measurementHash,
      name: `${source.name} copy`,
      definition: source.definition,
    },
    adapter,
  );
}

export function deleteSavedSegment(
  surveyId: string,
  measurementHash: string | null,
  id: string,
  adapter: SegmentStorageAdapter | null = browserAdapter(),
) {
  writeSavedSegments(
    surveyId,
    measurementHash,
    readSavedSegments(surveyId, measurementHash, adapter).filter((record) => record.id !== id),
    adapter,
  );
}

export function readComparisonTray(
  surveyId: string,
  measurementHash: string | null,
  adapter: SegmentStorageAdapter | null = browserAdapter(),
  schema?: SurveyAnalyticsSchema,
): ComparisonTrayState {
  if (!adapter) {
    return emptyTray();
  }

  const parsed = parseJson(adapter.getItem(comparisonTrayStorageKey(surveyId, measurementHash)));
  if (typeof parsed !== "object" || parsed == null) {
    return emptyTray();
  }

  const tray = parsed as Partial<ComparisonTrayState>;
  if (tray.version !== 1 || !Array.isArray(tray.slots)) {
    return emptyTray();
  }

  const slots: ComparisonTrayState["slots"] = [
    sanitizeTraySlot(tray.slots[0], surveyId, measurementHash, schema),
    sanitizeTraySlot(tray.slots[1], surveyId, measurementHash, schema),
  ];
  return { version: 1, slots };
}

export function writeComparisonTray(
  surveyId: string,
  measurementHash: string | null,
  tray: ComparisonTrayState,
  adapter: SegmentStorageAdapter | null = browserAdapter(),
) {
  if (!adapter) {
    return;
  }

  adapter.setItem(comparisonTrayStorageKey(surveyId, measurementHash), JSON.stringify(tray));
  notifySegmentStorage();
}

function matchingComparisonSlot(tray: ComparisonTrayState, definition: SegmentDefinition): 0 | 1 | null {
  const index = tray.slots.findIndex((slot) => slot != null && segmentDefinitionsEqual(slot, definition));
  return index === 0 || index === 1 ? index : null;
}

export function addToComparisonTray(
  tray: ComparisonTrayState,
  definition: SegmentDefinition,
  replaceSlot?: 0 | 1,
):
  | { ok: true; tray: ComparisonTrayState; slot: 0 | 1; action: "added" | "replaced" | "already" }
  | { ok: false; reason: "duplicate"; slot: 0 | 1 }
  | { ok: false; reason: "full" } {
  const normalized = normalizeSegmentDefinition(definition);
  const existingSlot = matchingComparisonSlot(tray, normalized);

  if (replaceSlot != null) {
    if (existingSlot === replaceSlot) {
      return { ok: true, tray, slot: replaceSlot, action: "already" };
    }
    if (existingSlot != null) {
      return { ok: false, reason: "duplicate", slot: existingSlot };
    }
    const slots: ComparisonTrayState["slots"] = [...tray.slots];
    slots[replaceSlot] = normalized;
    return { ok: true, tray: { version: 1, slots }, slot: replaceSlot, action: "replaced" };
  }

  if (existingSlot != null) {
    return { ok: false, reason: "duplicate", slot: existingSlot };
  }

  const emptyIndex = tray.slots.findIndex((slot) => slot == null);
  if (emptyIndex !== 0 && emptyIndex !== 1) {
    return { ok: false, reason: "full" };
  }

  const slots: ComparisonTrayState["slots"] = [...tray.slots];
  slots[emptyIndex] = normalized;
  return { ok: true, tray: { version: 1, slots }, slot: emptyIndex, action: "added" };
}

export function removeComparisonSlot(tray: ComparisonTrayState, slot: 0 | 1): ComparisonTrayState {
  const slots: ComparisonTrayState["slots"] = [...tray.slots];
  slots[slot] = null;
  return { version: 1, slots };
}

export function swapComparisonSlots(tray: ComparisonTrayState): ComparisonTrayState {
  return { version: 1, slots: [tray.slots[1], tray.slots[0]] };
}

export function getSavedSegmentsSnapshot(
  surveyId: string,
  measurementHash: string | null,
  schema: SurveyAnalyticsSchema,
) {
  const storageKey = savedSegmentsStorageKey(surveyId, measurementHash);
  const key = `${storageKey}:${schema.schema_namespace}`;
  const raw = browserAdapter()?.getItem(storageKey) ?? null;
  const cached = savedSnapshotCache.get(key);
  if (cached && cached.raw === raw) {
    return cached.records;
  }
  const records = readSavedSegments(surveyId, measurementHash, browserAdapter(), schema);
  savedSnapshotCache.set(key, { raw, records });
  return records;
}

export function getComparisonTraySnapshot(
  surveyId: string,
  measurementHash: string | null,
  schema: SurveyAnalyticsSchema,
) {
  const storageKey = comparisonTrayStorageKey(surveyId, measurementHash);
  const key = `${storageKey}:${schema.schema_namespace}`;
  const raw = browserAdapter()?.getItem(storageKey) ?? null;
  const cached = traySnapshotCache.get(key);
  if (cached && cached.raw === raw) {
    return cached.tray;
  }
  const tray = readComparisonTray(surveyId, measurementHash, browserAdapter(), schema);
  traySnapshotCache.set(key, { raw, tray });
  return tray;
}

const EMPTY_SAVED_SEGMENTS: SavedSegmentRecord[] = [];
const EMPTY_COMPARISON_TRAY: ComparisonTrayState = { version: 1, slots: [null, null] };

export function emptySavedSegments() {
  return EMPTY_SAVED_SEGMENTS;
}

export function emptyComparisonTray(): ComparisonTrayState {
  return EMPTY_COMPARISON_TRAY;
}

export function wholeSampleDefinition(input: {
  surveyId: string;
  schemaNamespace: string;
  measurementHash: string | null;
}) {
  return emptySegmentDefinition(input);
}
