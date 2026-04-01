"use client";

import { useEffect, useState, useTransition } from "react";
import {
  validateSurveyContentAction,
  publishSurveyAction,
} from "@/features/surveys/actions";
import type {
  ContentValidationResult,
  SurveyQuestionDefinition,
  SurveyLanguageTranslations,
} from "@/features/surveys/generator-types";

const VALIDATION_STEPS = [
  "Scanning questions for personal data...",
  "Running multilingual PII detection...",
  "Checking for injection patterns...",
  "Verifying semantic alignment...",
  "Cross-referencing ontology targets...",
];

const VALIDATION_STEP_MS = 6000;

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

type ReviewTabProps = {
  surveyId: string;
  hasQuestions: boolean;
  questions: SurveyQuestionDefinition[];
  translations: SurveyLanguageTranslations | null;
  validationResult: ContentValidationResult | null;
  isStale: boolean;
};

export function ReviewTab({
  surveyId,
  hasQuestions,
  questions,
  translations,
  validationResult,
  isStale,
}: ReviewTabProps) {
  const [validatePending, startValidate] = useTransition();
  const [publishPending, startPublish] = useTransition();
  const [validateError, setValidateError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const canPublish =
    validationResult?.passed === true && !isStale && !validatePending;

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

  function handlePublish(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setPublishError(null);
    startPublish(async () => {
      try {
        await publishSurveyAction(formData);
      } catch (err) {
        setPublishError(
          err instanceof Error ? err.message : "Publish failed. Please try again.",
        );
      }
    });
  }

  // Build quick lookup: question_key → title
  const titleByKey: Record<string, string> = {};
  for (const q of questions) {
    titleByKey[q.question_key] =
      translations?.questions[q.question_key]?.title ?? q.question_key;
  }

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

  return (
    <div className="review-tab">
      {validatePending && <ValidationOverlay />}

      {/* ------------------------------------------------------------------ */}
      {/* Step 1 — Content validation                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="review-step">
        <div className="review-step__header">
          <span className="review-step__number">1</span>
          <div className="review-step__meta">
            <span className="review-step__title">Content validation</span>
            <span className="review-step__desc muted">
              PII check and semantic alignment against ontology concepts.
            </span>
          </div>
          <span
            className={`review-status review-status--${statusState}`}
            aria-label={`Validation status: ${statusState}`}
          >
            {statusState === "pending" && "Validating…"}
            {statusState === "stale" && "Outdated"}
            {statusState === "failed" && "Issues found"}
            {statusState === "passed" && "Passed"}
            {statusState === "none" && "Not run"}
          </span>
        </div>

        {/* Issues list */}
        {validationResult && validationResult.issues.length > 0 && (
          <div className="review-issues">
            {validationResult.issues.map((issue, i) => (
              <div key={i} className="review-issue">
                <span className={`review-issue__badge review-issue__badge--${issue.type}`}>
                  {issue.type === "pii"
                    ? "PII"
                    : issue.type === "prompt_injection"
                      ? "Injection"
                      : "Semantic"}
                </span>
                <div className="review-issue__body">
                  <span className="review-issue__question">
                    {titleByKey[issue.question_key] ?? issue.question_key}
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
            All {questions.length} questions passed PII, injection and semantic checks.
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
      {/* Step 2 — Publish                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className={`review-step${!canPublish ? " review-step--locked" : ""}`}>
        <div className="review-step__header">
          <span className="review-step__number">2</span>
          <div className="review-step__meta">
            <span className="review-step__title">Publish survey</span>
            <span className="review-step__desc muted">
              Freezes the survey definition and makes it available for
              responses. This action cannot be undone.
            </span>
          </div>
          {!canPublish && (
            <span className="review-status review-status--locked">Locked</span>
          )}
        </div>

        {publishError && (
          <p className="review-notice review-notice--error" role="alert">
            {publishError}
          </p>
        )}

        <form onSubmit={handlePublish} className="review-step__action">
          <input type="hidden" name="surveyId" value={surveyId} />
          <button
            type="submit"
            className="button button--primary"
            disabled={!canPublish || publishPending}
            title={
              !canPublish
                ? "Complete content validation before publishing"
                : "Publish and freeze this survey"
            }
          >
            {publishPending ? "Publishing…" : "Publish survey"}
          </button>
        </form>
      </div>
    </div>
  );
}
