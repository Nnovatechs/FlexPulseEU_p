import { normalizeSegmentDefinition } from "./normalize";
import {
  MAX_SEGMENT_PAYLOAD_CHARS,
  SEGMENT_DEFINITION_VERSION,
  type SegmentDefinition,
  type SegmentValidationIssue,
} from "./types";

export type SegmentCodecResult =
  | { ok: true; definition: SegmentDefinition }
  | { ok: false; issue: SegmentValidationIssue; message: string };

function fail(issue: SegmentValidationIssue, message: string): SegmentCodecResult {
  return { ok: false, issue, message };
}

function utf8ToBase64(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }

  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToUtf8(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64").toString("utf8");
  }

  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function toBase64Url(value: string) {
  return utf8ToBase64(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  return base64ToUtf8(padded + "=".repeat(padLength));
}

export function encodeSegmentDefinition(definition: SegmentDefinition) {
  const normalized = normalizeSegmentDefinition(definition);
  return toBase64Url(JSON.stringify(normalized));
}

export function decodeSegmentDefinition(payload: string): SegmentCodecResult {
  if (!payload.trim()) {
    return fail("malformed", "The segment URL payload is empty.");
  }

  if (payload.length > MAX_SEGMENT_PAYLOAD_CHARS) {
    return fail("payload_too_large", "The segment URL payload is too large.");
  }

  try {
    const decoded = fromBase64Url(payload);
    const parsed = JSON.parse(decoded) as Partial<SegmentDefinition>;
    if (typeof parsed !== "object" || parsed == null) {
      return fail("malformed", "The segment URL payload is not a valid object.");
    }
    if (parsed.version !== SEGMENT_DEFINITION_VERSION) {
      return fail("unknown_version", "The segment URL uses an unknown contract version.");
    }
    if (typeof parsed.surveyId !== "string" || typeof parsed.schemaNamespace !== "string") {
      return fail("malformed", "The segment URL payload is incomplete.");
    }
    if (!Array.isArray(parsed.conditions)) {
      return fail("malformed", "The segment URL payload has invalid conditions.");
    }

    return {
      ok: true,
      definition: normalizeSegmentDefinition({
        version: SEGMENT_DEFINITION_VERSION,
        surveyId: parsed.surveyId,
        schemaNamespace: parsed.schemaNamespace,
        measurementHash: parsed.measurementHash ?? null,
        conditions: parsed.conditions,
      }),
    };
  } catch {
    return fail("malformed", "The segment URL payload could not be decoded.");
  }
}
