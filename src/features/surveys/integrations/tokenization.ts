import { createHmac } from "node:crypto";
import {
  EXTERNAL_RECRUITMENT_NOTICE_VERSION,
  EXTERNAL_RECRUITMENT_TOKEN_VERSION,
  SURVEY_LINK_INTEGRATION_PROVIDER_PROLIFIC,
} from "./types";

function getRecruitmentHmacSecret() {
  const secret = process.env.RECRUITMENT_ID_HMAC_SECRET?.trim();
  if (!secret) {
    throw new Error("RECRUITMENT_ID_HMAC_SECRET is required for external recruitment.");
  }

  return secret;
}

function hmacToken(value: string) {
  return createHmac("sha256", getRecruitmentHmacSecret()).update(value).digest("hex");
}

export function buildProlificRecruitmentTokens(input: {
  integrationId: string;
  prolificPid: string;
  sessionId: string;
}) {
  return {
    participantToken: hmacToken(
      `external-id:${EXTERNAL_RECRUITMENT_TOKEN_VERSION}:${SURVEY_LINK_INTEGRATION_PROVIDER_PROLIFIC}:${input.integrationId}:participant:${input.prolificPid}`,
    ),
    submissionToken: hmacToken(
      `external-id:${EXTERNAL_RECRUITMENT_TOKEN_VERSION}:${SURVEY_LINK_INTEGRATION_PROVIDER_PROLIFIC}:${input.integrationId}:submission:${input.sessionId}`,
    ),
    tokenVersion: EXTERNAL_RECRUITMENT_TOKEN_VERSION,
    noticeVersion: EXTERNAL_RECRUITMENT_NOTICE_VERSION,
  };
}
