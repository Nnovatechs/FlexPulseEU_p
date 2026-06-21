"use client";

import Script from "next/script";
import { useEffect, useState, useRef, useTransition } from "react";
import Link from "next/link";
import type {
  SurveyLanguageTranslations,
  SurveyQuestionDefinition,
  SurveyResponseContextConfig,
} from "@/features/surveys/generator-types";
import { surveyCountryOptions } from "@/features/surveys/country-options";
import type { PublicSurveyCopy } from "@/features/surveys/public-copy";
import { appRoutes } from "@/lib/config/routes";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; theme?: "light" | "dark" | "auto" },
      ) => string | undefined;
      remove?: (widgetId: string) => void;
    };
  }
}

// ─── Language metadata ────────────────────────────────────────────────────

const LANGUAGE_META: Record<string, { flag: string; nativeName: string }> = {
  English: { flag: "🇬🇧", nativeName: "English" },
  Spanish: { flag: "🇪🇸", nativeName: "Español" },
  French: { flag: "🇫🇷", nativeName: "Français" },
  Croatian: { flag: "🇭🇷", nativeName: "Hrvatski" },
  German: { flag: "🇩🇪", nativeName: "Deutsch" },
  Italian: { flag: "🇮🇹", nativeName: "Italiano" },
  Portuguese: { flag: "🇵🇹", nativeName: "Português" },
  Dutch: { flag: "🇳🇱", nativeName: "Nederlands" },
};

function getLangMeta(lang: string) {
  return LANGUAGE_META[lang] ?? { flag: "🌐", nativeName: lang };
}

// ─── Block computation ────────────────────────────────────────────────────

function computeBlocks(questions: SurveyQuestionDefinition[]): SurveyQuestionDefinition[][] {
  const n = questions.length;
  if (n === 0) return [[]];
  if (n <= 6) return [questions];

  // Target ~5-7 questions per block, more blocks for larger surveys
  const targetBlockSize = n <= 15 ? 5 : n <= 35 ? 6 : 7;
  const numBlocks = Math.ceil(n / targetBlockSize);
  const actualSize = Math.ceil(n / numBlocks);

  const blocks: SurveyQuestionDefinition[][] = [];
  for (let i = 0; i < n; i += actualSize) {
    blocks.push(questions.slice(i, Math.min(i + actualSize, n)));
  }
  return blocks;
}

function getGlobalQuestionNumber(
  blocks: SurveyQuestionDefinition[][],
  blockIdx: number,
  questionIdx: number,
): number {
  let offset = 0;
  for (let i = 0; i < blockIdx; i++) offset += blocks[i].length;
  return offset + questionIdx + 1;
}

// ─── Types ─────────────────────────────────────────────────────────────────

type AnswerValues = Record<string, string | string[]>;

export type PublicSurveyFormProps = {
  linkToken: string;
  defaultLanguage: string;
  initialLanguage: string;
  hasExplicitLangParam: boolean;
  supportedLanguages: string[];
  questions: SurveyQuestionDefinition[];
  allBundles: Record<string, SurveyLanguageTranslations>;
  allCopy: Record<string, PublicSurveyCopy>;
  responseContext: SurveyResponseContextConfig | undefined;
  turnstileSiteKey?: string;
  submitAction: (formData: FormData) => Promise<void>;
};

// ─── Validation ────────────────────────────────────────────────────────────

function validateBlock(
  block: SurveyQuestionDefinition[],
  values: AnswerValues,
): string | null {
  for (const q of block) {
    if (!q.required) continue;
    const v = values[q.question_key];
    const isEmpty =
      v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    if (isEmpty) return "Please answer all required questions before continuing.";
  }
  return null;
}

function rethrowNextNavigationError(error: unknown) {
  const digest =
    error && typeof error === "object" && "digest" in error
      ? String((error as { digest?: unknown }).digest ?? "")
      : "";

  if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
    throw error;
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────

function LanguagePickerScreen({
  languages,
  onSelect,
  copy,
}: {
  languages: string[];
  onSelect: (lang: string) => void;
  copy: PublicSurveyCopy;
}) {
  return (
    <div className="sf-lang-screen">
      <div className="sf-lang-intro">
        <h1 className="sf-lang-heading">{copy.languagePickerTitle}</h1>
        <p className="sf-lang-sub">{copy.languagePickerSub}</p>
      </div>
      <div className="sf-lang-grid">
        {languages.map((lang) => {
          const { flag, nativeName } = getLangMeta(lang);
          return (
            <button
              key={lang}
              type="button"
              className="sf-lang-card"
              onClick={() => onSelect(lang)}
            >
              <span className="sf-lang-flag">{flag}</span>
              <span className="sf-lang-name">{nativeName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="sf-progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
      <div className="sf-progress-fill" style={{ width: `${progress}%` }} />
    </div>
  );
}

function BlockDots({
  count,
  current,
}: {
  count: number;
  current: number;
}) {
  if (count <= 1) return null;
  return (
    <div className="sf-block-dots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`sf-block-dot${i === current ? " sf-block-dot--active" : i < current ? " sf-block-dot--done" : ""}`}
        />
      ))}
    </div>
  );
}

function ChoiceOptions({
  fieldName,
  options,
  selectedValue,
  onChange,
  isMultiple = false,
}: {
  fieldName: string;
  options: { key: string; label: string }[];
  selectedValue: string | string[];
  onChange: (value: string | string[]) => void;
  isMultiple?: boolean;
}) {
  return (
    <div className="sf-choices">
      {options.map(({ key, label }) => {
        const isSelected = isMultiple
          ? Array.isArray(selectedValue) && selectedValue.includes(key)
          : selectedValue === key;

        return (
          <label
            key={key}
            className={`sf-choice${isSelected ? " sf-choice--selected" : ""}${isMultiple ? " sf-choice--check" : ""}`}
          >
            <input
              type={isMultiple ? "checkbox" : "radio"}
              name={fieldName}
              value={key}
              checked={isSelected}
              onChange={() => {
                if (isMultiple) {
                  const current = Array.isArray(selectedValue) ? selectedValue : [];
                  onChange(
                    isSelected
                      ? current.filter((v) => v !== key)
                      : [...current, key],
                  );
                } else {
                  onChange(key);
                }
              }}
            />
            <span className="sf-choice__dot">
              <span className="sf-choice__dot-inner" />
            </span>
            <span className="sf-choice__label">{label}</span>
          </label>
        );
      })}
    </div>
  );
}

function RatingScale({
  fieldName,
  scale,
  selectedValue,
  onChange,
}: {
  fieldName: string;
  scale: NonNullable<SurveyQuestionDefinition["scale"]>;
  selectedValue: string;
  onChange: (value: string) => void;
}) {
  const values = Array.from(
    { length: scale.max - scale.min + 1 },
    (_, i) => scale.min + i,
  );
  const hasLabels = scale.min_label || scale.max_label;

  return (
    <div className="sf-scale">
      {hasLabels && (
        <div className="sf-scale__labels">
          <span>{scale.min_label ?? ""}</span>
          <span>{scale.max_label ?? ""}</span>
        </div>
      )}
      <div className="sf-scale__buttons">
        {values.map((v) => {
          const strV = String(v);
          return (
            <label
              key={v}
              className={`sf-scale__btn${selectedValue === strV ? " sf-scale__btn--selected" : ""}`}
            >
              <input
                type="radio"
                name={fieldName}
                value={strV}
                checked={selectedValue === strV}
                onChange={() => onChange(strV)}
              />
              {v}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  bundle,
  copy,
  globalNumber,
  totalQuestions,
  selectedValue,
  onChange,
  cardRef,
}: {
  question: SurveyQuestionDefinition;
  bundle: SurveyLanguageTranslations;
  copy: PublicSurveyCopy;
  globalNumber: number;
  totalQuestions: number;
  selectedValue: string | string[];
  onChange: (value: string | string[]) => void;
  cardRef: (el: HTMLElement | null) => void;
}) {
  const translation = bundle.questions[question.question_key] ?? {
    title: question.question_key,
  };
  const fieldName = `question:${question.question_key}`;
  const strValue = typeof selectedValue === "string" ? selectedValue : "";
  const isAnswered = Array.isArray(selectedValue)
    ? selectedValue.length > 0
    : Boolean(selectedValue);

  return (
    <article
      ref={cardRef}
      className={`sf-question${isAnswered ? " sf-question--answered" : ""}`}
    >
      <p className="sf-question__index">
        {globalNumber} / {totalQuestions}
      </p>
      <h2 className="sf-question__title">
        {translation.title}
        {question.required && (
          <span className="sf-question__required" aria-label="required">
            *
          </span>
        )}
      </h2>
      {translation.description && (
        <p className="sf-question__desc">{translation.description}</p>
      )}

      {question.type === "rating_scale" && question.scale && (
        <RatingScale
          fieldName={fieldName}
          scale={question.scale}
          selectedValue={strValue}
          onChange={onChange}
        />
      )}

      {question.type === "single_choice" && question.options && (
        <ChoiceOptions
          fieldName={fieldName}
          options={question.options.map((o) => ({
            key: o.option_key,
            label: translation.options?.[o.option_key] ?? o.option_key,
          }))}
          selectedValue={strValue}
          onChange={onChange}
        />
      )}

      {question.type === "multiple_choice" && question.options && (
        <ChoiceOptions
          fieldName={fieldName}
          options={question.options.map((o) => ({
            key: o.option_key,
            label: translation.options?.[o.option_key] ?? o.option_key,
          }))}
          selectedValue={Array.isArray(selectedValue) ? selectedValue : []}
          onChange={onChange}
          isMultiple
        />
      )}

      {question.type === "boolean" && (
        <ChoiceOptions
          fieldName={fieldName}
          options={[
            { key: "true", label: copy.yesLabel },
            { key: "false", label: copy.noLabel },
          ]}
          selectedValue={strValue}
          onChange={onChange}
        />
      )}

      {question.type === "numeric" && (
        <div className="sf-numeric">
          <input
            type="number"
            name={fieldName}
            value={strValue}
            onChange={(e) => onChange(e.target.value)}
            min={question.numeric?.min}
            max={question.numeric?.max}
            step="any"
          />
          {(question.numeric?.unit ||
            (question.numeric?.min != null && question.numeric?.max != null)) && (
            <p className="sf-numeric__meta">
              {question.numeric.unit && <span>{question.numeric.unit}</span>}
              {question.numeric.min != null && question.numeric.max != null && (
                <span>
                  {question.numeric.unit ? " · " : ""}
                  {question.numeric.min}–{question.numeric.max}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {question.type === "free_text" && (
        <textarea
          name={fieldName}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="sf-textarea"
        />
      )}
    </article>
  );
}

function ContextSection({
  responseContext,
  copy,
  countryCode,
  postalCode,
  onCountryChange,
  onPostalChange,
}: {
  responseContext: SurveyResponseContextConfig;
  copy: PublicSurveyCopy;
  countryCode: string;
  postalCode: string;
  onCountryChange: (v: string) => void;
  onPostalChange: (v: string) => void;
}) {
  return (
    <div className="sf-context-card">
      <div>
        <p className="sf-question__index">{copy.responseContextEyebrow}</p>
        <h2 className="sf-question__title">{copy.responseContextTitle}</h2>
        <p className="sf-question__desc">{copy.responseContextDescription}</p>
      </div>

      {responseContext.collect_country_code && (
        <div className="sf-select">
          <label>
            <span className="sf-field-label">{copy.countryCodeLabel}</span>
            <select
              name="countryCode"
              value={countryCode}
              onChange={(e) => onCountryChange(e.target.value)}
            >
              <option value="">{copy.countryCodePlaceholder}</option>
              {surveyCountryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} ({c.code})
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {responseContext.collect_postal_code && (
        <div className="sf-postal-input">
          <label>
            <span className="sf-field-label">{copy.postalCodeLabel}</span>
            <input
              name="postalCode"
              value={postalCode}
              onChange={(e) => onPostalChange(e.target.value)}
              placeholder={copy.postalCodePlaceholder}
              maxLength={24}
            />
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function PublicSurveyForm({
  linkToken,
  defaultLanguage,
  initialLanguage,
  hasExplicitLangParam,
  supportedLanguages,
  questions,
  allBundles,
  allCopy,
  responseContext,
  turnstileSiteKey,
  submitAction,
}: PublicSurveyFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const questionRefs = useRef<Record<string, HTMLElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | undefined>(undefined);

  const [language, setLanguage] = useState(initialLanguage);
  const [phase, setPhase] = useState<"language" | "survey">(
    supportedLanguages.length > 1 && !hasExplicitLangParam ? "language" : "survey",
  );
  const [currentBlock, setCurrentBlock] = useState(0);
  const [selectedValues, setSelectedValues] = useState<AnswerValues>({});
  const [countryCode, setCountryCode] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasTurnstileSiteKey = Boolean(turnstileSiteKey);
  const bundle = allBundles[language] ?? allBundles[defaultLanguage];
  const copy = allCopy[language] ?? allCopy[defaultLanguage];
  const blocks = computeBlocks(questions);
  const totalQ = questions.length;
  const isLastBlock = currentBlock === blocks.length - 1;
  const progress =
    blocks.length === 1 ? 100 : Math.round((currentBlock / (blocks.length - 1)) * 100);

  useEffect(() => {
    if (!hasTurnstileSiteKey || !turnstileSiteKey || !isLastBlock) {
      return;
    }

    if (!turnstileScriptReady || !window.turnstile?.render || !turnstileContainerRef.current) {
      return;
    }

    if (turnstileWidgetIdRef.current) {
      return;
    }

    turnstileWidgetIdRef.current = window.turnstile.render(
      turnstileContainerRef.current,
      {
        sitekey: turnstileSiteKey,
        theme: "light",
      },
    );

    return () => {
      const widgetId = turnstileWidgetIdRef.current;
      if (widgetId && window.turnstile?.remove) {
        window.turnstile.remove(widgetId);
      }
      turnstileWidgetIdRef.current = undefined;
    };
  }, [hasTurnstileSiteKey, isLastBlock, turnstileScriptReady, turnstileSiteKey]);

  function handleLanguageSelect(lang: string) {
    setLanguage(lang);
    setPhase("survey");
  }

  function handleAnswerChange(
    questionKey: string,
    value: string | string[],
    shouldAutoScroll: boolean,
  ) {
    const wasAnswered =
      selectedValues[questionKey] !== undefined && selectedValues[questionKey] !== "";

    setSelectedValues((prev) => ({ ...prev, [questionKey]: value }));
    setBlockError(null);

    if (!shouldAutoScroll || wasAnswered) return;

    // Scroll to next unanswered question in the current block
    const block = blocks[currentBlock];
    const qIdx = block.findIndex((q) => q.question_key === questionKey);
    if (qIdx === -1) return;

    for (let i = qIdx + 1; i < block.length; i++) {
      const nextQ = block[i];
      const nextVal = selectedValues[nextQ.question_key];
      const nextEmpty =
        nextVal === undefined ||
        nextVal === "" ||
        (Array.isArray(nextVal) && nextVal.length === 0);

      if (nextEmpty) {
        setTimeout(() => {
          questionRefs.current[nextQ.question_key]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 360);
        return;
      }
    }
  }

  function scrollToTop() {
    setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  function handleNext() {
    const error = validateBlock(blocks[currentBlock], selectedValues);
    if (error) {
      setBlockError(error);
      return;
    }
    setBlockError(null);
    setCurrentBlock((b) => b + 1);
    scrollToTop();
  }

  function handleBack() {
    setBlockError(null);
    setCurrentBlock((b) => Math.max(0, b - 1));
    scrollToTop();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    for (const block of blocks) {
      const error = validateBlock(block, selectedValues);
      if (error) {
        setBlockError(error);
        return;
      }
    }

    if (responseContext?.collect_country_code && !countryCode) {
      setBlockError(copy.countryCodeEmpty);
      return;
    }

    if (!hasAcceptedLegal) {
      setBlockError(copy.legalConsentRequired);
      return;
    }

    setBlockError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await submitAction(formData);
      } catch (error) {
        rethrowNextNavigationError(error);
        setBlockError(copy.submitError);
      }
    });
  }

  // ── Language picker phase ───────────────────────────────────────────────
  if (phase === "language") {
    return (
      <div className="sf-shell">
        <LanguagePickerScreen
          languages={supportedLanguages}
          onSelect={handleLanguageSelect}
          copy={copy}
        />
      </div>
    );
  }

  // ── Survey phase ────────────────────────────────────────────────────────
  return (
    <div className="sf-shell">
      <ProgressBar progress={progress} />

      <div className="sf-container" ref={containerRef}>
        <header className="sf-survey-header">
          <p className="sf-survey-eyebrow">{copy.openSurveyEyebrow}</p>
          <h1 className="sf-survey-title">
            {bundle?.survey_title ?? ""}
          </h1>
          {bundle?.survey_description && (
            <p className="sf-survey-desc">{bundle.survey_description}</p>
          )}
        </header>

        <BlockDots count={blocks.length} current={currentBlock} />

        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          {turnstileSiteKey ? (
            <Script
              src="https://challenges.cloudflare.com/turnstile/v0/api.js"
              strategy="afterInteractive"
              onLoad={() => {
                setTurnstileScriptReady(true);
              }}
            />
          ) : null}
          <input type="hidden" name="linkToken" value={linkToken} />
          <input type="hidden" name="submittedLanguage" value={language} />

          {blocks.map((block, blockIdx) => (
            <div
              key={blockIdx}
              className={`sf-block${blockIdx !== currentBlock ? " sf-block--hidden" : ""}`}
              aria-hidden={blockIdx !== currentBlock ? true : undefined}
            >
              {block.map((question, qIdx) => {
                const globalNum = getGlobalQuestionNumber(blocks, blockIdx, qIdx);
                const value = selectedValues[question.question_key] ?? "";
                const autoScroll =
                  question.type === "single_choice" ||
                  question.type === "rating_scale" ||
                  question.type === "boolean";

                return (
                  <QuestionCard
                    key={question.question_key}
                    question={question}
                    bundle={bundle}
                    copy={copy}
                    globalNumber={globalNum}
                    totalQuestions={totalQ}
                    selectedValue={value}
                    onChange={(v) => handleAnswerChange(question.question_key, v, autoScroll)}
                    cardRef={(el) => {
                      questionRefs.current[question.question_key] = el;
                    }}
                  />
                );
              })}
            </div>
          ))}

          {isLastBlock && responseContext && (
            <ContextSection
              responseContext={responseContext}
              copy={copy}
              countryCode={countryCode}
              postalCode={postalCode}
              onCountryChange={setCountryCode}
              onPostalChange={setPostalCode}
            />
          )}

          {isLastBlock ? (
            <label className="sf-legal-consent">
              <input
                type="checkbox"
                name="legalConsentAccepted"
                value="true"
                checked={hasAcceptedLegal}
                onChange={(event) => {
                  setHasAcceptedLegal(event.target.checked);
                  setBlockError(null);
                }}
              />
              <span>
                {copy.legalConsentLabel}{" "}
                <Link href={appRoutes.privacy} target="_blank">
                  {copy.legalConsentPrivacyLink}
                </Link>
                {" · "}
                <Link href={appRoutes.cookies} target="_blank">
                  {copy.legalConsentCookiesLink}
                </Link>
              </span>
            </label>
          ) : null}

          {blockError && (
            <div className="sf-error" role="alert">
              {blockError}
            </div>
          )}

          <div className="sf-nav">
            <span className="sf-nav__progress-text">
              {currentBlock + 1} / {blocks.length}
            </span>
            {isLastBlock && turnstileSiteKey ? (
              <div className="sf-turnstile">
                <div ref={turnstileContainerRef} />
              </div>
            ) : null}
            <div className="sf-nav-btns">
              {currentBlock > 0 && (
                <button
                  type="button"
                  className="sf-btn sf-btn--secondary"
                  onClick={handleBack}
                  disabled={isPending}
                >
                  {copy.backLabel}
                </button>
              )}
              {!isLastBlock ? (
                <button
                  type="button"
                  className="sf-btn sf-btn--primary"
                  onClick={handleNext}
                  disabled={isPending}
                >
                  {copy.nextLabel}
                </button>
              ) : (
                <button
                  type="submit"
                  className="sf-btn sf-btn--primary"
                  disabled={isPending}
                >
                  {isPending ? "…" : copy.submitLabel}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
