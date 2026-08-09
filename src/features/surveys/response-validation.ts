import type {
  PersistedSurvey,
  SurveyLanguageCode,
  SurveyQuestionDefinition,
} from "./generator-types";
import { normalizeSurveyResponseContextConfig } from "./generator-types";
import { getLegalConfig, LEGAL_CONSENT_SOURCE } from "@/lib/config/legal";
import { getRawLocationRetentionLabel } from "@/lib/config/response-retention";
import {
  buildLegacySurveyLegalSnapshot,
  type SurveyLegalSnapshot,
} from "@/features/privacy/types";
import {
  classifyPostalCodeInput,
  getPostalPrefixFieldSpec,
} from "./postal-code";
import { surveyCountryOptions } from "./country-options";
import { getPublicSurveyCopy } from "./public-copy";
import {
  isQuestionVisible,
  orderSurveyQuestions,
} from "./question-visibility";

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

    const selectedExclusiveValues = values.filter((value) =>
      question.exclusive_option_keys?.includes(String(value)),
    );
    if (
      selectedExclusiveValues.length > 1 ||
      (selectedExclusiveValues.length === 1 && values.length > 1)
    ) {
      throw new Error(
        `Question "${question.question_key}" contains mutually exclusive options.`,
      );
    }
  }

  if (question.type === "rating_scale" && typeof answer === "number" && question.scale) {
    if (answer < question.scale.min || answer > question.scale.max) {
      throw new Error(`Question "${question.question_key}" is outside the allowed scale.`);
    }
    if (question.scale.step != null) {
      const step = question.scale.step;
      const offsetInSteps = (answer - question.scale.min) / step;
      if (
        step <= 0 ||
        Math.abs(offsetInSteps - Math.round(offsetInSteps)) > 1e-9
      ) {
        throw new Error(
          `Question "${question.question_key}" does not match the allowed scale step.`,
        );
      }
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

/**
 * Parses and validates a public submission, retaining only currently visible answers.
 */
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

  for (const question of orderSurveyQuestions(survey.definition_json.questions)) {
    if (!isQuestionVisible(question, answers)) {
      continue;
    }

    const answer = parseQuestionAnswer(question, formData);
    validateQuestionAnswer(question, answer);

    if (answer != null) {
      answers[question.question_key] = answer;
    }
  }

  const responseContext = normalizeSurveyResponseContextConfig(
    survey.definition_json.survey_meta.response_context,
  );
  const countryCodeRaw =
    String(formData.get("countryCode") ?? "").trim().toUpperCase() || null;
  const postalCodeRaw = String(formData.get("postalCode") ?? "").trim() || null;
  const allowedCountryCodes = new Set<string>(
    surveyCountryOptions.map((option) => option.code),
  );

  if (responseContext?.collect_country_code && !countryCodeRaw) {
    throw new Error("Country code is required for this survey.");
  }

  if (countryCodeRaw && !allowedCountryCodes.has(countryCodeRaw)) {
    throw new Error("Country code is invalid for this survey.");
  }

  if (responseContext?.collect_postal_code && !postalCodeRaw) {
    throw new Error("Postal code is required for this survey.");
  }

  if (
    responseContext.collect_postal_code &&
    responseContext.postal_collection_mode === "prefix" &&
    countryCodeRaw &&
    postalCodeRaw
  ) {
    const prefixSpec = getPostalPrefixFieldSpec(countryCodeRaw);
    const postalInput = classifyPostalCodeInput({
      countryCode: countryCodeRaw,
      postalCode: postalCodeRaw,
      collectionMode: "prefix",
    });

    if (!prefixSpec || postalInput.inputStatus !== "prefix") {
      throw new Error("Postal prefix is invalid for the selected country.");
    }
  }

  if (String(formData.get("legalConsentAccepted") ?? "") !== "true") {
    throw new Error("Privacy information acceptance is required.");
  }

  const legal =
    legalSnapshot ??
    // Older published surveys may predate immutable legal snapshots.
    // Keep this fallback for those legacy records instead of breaking them.
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
