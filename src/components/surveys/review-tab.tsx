"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  generateSurveyTranslationsAction,
  validateSurveyContentAction,
} from "@/features/surveys/actions";
import type {
  ContentValidationResult,
  MultilingualValidationIssue,
  MultilingualValidationResult,
  SurveyLanguageCode,
  SurveyQuestionDefinition,
  SurveyLanguageTranslations,
} from "@/features/surveys/generator-types";
import {
  buildQuestionTitleLookup,
  getMultilingualIssueQuestionTitle,
} from "@/features/surveys/review-title-helpers";

const VALIDATION_STEPS = [
  "Scanning questions for personal data...",
  "Running multilingual PII detection...",
  "Checking for injection patterns...",
  "Verifying semantic alignment...",
  "Cross-referencing ontology targets...",
];

const VALIDATION_STEP_MS = 6000;
const TRANSLATION_STEPS = [
  "Preparing multicultural versions...",
  "Adapting target languages...",
  "Checking semantic parity...",
  "Checking cultural phrasing...",
  "Validating multicultural output...",
];

function ValidationOverlay() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % VALIDATION_STEPS.length);
    }, VALIDATION_STEP_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="generate-overlay" role="status" aria-live="polite">
      <div className="generate-overlay__card">
        <div className="generate-overlay__spinner" aria-hidden="true" />
        <p className="generate-overlay__title">Validating survey</p>
        <p className="generate-overlay__step">{VALIDATION_STEPS[stepIndex]}</p>
      </div>
    </div>
  );
}

function TranslationOverlay() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % TRANSLATION_STEPS.length);
    }, VALIDATION_STEP_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="generate-overlay" role="status" aria-live="polite">
      <div className="generate-overlay__card">
        <div className="generate-overlay__spinner" aria-hidden="true" />
        <p className="generate-overlay__title">Generating multicultural versions</p>
        <p className="generate-overlay__step">{TRANSLATION_STEPS[stepIndex]}</p>
      </div>
    </div>
  );
}

type ReviewTabProps = {
  surveyId: string;
  hasQuestions: boolean;
  questions: SurveyQuestionDefinition[];
  translations: SurveyLanguageTranslations | null;
  translationsByLanguage: Partial<Record<SurveyLanguageCode, SurveyLanguageTranslations>>;
  validationResult: ContentValidationResult | null;
  isStale: boolean;
  defaultLanguage: SurveyLanguageCode;
  supportedLanguages: SurveyLanguageCode[];
  multilingualValidationResult: MultilingualValidationResult | null;
  isMultilingualStale: boolean;
};

export function ReviewTab({
  surveyId,
  hasQuestions,
  questions,
  translations,
  translationsByLanguage,
  validationResult,
  isStale,
  defaultLanguage,
  supportedLanguages,
  multilingualValidationResult,
  isMultilingualStale,
}: ReviewTabProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [validatePending, startValidate] = useTransition();
  const [translatePending, startTranslate] = useTransition();
  const [validateError, setValidateError] = useState<string | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const hasSecondaryLanguages = supportedLanguages.some(
    (language) => language !== defaultLanguage,
  );
  const contentPassed =
    validationResult?.passed === true && !isStale && !validatePending;
  const canOpenPreview = hasQuestions && !translatePending && !validatePending;

  function handleOpenPreview() {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", "preview");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleValidate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setValidateError(null);
    startValidate(async () => {
      try {
        await validateSurveyContentAction(formData);
      } catch (err) {
        setValidateError(
          err instanceof Error ? err.message : "Validation failed. Please try again.",
        );
      }
    });
  }

  function handleGenerateTranslations(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setTranslateError(null);
    startTranslate(async () => {
      try {
        await generateSurveyTranslationsAction(formData);
      } catch (err) {
        setTranslateError(
          err instanceof Error
            ? err.message
            : "Generation of multicultural versions failed. Please try again.",
        );
      }
    });
  }

  const canonicalTitleByKey = buildQuestionTitleLookup(questions, translations);

  const multilingualIssuesByLanguage = (multilingualValidationResult?.issues ?? []).reduce<
    Partial<Record<SurveyLanguageCode, MultilingualValidationIssue[]>>
  >((groups, issue) => {
    const current = groups[issue.language] ?? [];
    groups[issue.language] = [...current, issue];
    return groups;
  }, {});

  // -------------------------------------------------------------------------
  // States
  // -------------------------------------------------------------------------

  if (!hasQuestions) {
    return (
      <div className="review-empty">
        <p className="review-empty__text">No questions yet.</p>
        <p className="review-empty__hint muted">
          Go to <strong>Configuration</strong>, select ontology concepts and
          click <strong>Save and generate</strong> first.
        </p>
      </div>
    );
  }

  const statusState: "pending" | "stale" | "failed" | "passed" | "none" =
    validatePending
      ? "pending"
      : isStale && validationResult
        ? "stale"
        : validationResult?.passed === false
          ? "failed"
          : validationResult?.passed === true
            ? "passed"
            : "none";
  const multilingualStatusState:
    | "pending"
    | "stale"
    | "failed"
    | "passed"
    | "none"
    | "locked"
    | "not_required" =
    !hasSecondaryLanguages
      ? "not_required"
      : translatePending
        ? "pending"
        : !contentPassed
          ? "locked"
          : isMultilingualStale && multilingualValidationResult
            ? "stale"
            : multilingualValidationResult?.passed === false
              ? "failed"
              : multilingualValidationResult?.passed === true
                ? "passed"
                : "none";

  function getContentIssueLabel(
    type: "pii" | "semantic" | "quality" | "prompt_injection",
  ) {
    if (type === "pii") return "PII";
    if (type === "quality") return "Quality";
    if (type === "prompt_injection") return "Injection";
    return "Semantic";
  }

  function getContentIssueClass(
    type: "pii" | "semantic" | "quality" | "prompt_injection",
  ) {
    if (type === "pii") return "review-issue__badge--pii";
    if (type === "quality") return "review-issue__badge--quality";
    if (type === "prompt_injection") {
      return "review-issue__badge--prompt_injection";
    }
    return "review-issue__badge--semantic";
  }

  function getMultilingualIssueLabel(type: "parity" | "quality" | "pii" | "cultural") {
    if (type === "pii") return "PII";
    if (type === "quality") return "Quality";
    if (type === "cultural") return "Culture";
    return "Parity";
  }

  function getMultilingualIssueDisplayLabel(issue: MultilingualValidationIssue) {
    if (issue.severity === "advisory") return "Recommendation";
    return getMultilingualIssueLabel(issue.type);
  }

  function getMultilingualIssueClass(type: "parity" | "quality" | "pii" | "cultural") {
    if (type === "pii") return "review-issue__badge--pii";
    if (type === "quality") return "review-issue__badge--quality";
    if (type === "cultural") return "review-issue__badge--cultural";
    return "review-issue__badge--parity";
  }

  return (
    <div className="review-tab">
      {validatePending && <ValidationOverlay />}
      {translatePending && <TranslationOverlay />}

      {/* ------------------------------------------------------------------ */}
      {/* Step 1 — Content validation                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="review-step">
        <div className="review-step__header">
          <span className="review-step__number">1</span>
          <div className="review-step__meta">
            <span className="review-step__title">Content validation</span>
            <span className="review-step__desc muted">
              PII check, publishability review and semantic alignment against ontology concepts.
            </span>
          </div>
          <span
            className={`review-status review-status--${statusState}`}
            aria-label={`Validation status: ${statusState}`}
          >
            {statusState === "pending" && "Validating…"}
            {statusState === "stale" && "Outdated"}
            {statusState === "failed" && "Flags found"}
            {statusState === "passed" && "Passed"}
            {statusState === "none" && "Not run"}
          </span>
        </div>

        {/* Issues list */}
        {validationResult && validationResult.issues.length > 0 && (
          <div className="review-issues">
            {validationResult.issues.map((issue, i) => (
              <div key={i} className="review-issue">
                <span
                  className={`review-issue__badge ${getContentIssueClass(issue.type)}`}
                >
                  {getContentIssueLabel(issue.type)}
                </span>
                <div className="review-issue__body">
                  <span className="review-issue__question">
                    {canonicalTitleByKey[issue.question_key] ?? issue.question_key}
                  </span>
                  <span className="review-issue__message muted">
                    {issue.message}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stale notice */}
        {isStale && validationResult && (
          <p className="review-notice review-notice--warning">
            Questions were edited after the last validation. Re-run to get an
            up-to-date result.
          </p>
        )}

        {/* Passed notice */}
        {statusState === "passed" && (
          <p className="review-notice review-notice--success">
            All {questions.length} questions passed PII, injection, quality and semantic checks.
          </p>
        )}

        {validateError && (
          <p className="review-notice review-notice--error" role="alert">
            {validateError}
          </p>
        )}

        <form onSubmit={handleValidate} className="review-step__action">
          <input type="hidden" name="surveyId" value={surveyId} />
          <button
            type="submit"
            className="button button--secondary"
            disabled={validatePending}
          >
            {validatePending ? "Validating…" : statusState === "none" ? "Run validation" : "Re-run validation"}
          </button>
        </form>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Step 2 — Multilingual validation                                    */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={`review-step${multilingualStatusState === "locked" ? " review-step--locked" : ""}`}
      >
        <div className="review-step__header">
          <span className="review-step__number">2</span>
          <div className="review-step__meta">
            <span className="review-step__title">Multicultural validation</span>
            <span className="review-step__desc muted">
              Creates culturally adapted language versions and validates semantic
              parity, cultural fit and publishable quality before publication.
            </span>
          </div>
          <span
            className={`review-status review-status--${multilingualStatusState}`}
            aria-label={`Multilingual validation status: ${multilingualStatusState}`}
          >
            {multilingualStatusState === "pending" && "Running…"}
            {multilingualStatusState === "stale" && "Outdated"}
            {multilingualStatusState === "failed" && "Flags found"}
            {multilingualStatusState === "passed" && "Passed"}
            {multilingualStatusState === "none" && "Not run"}
            {multilingualStatusState === "locked" && "Locked"}
            {multilingualStatusState === "not_required" && "Not required"}
          </span>
        </div>

        {!hasSecondaryLanguages ? (
          <p className="review-notice review-notice--success">
            No additional languages are selected. Multilingual validation is not required.
          </p>
        ) : null}

        {multilingualStatusState === "locked" && (
          <p className="review-notice review-notice--warning">
            Complete content validation first. Multicultural versions are only
            generated from a validated canonical survey.
          </p>
        )}

        {isMultilingualStale && multilingualValidationResult && (
          <p className="review-notice review-notice--warning">
            Supported languages or translated content changed after the last multilingual
            validation. Re-run it before publishing.
          </p>
        )}

        {multilingualValidationResult &&
        multilingualValidationResult.issues.length > 0 ? (
          <div className="review-language-groups">
            {supportedLanguages
              .filter((language) => language !== defaultLanguage)
              .map((language) => {
                const issues = multilingualIssuesByLanguage[language] ?? [];
                const languageStatus =
                  multilingualValidationResult.language_statuses.find(
                    (status) => status.language === language,
                  ) ?? null;

                return (
                  <div key={language} className="review-language-group">
                    <div className="review-language-group__header">
                      <span className="review-language-group__title">{language}</span>
                      <span
                        className={`review-status review-status--${
                          languageStatus?.passed ? "passed" : "failed"
                        }`}
                      >
                        {languageStatus?.passed
                          ? issues.length > 0
                            ? "Recommendations"
                            : "Passed"
                          : "Issues found"}
                      </span>
                    </div>

                    {issues.length > 0 ? (
                      <div className="review-issues">
                        {issues.map((issue, index) => (
                          <div key={`${language}-${index}`} className="review-issue">
                            <span
                              className={`review-issue__badge ${getMultilingualIssueClass(
                                issue.type,
                              )}`}
                            >
                              {getMultilingualIssueDisplayLabel(issue)}
                            </span>
                            <div className="review-issue__body">
                              <span className="review-issue__question">
                                {issue.question_key
                                  ? (getMultilingualIssueQuestionTitle({
                                      issue,
                                      canonicalTitleByKey,
                                      translationsByLanguage,
                                    }) ?? issue.question_key)
                                  : "Survey-level issue"}
                              </span>
                              <span className="review-issue__message muted">
                                {issue.message}
                                {issue.recommendation
                                  ? ` Recommendation: ${issue.recommendation}`
                                  : ""}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="review-notice review-notice--success">
                        Multicultural version passed semantic and cultural validation.
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        ) : null}

        {multilingualStatusState === "passed" && hasSecondaryLanguages && (
          <p className="review-notice review-notice--success">
            All selected multicultural versions passed parity, cultural and quality
            checks.
          </p>
        )}

        {translateError && (
          <p className="review-notice review-notice--error" role="alert">
            {translateError}
          </p>
        )}

        <form onSubmit={handleGenerateTranslations} className="review-step__action">
          <input type="hidden" name="surveyId" value={surveyId} />
          <button
            type="submit"
            className="button button--secondary"
            disabled={
              multilingualStatusState === "locked" ||
              multilingualStatusState === "not_required" ||
              translatePending
            }
            title={
              multilingualStatusState === "locked"
                ? "Pass content validation first"
                : multilingualStatusState === "not_required"
                  ? "No additional languages selected"
                  : "Generate and validate multicultural versions"
            }
          >
            {translatePending
              ? "Generating multicultural versions…"
              : multilingualStatusState === "none"
                ? "Generate multicultural versions"
                : "Re-run multicultural validation"}
          </button>
        </form>
      </div>

      <div className="review-preview-cta">
        <button
          type="button"
          className="button button--primary"
          disabled={!canOpenPreview}
          onClick={handleOpenPreview}
          title={
            !canOpenPreview
              ? "Add questions first to open the preview"
              : "Open read-only preview for all languages"
          }
        >
          Preview
        </button>
      </div>
    </div>
  );
}
