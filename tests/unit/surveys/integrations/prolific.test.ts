import { describe, expect, it } from "vitest";
import {
  getProlificLaunchParamsFromSearchParams,
  parseProlificCompletionUrl,
  resolveProlificRecruitment,
} from "@/features/surveys/integrations/prolific";

describe("Prolific integration helpers", () => {
  it("parses a valid Prolific completion URL", () => {
    expect(
      parseProlificCompletionUrl(
        "https://app.prolific.com/submissions/complete?cc=ABC123",
      ),
    ).toEqual({
      completionUrl: "https://app.prolific.com/submissions/complete?cc=ABC123",
      completionCode: "ABC123",
    });
  });

  it("rejects lookalike completion hosts", () => {
    expect(() =>
      parseProlificCompletionUrl(
        "https://app.prolific.com.evil.org/submissions/complete?cc=ABC123",
      ),
    ).toThrow("Prolific completion URL must use app.prolific.com.");
  });

  it("rejects completion URLs without a code", () => {
    expect(() =>
      parseProlificCompletionUrl("https://app.prolific.com/submissions/complete"),
    ).toThrow("Prolific completion URL must include a non-empty cc parameter.");
  });

  it("returns a direct flow when no Prolific params are present", () => {
    expect(
      resolveProlificRecruitment({
        prolificPid: "",
        studyId: "",
        sessionId: "",
        integration: null,
      }),
    ).toEqual({ kind: "direct" });
  });

  it("rejects partial Prolific params", () => {
    expect(
      resolveProlificRecruitment({
        prolificPid: "pid-1",
        studyId: "study-1",
        sessionId: "",
        integration: null,
      }),
    ).toEqual({
      kind: "error",
      message:
        "This Prolific study link is incomplete. Please return to Prolific and reopen the study.",
    });
  });

  it("rejects mismatched study ids", () => {
    expect(
      resolveProlificRecruitment({
        prolificPid: "pid-1",
        studyId: "study-wrong",
        sessionId: "session-1",
        integration: {
          id: "integration-1",
          survey_link_id: "link-1",
          provider: "prolific",
          external_study_id: "study-1",
          completion_url: "https://app.prolific.com/submissions/complete?cc=ABC123",
          provider_config_json: {},
          privacy_notice_version: "external-recruitment-v1",
          is_active: true,
          created_at: "2026-08-05T10:00:00.000Z",
          updated_at: "2026-08-05T10:00:00.000Z",
        },
      }),
    ).toEqual({
      kind: "error",
      message:
        "This Prolific study link does not match the configured study. Please return to Prolific and reopen the study.",
    });
  });

  it("accepts a complete matching Prolific launch", () => {
    expect(
      resolveProlificRecruitment({
        ...getProlificLaunchParamsFromSearchParams({
          PROLIFIC_PID: "pid-1",
          STUDY_ID: "study-1",
          SESSION_ID: "session-1",
        }),
        integration: {
          id: "integration-1",
          survey_link_id: "link-1",
          provider: "prolific",
          external_study_id: "study-1",
          completion_url: "https://app.prolific.com/submissions/complete?cc=ABC123",
          provider_config_json: {},
          privacy_notice_version: "external-recruitment-v1",
          is_active: true,
          created_at: "2026-08-05T10:00:00.000Z",
          updated_at: "2026-08-05T10:00:00.000Z",
        },
      }),
    ).toEqual({
      kind: "prolific",
      prolificPid: "pid-1",
      studyId: "study-1",
      sessionId: "session-1",
    });
  });
});
