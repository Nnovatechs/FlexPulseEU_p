"use client";

import { useCallback } from "react";
import type {
  SurveyLanguageTranslations,
  SurveyQuestionDefinition,
  SurveyResponseContextConfig,
} from "@/features/surveys/generator-types";
import { surveyCountryOptions } from "@/features/surveys/country-options";
import type { PublicSurveyCopy } from "@/features/surveys/public-copy";

type PublicSurveyFormProps = {
  linkToken: string;
  selectedLanguage: string;
  questions: SurveyQuestionDefinition[];
  bundle: SurveyLanguageTranslations;
  responseContext: SurveyResponseContextConfig | undefined;
  copy: PublicSurveyCopy;
  submitAction: (formData: FormData) => void | Promise<void>;
};

function getQuestionTranslation(
  bundle: SurveyLanguageTranslations,
  questionKey: string,
) {
  return bundle.questions[questionKey] ?? { title: questionKey };
}

function renderQuestionInput(
  question: SurveyQuestionDefinition,
  bundle: SurveyLanguageTranslations,
  copy: PublicSurveyCopy,
) {
  const translation = getQuestionTranslation(bundle, question.question_key);
  const fieldName = `question:${question.question_key}`;

  if (question.type === "single_choice" && question.options) {
    return (
      <div className="public-question__options">
        {question.options.map((option) => (
          <label key={option.option_key} className="choice-chip">
            <input
              type="radio"
              name={fieldName}
              value={option.option_key}
              required={question.required}
            />
            <span>{translation.options?.[option.option_key] ?? option.option_key}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "multiple_choice" && question.options) {
    return (
      <div
        className="public-question__options"
        data-required-multiple-choice={question.required ? "true" : undefined}
        data-question-name={fieldName}
      >
        {question.options.map((option) => (
          <label key={option.option_key} className="choice-chip">
            <input type="checkbox" name={fieldName} value={option.option_key} />
            <span>{translation.options?.[option.option_key] ?? option.option_key}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "rating_scale" && question.scale) {
    const scale = question.scale;
    const values = Array.from(
      { length: scale.max - scale.min + 1 },
      (_, index) => scale.min + index,
    );

    return (
      <div className="public-question__scale">
        {values.map((value) => (
          <label key={value} className="choice-chip">
            <input
              type="radio"
              name={fieldName}
              value={String(value)}
              required={question.required}
            />
            <span>{value}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "numeric") {
    return (
      <input
        type="number"
        name={fieldName}
        required={question.required}
        min={question.numeric?.min}
        max={question.numeric?.max}
        step="any"
      />
    );
  }

  if (question.type === "boolean") {
    return (
      <div className="public-question__options">
        <label className="choice-chip">
          <input type="radio" name={fieldName} value="true" required={question.required} />
          <span>{copy.yesLabel}</span>
        </label>
        <label className="choice-chip">
          <input type="radio" name={fieldName} value="false" required={question.required} />
          <span>{copy.noLabel}</span>
        </label>
      </div>
    );
  }

  if (question.type === "free_text") {
    return <textarea name={fieldName} required={question.required} rows={4} />;
  }

  return null;
}

function validateRequiredMultipleChoiceGroups(form: HTMLFormElement) {
  const groups = form.querySelectorAll<HTMLElement>("[data-required-multiple-choice='true']");

  groups.forEach((group) => {
    const questionName = group.dataset.questionName;
    if (!questionName) {
      return;
    }

    const checkboxes = Array.from(
      group.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${questionName}"]`),
    );
    if (checkboxes.length === 0) {
      return;
    }

    const hasSelection = checkboxes.some((checkbox) => checkbox.checked);
    checkboxes[0].setCustomValidity(hasSelection ? "" : "Select at least one option.");
  });
}

export function PublicSurveyForm({
  linkToken,
  selectedLanguage,
  questions,
  bundle,
  responseContext,
  copy,
  submitAction,
}: PublicSurveyFormProps) {
  const scrollToFirstInvalid = useCallback((form: HTMLFormElement) => {
    const invalid = form.querySelector<HTMLElement>(":invalid");
    const target = invalid?.closest(".survey-step") ?? invalid;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    invalid?.focus();
  }, []);

  return (
    <form
      action={submitAction}
      className="survey-flow"
      onSubmit={(event) => {
        const form = event.currentTarget;
        validateRequiredMultipleChoiceGroups(form);

        if (!form.checkValidity()) {
          event.preventDefault();
          scrollToFirstInvalid(form);
          form.reportValidity();
        }
      }}
      onChange={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }

        if (target.type === "checkbox") {
          const form = event.currentTarget;
          validateRequiredMultipleChoiceGroups(form);
        } else {
          target.setCustomValidity("");
        }
      }}
    >
      <input type="hidden" name="linkToken" value={linkToken} />
      <input type="hidden" name="submittedLanguage" value={selectedLanguage} />

      {questions.map((question, index) => {
        const translation = getQuestionTranslation(bundle, question.question_key);

        return (
          <article key={question.question_key} className="surface-card survey-step">
            <p className="section-header__eyebrow">
              Step {index + 1} of {questions.length}
            </p>
            <h2>{translation.title}</h2>
            {translation.description ? <p>{translation.description}</p> : null}
            {renderQuestionInput(question, bundle, copy)}
          </article>
        );
      })}

      {(responseContext?.collect_country_code || responseContext?.collect_postal_code) && (
        <section className="surface-card survey-step">
          <p className="section-header__eyebrow">{copy.responseContextEyebrow}</p>
          <h2>{copy.responseContextTitle}</h2>
          <p>{copy.responseContextDescription}</p>

          {responseContext.collect_country_code ? (
            <label className="field">
              <span>{copy.countryCodeLabel}</span>
              <select name="countryCode" defaultValue="" required>
                <option value="" disabled>
                  {copy.countryCodePlaceholder}
                </option>
                {surveyCountryOptions.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label} ({country.code})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {responseContext.collect_postal_code ? (
            <label className="field">
              <span>{copy.postalCodeLabel}</span>
              <input
                name="postalCode"
                placeholder={copy.postalCodePlaceholder}
                maxLength={24}
                required
              />
            </label>
          ) : null}
        </section>
      )}

      <div className="survey-submit">
        <button type="submit" className="button button--primary">
          {copy.submitLabel}
        </button>
      </div>
    </form>
  );
}
