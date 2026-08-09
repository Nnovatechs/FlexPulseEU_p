import { afterEach, describe, expect, it } from "vitest";
import { buildProlificRecruitmentTokens } from "@/features/surveys/integrations/tokenization";

const ORIGINAL_SECRET = process.env.RECRUITMENT_ID_HMAC_SECRET;

describe("external recruitment tokenization", () => {
  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.RECRUITMENT_ID_HMAC_SECRET;
    } else {
      process.env.RECRUITMENT_ID_HMAC_SECRET = ORIGINAL_SECRET;
    }
  });

  it("is deterministic within one integration", () => {
    process.env.RECRUITMENT_ID_HMAC_SECRET = "top-secret";

    const first = buildProlificRecruitmentTokens({
      integrationId: "integration-1",
      prolificPid: "pid-1",
      sessionId: "session-1",
    });
    const second = buildProlificRecruitmentTokens({
      integrationId: "integration-1",
      prolificPid: "pid-1",
      sessionId: "session-1",
    });

    expect(second).toEqual(first);
  });

  it("separates identical participant ids across integrations", () => {
    process.env.RECRUITMENT_ID_HMAC_SECRET = "top-secret";

    const first = buildProlificRecruitmentTokens({
      integrationId: "integration-1",
      prolificPid: "pid-1",
      sessionId: "session-1",
    });
    const second = buildProlificRecruitmentTokens({
      integrationId: "integration-2",
      prolificPid: "pid-1",
      sessionId: "session-1",
    });

    expect(first.participantToken).not.toBe(second.participantToken);
    expect(first.submissionToken).not.toBe(second.submissionToken);
  });
});
