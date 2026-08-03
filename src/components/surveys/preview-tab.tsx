"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getFlexpulseBehaviouralConceptByTarget } from "@/features/ontology/flexpulse-behavioural-schema";
import {
  DPA_ACCEPTANCE_REQUIRED_ERROR,
  PRIVACY_PROFILE_INCOMPLETE_ERROR,
} from "@/features/privacy/types";
import {
  applyExpertReviewAction,
  publishSurveyAction,
} from "@/features/surveys/actions";
import type { SurveyIntegrityState } from "@/features/surveys/expert-review";
import { appRoutes } from "@/lib/config/routes";
import { rethrowNextNavigationError } from "@/lib/navigation/errors";
import type {
  ContentValidationResult,
  ExpertReviewResult,
  ExpertReviewerType,
  MultilingualValidationIssue,
  MultilingualValidationResult,
  SurveyDefinition,
  SurveyLanguageCode,
  SurveyMappingDefinition,
  SurveyQuestionDefinition,
} from "@/features/surveys/generator-types";

const TYPE_LABELS: Record<string, string> = {
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  rating_scale: "Rating scale",
  free_text: "Free text",
  numeric: "Numeric",
  boolean: "Boolean",
};

const REVIEWER_TYPE_LABELS: Record<ExpertReviewerType, string> = {
  language_expert: "Language expert",
  domain_expert: "Domain expert",
  research_team: "Research team",
};

const EXPERT_REVIEW_CONFIRMATION = "EXPERT REVIEW";

function getMultilingualFlagLabel(flag: MultilingualValidationIssue) {
  if (flag.severity === "advisory") return "Recommendation";
  if (flag.type === "pii") return "PII";
  if (flag.type === "quality") return "Flag";
  if (flag.type === "cultural") return "Culture";
  return "Parity";
}

function getReadableOntologyTargetLabel(ontologyTarget: string) {
  const concept = getFlexpulseBehaviouralConceptByTarget(ontologyTarget);
  if (concept) {
    return concept.label;
  }

  const rawLabel = ontologyTarget.split(".").pop() ?? ontologyTarget;
  return rawLabel.replace(/_/g, " ");
}

type ReadOnlyQuestionCardProps = {
  index: number;
  question: SurveyQuestionDefinition;
  mapping: SurveyMappingDefinition | undefined;
  translation:
    | SurveyDefinition["translations"][string]["questions"][string]
    | undefined;
  languageFlags?: MultilingualValidationIssue[];
  questionIntent?: string[];
  editableTitle?: string;
  expertMode?: boolean;
  onChangeTitle?: (title: string) => void;
};

function ReadOnlyQuestionCard({
  index,
  question,
  mapping,
  translation,
  languageFlags = [],
  questionIntent = [],
  editableTitle = translation?.title ?? question.question_key,
  expertMode = false,
  onChangeTitle,
}: ReadOnlyQuestionCardProps) {
  return (
    <div
      className={`qov-card qov-card--preview${
        expertMode ? " qov-card--preview-editable" : ""
      }`}
    >
      <div className="qov-card__main">
        <div className="qov-card__header">
          <span className="qov-card__number">{index + 1}</span>
          {expertMode ? (
            <textarea
              className="qov-card__title-input qov-card__title-textarea"
              value={editableTitle}
              rows={2}
              onChange={(event) => onChangeTitle?.(event.target.value)}
              aria-label={`Expert review title for ${question.question_key}`}
            />
          ) : (
            <span className="qov-card__title">{editableTitle}</span>
          )}
          <span className={`qov-card__type qov-card__type--${question.type}`}>
            {TYPE_LABELS[question.type] ?? question.type}
          </span>
        </div>

        {languageFlags.length > 0 && (
          <div className="preview-tab__question-flags">
            {languageFlags.map((flag, index) => (
              <div key={`${question.question_key}-${index}`} className="preview-tab__flag">
                <span className="preview-tab__flag-badge">
                  {getMultilingualFlagLabel(flag)}
                </span>
                <span className="preview-tab__flag-message">
                  {flag.message}
                  {flag.recommendation ? ` Recommendation: ${flag.recommendation}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {translation?.description && (
          <p className="qov-card__description">{translation.description}</p>
        )}

        {question.options && question.options.length > 0 && (
          <div className="qov-card__options">
            {question.options.map((opt) => (
              <span key={opt.option_key} className="qov-card__option">
                {translation?.options?.[opt.option_key] ?? opt.option_key}
              </span>
            ))}
          </div>
        )}

        {question.scale && (
          <p className="qov-card__meta muted">
            Scale {question.scale.min}
            {translation?.scale?.min_label ?? question.scale.min_label
              ? ` (${translation?.scale?.min_label ?? question.scale.min_label})`
              : ""}{" "}
            → {question.scale.max}
            {translation?.scale?.max_label ?? question.scale.max_label
              ? ` (${translation?.scale?.max_label ?? question.scale.max_label})`
              : ""}
          </p>
        )}

        {question.numeric && (
          <p className="qov-card__meta muted">
            Numeric
            {question.numeric.unit ? ` · ${question.numeric.unit}` : ""}
            {question.numeric.min != null && question.numeric.max != null
              ? ` · ${question.numeric.min}–${question.numeric.max}`
              : ""}
          </p>
        )}
      </div>

      {mapping && (
        <div className="qov-card__mapping">
          <span className="qov-card__mapping-label">Maps to</span>
          <span className="qov-card__mapping-target">
            {getReadableOntologyTargetLabel(mapping.ontology_target)}
          </span>
          {questionIntent.length > 0 && (
            <>
              <span className="qov-card__mapping-label">Intent</span>
              <span className="qov-card__mapping-target">
                {questionIntent.join(" · ")}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type ExpertReviewLocalBundle = {
  survey_title: string;
  survey_description: string;
  questions: Record<string, string>;
};

function buildLocalExpertReviewDraft(
  translations: SurveyDefinition["translations"],
  supportedLanguages: SurveyLanguageCode[],
  questions: SurveyQuestionDefinition[],
): Record<SurveyLanguageCode, ExpertReviewLocalBundle> {
  return Object.fromEntries(
    supportedLanguages.map((language) => {
      const bundle = translations[language];
      return [
        language,
        {
          survey_title: bundle?.survey_title ?? "",
          survey_description: bundle?.survey_description ?? "",
          questions: Object.fromEntries(
            questions.map((question) => [
              question.question_key,
              bundle?.questions?.[question.question_key]?.title ?? "",
            ]),
          ),
        },
      ];
    }),
  );
}

function buildExpertReviewBatch(input: {
  translations: SurveyDefinition["translations"];
  supportedLanguages: SurveyLanguageCode[];
  questions: SurveyQuestionDefinition[];
  draft: Record<SurveyLanguageCode, ExpertReviewLocalBundle>;
}) {
  const changes: Array<{
    language: SurveyLanguageCode;
    field: "survey_title" | "survey_description" | "question_title";
    question_key?: string;
    reviewed_value: string;
  }> = [];

  for (const language of input.supportedLanguages) {
    const bundle = input.translations[language];
    const draftBundle = input.draft[language];
    if (!bundle || !draftBundle) {
      continue;
    }

    if (draftBundle.survey_title !== (bundle.survey_title ?? "")) {
      changes.push({
        language,
        field: "survey_title",
        reviewed_value: draftBundle.survey_title,
      });
    }

    if (draftBundle.survey_description !== (bundle.survey_description ?? "")) {
      changes.push({
        language,
        field: "survey_description",
        reviewed_value: draftBundle.survey_description,
      });
    }

    for (const question of input.questions) {
      const questionKey = question.question_key;
      const previousTitle = bundle.questions?.[questionKey]?.title ?? "";
      const reviewedTitle = draftBundle.questions[questionKey] ?? "";

      if (reviewedTitle !== previousTitle) {
        changes.push({
          language,
          field: "question_title",
          question_key: questionKey,
          reviewed_value: reviewedTitle,
        });
      }
    }
  }

  return changes;
}

type PreviewTabProps = {
  surveyId: string;
  surveyTitle: string;
  surveyDescription: string;
  questions: SurveyQuestionDefinition[];
  mappings: SurveyMappingDefinition[];
  translations: SurveyDefinition["translations"];
  defaultLanguage: SurveyLanguageCode;
  supportedLanguages: SurveyLanguageCode[];
  validationResult: ContentValidationResult | null;
  multilingualValidationResult: MultilingualValidationResult | null;
  isValidationStale: boolean;
  isMultilingualValidationStale: boolean;
  expertReviewResult: ExpertReviewResult | null;
  integrity: SurveyIntegrityState;
  questionIntentLookup: Record<string, string[]>;
};

export function PreviewTab({
  surveyId,
  surveyTitle,
  surveyDescription,
  questions,
  mappings,
  translations,
  defaultLanguage,
  supportedLanguages,
  validationResult,
  multilingualValidationResult,
  isValidationStale,
  isMultilingualValidationStale,
  expertReviewResult,
  integrity,
  questionIntentLookup,
}: PreviewTabProps) {
  const router = useRouter();
  const [activeLanguage, setActiveLanguage] = useState<SurveyLanguageCode>(
    defaultLanguage,
  );
  const [publishPending, startPublish] = useTransition();
  const [applyPending, startApply] = useTransition();
  const [publishError, setPublishError] = useState<string | null>(null);
  const [expertReviewError, setExpertReviewError] = useState<string | null>(null);
  const [isExpertReviewMode, setIsExpertReviewMode] = useState(false);
  const [isExpertReviewModalOpen, setIsExpertReviewModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [reviewerType, setReviewerType] =
    useState<ExpertReviewerType>("language_expert");
  const [reviewBasis, setReviewBasis] = useState("");
  const [reviewConfirmation, setReviewConfirmation] = useState("");
  const [localExpertReviewDraft, setLocalExpertReviewDraft] = useState(() =>
    buildLocalExpertReviewDraft(translations, supportedLanguages, questions),
  );

  const mappingByKey: Record<string, SurveyMappingDefinition> = {};
  for (const m of mappings) {
    mappingByKey[m.question_key] = m;
  }

  const activeTranslations = translations[activeLanguage];
  const hasSecondaryLanguages = supportedLanguages.some(
    (language) => language !== defaultLanguage,
  );
  const contentPassed = expertReviewResult
    ? integrity.expert_review_baseline_linked
    : validationResult?.passed === true && !isValidationStale;
  const multilingualPassed = expertReviewResult
    ? integrity.expert_review_baseline_linked
    : !hasSecondaryLanguages ||
      (multilingualValidationResult?.passed === true &&
        !isMultilingualValidationStale);
  const canPublish =
    !isExpertReviewMode &&
    (expertReviewResult
      ? integrity.can_publish_expert_reviewed
      : integrity.can_publish_automatic);
  const canStartExpertReview =
    !isExpertReviewMode &&
    (expertReviewResult
      ? integrity.expert_review_baseline_linked &&
        integrity.expert_review_final_current
      : integrity.automatic_baseline_ready);
  const multilingualBlockingIssueCount = (
    multilingualValidationResult?.issues ?? []
  ).filter((issue) => issue.severity !== "advisory").length;
  const surveyTitleForLanguage = isExpertReviewMode
    ? localExpertReviewDraft[activeLanguage]?.survey_title ?? ""
    : activeTranslations?.survey_title || surveyTitle;
  const surveyDescriptionForLanguage = isExpertReviewMode
    ? localExpertReviewDraft[activeLanguage]?.survey_description ?? ""
    : activeTranslations?.survey_description || surveyDescription;
  const activeLanguageIssues = (multilingualValidationResult?.issues ?? []).filter(
    (issue) => issue.language === activeLanguage && issue.question_key,
  );
  const surveyLevelFlags = (multilingualValidationResult?.issues ?? []).filter(
    (issue) => issue.language === activeLanguage && !issue.question_key,
  );
  const issuesByQuestionKey = activeLanguageIssues.reduce<
    Record<string, MultilingualValidationIssue[]>
  >((groups, issue) => {
    const key = issue.question_key as string;
    groups[key] = [...(groups[key] ?? []), issue];
    return groups;
  }, {});

  function handleConfirmPublish() {
    setPublishError(null);
    startPublish(async () => {
      try {
        const formData = new FormData();
        formData.set("surveyId", surveyId);
        const result = await publishSurveyAction(formData);
        if (result?.error) {
          setPublishError(result.error);
          return;
        }
        setIsPublishModalOpen(false);
      } catch (err) {
        rethrowNextNavigationError(err);
        setPublishError(
          err instanceof Error ? err.message : "Publish failed. Please try again.",
        );
      }
    });
  }

  function handleStartExpertReview() {
    if (!reviewBasis.trim()) {
      setExpertReviewError("Review note is required.");
      return;
    }

    if (reviewConfirmation.trim() !== EXPERT_REVIEW_CONFIRMATION) {
      setExpertReviewError(
        `Confirmation must be exactly "${EXPERT_REVIEW_CONFIRMATION}".`,
      );
      return;
    }

    setExpertReviewError(null);
    setLocalExpertReviewDraft(
      buildLocalExpertReviewDraft(translations, supportedLanguages, questions),
    );
    setIsExpertReviewModalOpen(false);
    setIsExpertReviewMode(true);
  }

  function handleDiscardLocalExpertReview() {
    setExpertReviewError(null);
    setIsExpertReviewMode(false);
    setLocalExpertReviewDraft(
      buildLocalExpertReviewDraft(translations, supportedLanguages, questions),
    );
  }

  function handleApplyExpertReview() {
    const changes = buildExpertReviewBatch({
      translations,
      supportedLanguages,
      questions,
      draft: localExpertReviewDraft,
    });

    setExpertReviewError(null);
    startApply(async () => {
      try {
        await applyExpertReviewAction({
          surveyId,
          reviewerType,
          reviewBasis,
          confirmation: EXPERT_REVIEW_CONFIRMATION,
          changes,
        });
        setIsExpertReviewMode(false);
        setReviewConfirmation("");
        router.refresh();
      } catch (err) {
        rethrowNextNavigationError(err);
        setExpertReviewError(
          err instanceof Error
            ? err.message
            : "Expert review failed. Please try again.",
        );
      }
    });
  }

  function updateSurveyHeaderField(
    language: SurveyLanguageCode,
    field: "survey_title" | "survey_description",
    value: string,
  ) {
    setLocalExpertReviewDraft((current) => ({
      ...current,
      [language]: {
        ...current[language],
        [field]: value,
      },
    }));
  }

  function openExpertReviewModal() {
    setExpertReviewError(null);
    setReviewerType(expertReviewResult?.reviewer_type ?? "language_expert");
    setReviewBasis(expertReviewResult?.review_basis ?? "");
    setReviewConfirmation("");
    setIsExpertReviewModalOpen(true);
  }

  function updateQuestionTitle(
    language: SurveyLanguageCode,
    questionKey: string,
    value: string,
  ) {
    setLocalExpertReviewDraft((current) => ({
      ...current,
      [language]: {
        ...current[language],
        questions: {
          ...current[language].questions,
          [questionKey]: value,
        },
      },
    }));
  }

  const publishSection = (
    <div className="preview-tab__publish">
      {!contentPassed && (
        <p className="review-notice review-notice--warning">
          Preview remains available, but publication is blocked until content validation
          passes
          {isValidationStale && !expertReviewResult ? " and is up to date" : ""}.
        </p>
      )}

      {!multilingualPassed && hasSecondaryLanguages && !expertReviewResult && (
        <p className="review-notice review-notice--warning">
          Preview remains available, but publication is blocked until multicultural
          blocking flags are cleared and the adapted language versions pass validation
          {isMultilingualValidationStale ? " again" : ""}.
        </p>
      )}
      {isExpertReviewMode && (
        <p className="review-notice review-notice--warning">
          Expert review is active locally. Publication is disabled until you apply
          or discard the review.
        </p>
      )}
      {expertReviewResult && integrity.can_publish_expert_reviewed && !isExpertReviewMode && (
        <p className="review-notice review-notice--success">
          Expert review is applied and the current reviewed version is ready to
          publish.
        </p>
      )}
      {expertReviewResult &&
        !integrity.can_publish_expert_reviewed &&
        !isExpertReviewMode && (
          <p className="review-notice review-notice--warning">
            Expert review is stored, but publication remains blocked until the final
            expert-reviewed copy matches the frozen review snapshot and the automatic
            baseline remains valid.
          </p>
        )}
      {multilingualPassed &&
        hasSecondaryLanguages &&
        multilingualBlockingIssueCount === 0 &&
        !expertReviewResult &&
        (multilingualValidationResult?.issues.length ?? 0) > 0 && (
          <p className="review-notice review-notice--success">
            Publication is allowed. Non-blocking multicultural recommendations are
            available for review before publishing.
          </p>
        )}

      {expertReviewError && (
        <p className="review-notice review-notice--error" role="alert">
          {expertReviewError}
        </p>
      )}

      {publishError && (
        <div
          className={`review-notice ${
            publishError === PRIVACY_PROFILE_INCOMPLETE_ERROR ||
            publishError === DPA_ACCEPTANCE_REQUIRED_ERROR
              ? "review-notice--warning"
              : "review-notice--error"
          }`}
          role="alert"
        >
          {publishError === PRIVACY_PROFILE_INCOMPLETE_ERROR ? (
            <>
              Complete your Privacy Settings before publishing this survey.{" "}
              <Link
                href={appRoutes.privacySettings}
                target="_blank"
                className="preview-tab__privacy-settings-link"
              >
                Open Privacy Settings
              </Link>
              .
            </>
          ) : publishError === DPA_ACCEPTANCE_REQUIRED_ERROR ? (
            <>
              Review and accept the current Data Processing Agreement before
              publishing this survey.{" "}
              <Link
                href={appRoutes.dpa}
                target="_blank"
                className="preview-tab__privacy-settings-link"
              >
                Open DPA
              </Link>
              .
            </>
          ) : (
            publishError
          )}
        </div>
      )}

      {expertReviewResult && (
        <div className="preview-tab__expert-review-summary">
          <p className="muted">
            Latest expert review:{" "}
            {REVIEWER_TYPE_LABELS[expertReviewResult.reviewer_type]}.
          </p>
        </div>
      )}

      <div className="preview-tab__publish-actions">
        <div className="preview-tab__expert-review-actions">
          {isExpertReviewMode ? (
            <>
              <button
                type="button"
                className="button button--secondary"
                onClick={handleDiscardLocalExpertReview}
                disabled={applyPending}
              >
                Discard local expert review
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={handleApplyExpertReview}
                disabled={applyPending}
              >
                {applyPending
                  ? "Applying expert review…"
                  : expertReviewResult
                    ? "Apply updated expert review"
                    : "Apply expert review"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button button--secondary"
              onClick={openExpertReviewModal}
              disabled={!canStartExpertReview || publishPending || applyPending}
              title={
                canStartExpertReview
                  ? expertReviewResult
                    ? "Open expert review again"
                    : "Start expert review"
                  : "Expert review is available only when the automatic baseline is fully current"
              }
            >
              {expertReviewResult ? "Open expert review again" : "Start expert review"}
            </button>
          )}
        </div>

        <div className="preview-tab__publish-button">
          <button
            type="button"
            className="button button--primary"
            disabled={publishPending || !canPublish}
            onClick={() => {
              setPublishError(null);
              setIsPublishModalOpen(true);
            }}
            title={
              canPublish
                ? "Publish survey"
                : "Publishing stays blocked until the automatic or expert-review integrity checks are satisfied"
            }
          >
            {publishPending ? "Publishing…" : "Publish survey"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="preview-tab">
      {publishSection}

      {isExpertReviewModalOpen && (
        <div className="generate-overlay" role="dialog" aria-modal="true">
          <div className="generate-overlay__card preview-tab__modal-card">
            <div className="preview-tab__modal-header">
              <p className="generate-overlay__title">
                {expertReviewResult
                  ? "Open expert review again"
                  : "Start expert review"}
              </p>
              <p className="preview-tab__modal-intro muted">
                {expertReviewResult
                  ? "You are re-opening the expert review stage on top of the current reviewed copy. Changes made here will not be re-evaluated automatically, so the final wording should only be adjusted with linguistic or expert input."
                  : "You are entering the expert review stage after automated validation. Changes made here will not be re-evaluated automatically, so the final wording should only be adjusted with linguistic or expert input."}
              </p>
            </div>
            <label className="field">
              <span>Reviewer role</span>
              <select
                value={reviewerType}
                onChange={(event) =>
                  setReviewerType(event.target.value as ExpertReviewerType)
                }
              >
                <option value="language_expert">Language expert</option>
                <option value="domain_expert">Domain expert</option>
                <option value="research_team">Research team</option>
              </select>
            </label>
            <label className="field">
              <span>Review note</span>
              <textarea
                value={reviewBasis}
                rows={4}
                onChange={(event) => setReviewBasis(event.target.value)}
                placeholder="Example: Reviewed with a native French linguist and approved for publication."
              />
              <span className="preview-tab__modal-help">
                This note is saved in the audit trail so it stays clear who reviewed
                the final wording and why.
              </span>
            </label>
            <label className="field">
              <span>Type {EXPERT_REVIEW_CONFIRMATION}</span>
              <input
                value={reviewConfirmation}
                onChange={(event) => setReviewConfirmation(event.target.value)}
              />
              <span className="preview-tab__modal-help">
                This confirms that the final wording is being accepted manually.
              </span>
            </label>
            {expertReviewError && (
              <p className="review-notice review-notice--error" role="alert">
                {expertReviewError}
              </p>
            )}
            <div className="preview-tab__modal-actions">
              <button
                type="button"
                className="button button--primary"
                onClick={handleStartExpertReview}
              >
                Enter expert review
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  setExpertReviewError(null);
                  setReviewConfirmation("");
                  setIsExpertReviewModalOpen(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isPublishModalOpen && (
        <div className="generate-overlay" role="dialog" aria-modal="true">
          <div className="generate-overlay__card preview-tab__modal-card">
            <div className="preview-tab__modal-header">
              <p className="generate-overlay__title">Publish survey</p>
              <p className="preview-tab__modal-intro muted">
                Publishing will freeze the survey and all of its translations.
                Once published, the survey can no longer be modified through the
                draft editing flow, and this action cannot be undone.
              </p>
              <p className="preview-tab__modal-intro muted">
                Confirm only if the survey is final and ready to start collecting
                responses.
              </p>
            </div>
            {publishError && (
              <div
                className={`review-notice ${
                  publishError === PRIVACY_PROFILE_INCOMPLETE_ERROR ||
                  publishError === DPA_ACCEPTANCE_REQUIRED_ERROR
                    ? "review-notice--warning"
                    : "review-notice--error"
                }`}
                role="alert"
              >
                {publishError === PRIVACY_PROFILE_INCOMPLETE_ERROR ? (
                  <>
                    Complete your Privacy Settings before publishing this survey.{" "}
                    <Link
                      href={appRoutes.privacySettings}
                      target="_blank"
                      className="preview-tab__privacy-settings-link"
                    >
                      Open Privacy Settings
                    </Link>
                    .
                  </>
                ) : publishError === DPA_ACCEPTANCE_REQUIRED_ERROR ? (
                  <>
                    Review and accept the current Data Processing Agreement before
                    publishing this survey.{" "}
                    <Link
                      href={appRoutes.dpa}
                      target="_blank"
                      className="preview-tab__privacy-settings-link"
                    >
                      Open DPA
                    </Link>
                    .
                  </>
                ) : (
                  publishError
                )}
              </div>
            )}
            <div className="preview-tab__modal-actions">
              <button
                type="button"
                className="button button--primary"
                onClick={handleConfirmPublish}
                disabled={publishPending}
              >
                {publishPending ? "Publishing…" : "Accept and publish"}
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  setPublishError(null);
                  setIsPublishModalOpen(false);
                }}
                disabled={publishPending}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Language sub-tabs */}
      {supportedLanguages.length > 1 && (
        <nav
          className="preview-tab__lang-nav"
          role="tablist"
          aria-label="Preview by language"
        >
          {supportedLanguages.map((language) => (
            <button
              key={language}
              type="button"
              role="tab"
              aria-selected={activeLanguage === language}
              className={`preview-tab__lang-tab${
                activeLanguage === language ? " preview-tab__lang-tab--active" : ""
              }`}
              onClick={() => setActiveLanguage(language)}
            >
              {language}
              {language === defaultLanguage && (
                <span className="preview-tab__lang-canonical muted">
                  {" "}canonical
                </span>
              )}
            </button>
          ))}
        </nav>
      )}

      {/* Survey header */}
      <div className="preview-tab__survey-header">
        {isExpertReviewMode ? (
          <div className="preview-tab__survey-edit">
            <label className="field">
              <span>Survey title</span>
              <input
                value={surveyTitleForLanguage}
                onChange={(event) =>
                  updateSurveyHeaderField(
                    activeLanguage,
                    "survey_title",
                    event.target.value,
                  )
                }
              />
            </label>
            <label className="field">
              <span>Survey description</span>
              <textarea
                value={surveyDescriptionForLanguage}
                rows={3}
                onChange={(event) =>
                  updateSurveyHeaderField(
                    activeLanguage,
                    "survey_description",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>
        ) : (
          <>
            <h3 className="preview-tab__survey-title">{surveyTitleForLanguage}</h3>
            {surveyDescriptionForLanguage && (
              <p className="preview-tab__survey-description muted">
                {surveyDescriptionForLanguage}
              </p>
            )}
          </>
        )}
        {surveyLevelFlags.length > 0 && (
          <div className="preview-tab__survey-flags">
            {surveyLevelFlags.map((flag, index) => (
              <div key={`${activeLanguage}-survey-${index}`} className="preview-tab__flag">
                <span className="preview-tab__flag-badge">
                  {getMultilingualFlagLabel(flag)}
                </span>
                <span className="preview-tab__flag-message">
                  {flag.message}
                  {flag.recommendation ? ` Recommendation: ${flag.recommendation}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Read-only question list */}
      <div className="preview-tab__questions">
        {questions.length === 0 ? (
          <p className="muted">No questions to preview.</p>
        ) : (
          questions.map((q, index) => (
            <ReadOnlyQuestionCard
              key={q.question_key}
              index={index}
              question={q}
              mapping={mappingByKey[q.question_key]}
              translation={activeTranslations?.questions?.[q.question_key]}
              languageFlags={issuesByQuestionKey[q.question_key] ?? []}
              questionIntent={questionIntentLookup[q.question_key] ?? []}
              editableTitle={
                isExpertReviewMode
                  ? localExpertReviewDraft[activeLanguage]?.questions[q.question_key] ??
                    activeTranslations?.questions?.[q.question_key]?.title ??
                    q.question_key
                  : activeTranslations?.questions?.[q.question_key]?.title ??
                    q.question_key
              }
              expertMode={isExpertReviewMode}
              onChangeTitle={(title) =>
                updateQuestionTitle(activeLanguage, q.question_key, title)
              }
            />
          ))
        )}
      </div>

    </div>
  );
}
