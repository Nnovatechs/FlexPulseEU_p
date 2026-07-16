import type {
  PersistedSurvey,
  SurveyLanguageCode,
  SurveyQuestionDefinition,
} from "./generator-types";
import { getLegalConfig, LEGAL_CONSENT_SOURCE } from "@/lib/config/legal";
import { getRawLocationRetentionLabel } from "@/lib/config/response-retention";
import {
  buildLegacySurveyLegalSnapshot,
  type SurveyLegalSnapshot,
} from "@/features/privacy/types";
import { getPublicSurveyCopy } from "./public-copy";

export type SubmittedSurveyAnswer =
  | string
  | number
  | boolean
  | string[]
  | number[];

export type ValidatedPublicSurveySubmission = {
  submittedLanguage: SurveyLanguageCode;
  answers: Record<string, SubmittedSurveyAnswer>;
  countryCodeRaw: string | null;
  postalCodeRaw: string | null;
  legalConsent: {
    accepted: true;
    statement: string;
    consentVersion: string;
    privacyNoticeVersion: string;
    cookieNoticeVersion: string;
    source: typeof LEGAL_CONSENT_SOURCE;
  };
};

function isBlank(value: FormDataEntryValue | null) {
  return value == null || String(value).trim() === "";
}

function parseQuestionAnswer(
  question: SurveyQuestionDefinition,
  formData: FormData,
): SubmittedSurveyAnswer | undefined {
  const fieldName = `question:${question.question_key}`;

  if (question.type === "multiple_choice") {
    const values = formData
      .getAll(fieldName)
      .map((value) => String(value).trim())
      .filter(Boolean);

    return values.length > 0 ? values : undefined;
  }

  const rawValue = formData.get(fieldName);
  if (isBlank(rawValue)) {
    return undefined;
  }

  const value = String(rawValue).trim();

  if (question.type === "single_choice") {
    return value;
  }

  if (question.type === "rating_scale" || question.type === "numeric") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Question "${question.question_key}" expects a numeric answer.`);
    }
    return parsed;
  }

  if (question.type === "boolean") {
    if (value !== "true" && value !== "false") {
      throw new Error(`Question "${question.question_key}" expects a boolean answer.`);
    }
    return value === "true";
  }

  return value;
}

function validateQuestionAnswer(
  question: SurveyQuestionDefinition,
  answer: SubmittedSurveyAnswer | undefined,
) {
  if (question.required && answer == null) {
    throw new Error(`Question "${question.question_key}" is required.`);
  }

  if (answer == null) {
    return;
  }

  if (question.type === "single_choice") {
    const allowed = new Set(question.options?.map((option) => option.option_key) ?? []);
    if (!allowed.has(String(answer))) {
      throw new Error(`Question "${question.question_key}" contains an invalid option.`);
    }
  }

  if (question.type === "multiple_choice") {
    const allowed = new Set(question.options?.map((option) => option.option_key) ?? []);
    const values = Array.isArray(answer) ? answer : [];
    for (const value of values) {
      if (!allowed.has(String(value))) {
        throw new Error(`Question "${question.question_key}" contains an invalid option.`);
      }
    }
  }

  if (question.type === "rating_scale" && typeof answer === "number" && question.scale) {
    if (answer < question.scale.min || answer > question.scale.max) {
      throw new Error(`Question "${question.question_key}" is outside the allowed scale.`);
    }
  }

  if (question.type === "numeric" && typeof answer === "number" && question.numeric) {
    if (question.numeric.min != null && answer < question.numeric.min) {
      throw new Error(`Question "${question.question_key}" is below the minimum value.`);
    }
    if (question.numeric.max != null && answer > question.numeric.max) {
      throw new Error(`Question "${question.question_key}" is above the maximum value.`);
    }
  }
}

export function validatePublicSurveySubmission(
  survey: PersistedSurvey,
  formData: FormData,
  legalSnapshot?: SurveyLegalSnapshot | null,
): ValidatedPublicSurveySubmission {
  const submittedLanguage = String(formData.get("submittedLanguage") ?? "").trim();

  if (!submittedLanguage) {
    throw new Error("Submitted language is required.");
  }

  if (!survey.supported_languages.includes(submittedLanguage)) {
    throw new Error("Submitted language is not supported by this survey.");
  }

  const answers: Record<string, SubmittedSurveyAnswer> = {};

  for (const question of survey.definition_json.questions) {
    const answer = parseQuestionAnswer(question, formData);
    validateQuestionAnswer(question, answer);

    if (answer != null) {
      answers[question.question_key] = answer;
    }
  }

  const responseContext = survey.definition_json.survey_meta.response_context;
  const countryCodeRaw = String(formData.get("countryCode") ?? "").trim() || null;
  const postalCodeRaw = String(formData.get("postalCode") ?? "").trim() || null;

  if (responseContext?.collect_country_code && !countryCodeRaw) {
    throw new Error("Country code is required for this survey.");
  }

  if (responseContext?.collect_postal_code && !postalCodeRaw) {
    throw new Error("Postal code is required for this survey.");
  }

  if (String(formData.get("legalConsentAccepted") ?? "") !== "true") {
    throw new Error("Privacy information acceptance is required.");
  }

  const legal =
    legalSnapshot ??
    buildLegacySurveyLegalSnapshot(
      getLegalConfig(),
      getRawLocationRetentionLabel(),
    );
  const copy = getPublicSurveyCopy(submittedLanguage);

  return {
    submittedLanguage,
    answers,
    countryCodeRaw,
    postalCodeRaw,
    legalConsent: {
      accepted: true,
      statement: copy.legalConsentLabel,
      consentVersion: legal.notices.consentVersion,
      privacyNoticeVersion: legal.notices.privacyNoticeVersion,
      cookieNoticeVersion: legal.notices.cookieNoticeVersion,
      source: LEGAL_CONSENT_SOURCE,
    },
  };
}
