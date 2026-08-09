import type {
  PersistedSurveyLinkIntegration,
  PublicExternalRecruitment,
} from "./types";

const PROLIFIC_HOST = "app.prolific.com";
const PROLIFIC_PATH = "/submissions/complete";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function parseProlificCompletionUrl(value: string) {
  const raw = value.trim();
  if (!raw) {
    throw new Error("Prolific completion URL is required.");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Prolific completion URL is invalid.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Prolific completion URL must use HTTPS.");
  }

  if (url.hostname !== PROLIFIC_HOST) {
    throw new Error("Prolific completion URL must use app.prolific.com.");
  }

  if (url.username || url.password) {
    throw new Error("Prolific completion URL must not contain credentials.");
  }

  if (url.hash) {
    throw new Error("Prolific completion URL must not contain a fragment.");
  }

  if (!url.pathname.startsWith(PROLIFIC_PATH)) {
    throw new Error("Prolific completion URL must target /submissions/complete.");
  }

  const completionCode = url.searchParams.get("cc")?.trim() ?? "";
  if (!completionCode) {
    throw new Error("Prolific completion URL must include a non-empty cc parameter.");
  }

  return {
    completionUrl: url.toString(),
    completionCode,
  };
}

export function getProlificLaunchParamsFromSearchParams(searchParams: {
  PROLIFIC_PID?: string;
  STUDY_ID?: string;
  SESSION_ID?: string;
}) {
  return {
    prolificPid: readString(searchParams.PROLIFIC_PID),
    studyId: readString(searchParams.STUDY_ID),
    sessionId: readString(searchParams.SESSION_ID),
  };
}

export function getProlificLaunchParamsFromFormData(formData: FormData) {
  return {
    prolificPid: readString(formData.get("PROLIFIC_PID")),
    studyId: readString(formData.get("STUDY_ID")),
    sessionId: readString(formData.get("SESSION_ID")),
  };
}

export function resolveProlificRecruitment(input: {
  prolificPid: string;
  studyId: string;
  sessionId: string;
  integration: PersistedSurveyLinkIntegration | null;
}): PublicExternalRecruitment {
  const hasAnyParam = Boolean(input.prolificPid || input.studyId || input.sessionId);
  const hasAllParams = Boolean(input.prolificPid && input.studyId && input.sessionId);

  if (!hasAnyParam) {
    return { kind: "direct" };
  }

  if (!hasAllParams) {
    return {
      kind: "error",
      message:
        "This Prolific study link is incomplete. Please return to Prolific and reopen the study.",
    };
  }

  if (!input.integration || !input.integration.is_active) {
    return {
      kind: "error",
      message:
        "This Prolific study link is not configured correctly. Please return to Prolific and contact the researcher.",
    };
  }

  if (input.integration.external_study_id !== input.studyId) {
    return {
      kind: "error",
      message:
        "This Prolific study link does not match the configured study. Please return to Prolific and reopen the study.",
    };
  }

  return {
    kind: "prolific",
    prolificPid: input.prolificPid,
    studyId: input.studyId,
    sessionId: input.sessionId,
  };
}
