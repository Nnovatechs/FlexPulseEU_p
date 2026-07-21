import type { LegalConfig } from "@/lib/config/legal";

export const PRIVACY_PROFILE_INCOMPLETE_ERROR = "PRIVACY_PROFILE_INCOMPLETE";
export const DPA_ACCEPTANCE_REQUIRED_ERROR = "DPA_ACCEPTANCE_REQUIRED";

export type OwnerLegalProfile = {
  userId: string;
  controllerName: string;
  controllerCountry: string;
  contactEmail: string;
  privacyEmail: string;
  dpoEmail: string | null;
  controllerAddress: string | null;
  representativeName: string | null;
  representativeTitle: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OwnerLegalProfileInput = Pick<
  OwnerLegalProfile,
  | "controllerName"
  | "controllerCountry"
  | "contactEmail"
  | "privacyEmail"
  | "dpoEmail"
  | "controllerAddress"
  | "representativeName"
  | "representativeTitle"
>;

export type SurveyLegalSnapshot = {
  schemaVersion: 1;
  capturedAt: string;
  controller: {
    name: string;
    country: string;
    contactEmail: string;
    privacyEmail: string;
    dpoEmail: string | null;
  };
  platform: {
    privacyEmail: string;
    processorName: string;
    privacyUrl: string;
    cookiesUrl: string;
  };
  notices: {
    consentVersion: string;
    privacyNoticeVersion: string;
    cookieNoticeVersion: string;
  };
  retention: {
    rawLocation: string;
    responses:
      "Responses and derived mappings are retained only for as long as necessary to conduct, validate, and document the stated research, after which they are deleted or irreversibly anonymised.";
  };
};

export type SurveyLegalSnapshotRecord = {
  surveyId: string;
  ownerId: string;
  snapshot: SurveyLegalSnapshot;
  capturedAt: string;
};

export function isOwnerLegalProfileComplete(
  profile: OwnerLegalProfile | null,
): profile is OwnerLegalProfile {
  return Boolean(
    profile?.controllerName.trim() &&
      profile.controllerCountry.trim() &&
      profile.contactEmail.trim() &&
      profile.privacyEmail.trim(),
  );
}

export function isOwnerDpaProfileComplete(
  profile: OwnerLegalProfile | null,
): profile is OwnerLegalProfile & {
  controllerAddress: string;
  representativeName: string;
  representativeTitle: string;
} {
  return Boolean(
    isOwnerLegalProfileComplete(profile) &&
      profile.controllerAddress?.trim() &&
      profile.representativeName?.trim() &&
      profile.representativeTitle?.trim(),
  );
}

export function buildSurveyLegalSnapshot(
  profile: OwnerLegalProfile,
  legal: LegalConfig,
  rawLocationRetentionLabel: string,
  capturedAt = new Date().toISOString(),
): SurveyLegalSnapshot {
  return {
    schemaVersion: 1,
    capturedAt,
    controller: {
      name: profile.controllerName,
      country: profile.controllerCountry,
      contactEmail: profile.contactEmail,
      privacyEmail: profile.privacyEmail,
      dpoEmail: profile.dpoEmail,
    },
    platform: {
      privacyEmail: legal.privacyEmail,
      processorName: legal.processorName,
      privacyUrl: legal.privacyUrl,
      cookiesUrl: legal.cookiesUrl,
    },
    notices: {
      consentVersion: legal.consentVersion,
      privacyNoticeVersion: legal.privacyNoticeVersion,
      cookieNoticeVersion: legal.cookieNoticeVersion,
    },
    retention: {
      rawLocation: rawLocationRetentionLabel,
      responses:
        "Responses and derived mappings are retained only for as long as necessary to conduct, validate, and document the stated research, after which they are deleted or irreversibly anonymised.",
    },
  };
}

export function buildLegacySurveyLegalSnapshot(
  legal: LegalConfig,
  rawLocationRetentionLabel: string,
): SurveyLegalSnapshot {
  const now = new Date().toISOString();

  return buildSurveyLegalSnapshot(
    {
      userId: "legacy-deployment-controller",
      controllerName: legal.controllerName,
      controllerCountry: legal.controllerCountry,
      contactEmail: legal.controllerContactEmail || legal.privacyEmail,
      privacyEmail: legal.privacyEmail || legal.controllerContactEmail,
      dpoEmail: null,
      controllerAddress: null,
      representativeName: null,
      representativeTitle: null,
      createdAt: now,
      updatedAt: now,
    },
    legal,
    rawLocationRetentionLabel,
    now,
  );
}
