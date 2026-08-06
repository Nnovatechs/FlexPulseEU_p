import { describe, expect, it } from "vitest";
import { reconcileTranslationRetryBundle } from "@/features/surveys/translation-loop";
import { buildTranslationSurveyFixture } from "../../../fixtures/surveys/translation/factory";
import type { SurveyLanguageTranslations } from "@/features/surveys/generator-types";

describe("reconcileTranslationRetryBundle", () => {
  it("only applies retry changes to flagged question keys", () => {
    const fixture = buildTranslationSurveyFixture();
    const firstQuestionKey = fixture.question.question_key;
    const secondQuestionKey = "Q_TEST_02";

    const previousBundle: SurveyLanguageTranslations = {
      ...fixture.targetTranslations,
      questions: {
        ...fixture.targetTranslations.questions,
        [secondQuestionKey]: {
          title: "Question deja validee",
          description: "Ne pas modifier.",
          options: {
            opt_1: "Option A",
            opt_2: "Option B",
            opt_3: "Option C",
          },
        },
      },
    };

    const polishedBundle = {
      ...previousBundle,
      survey_title: "Titre modifie",
      survey_description: "Description modifiee",
      questions: {
        ...previousBundle.questions,
        [firstQuestionKey]: {
          ...previousBundle.questions[firstQuestionKey],
          title: "Version amelioree",
        },
        [secondQuestionKey]: {
          title: "Question modifiee par erreur",
          description: "Cela ne doit pas passer.",
          options: {
            opt_1: "X",
            opt_2: "Y",
            opt_3: "Z",
          },
        },
      },
    };

    const reconciled = reconcileTranslationRetryBundle({
      previousBundle,
      polishedBundle,
      validationIssues: [
        {
          language: fixture.targetLanguage,
          question_key: firstQuestionKey,
          type: "quality",
          severity: "advisory",
          message: "Suena poco natural.",
        },
      ],
      questions: [fixture.question, { ...fixture.question, question_key: secondQuestionKey }],
    });

    expect(reconciled.survey_title).toBe(previousBundle.survey_title);
    expect(reconciled.survey_description).toBe(previousBundle.survey_description);
    expect(reconciled.questions[firstQuestionKey].title).toBe("Version amelioree");
    expect(reconciled.questions[secondQuestionKey]).toEqual(
      previousBundle.questions[secondQuestionKey],
    );
  });

  it("allows survey header changes only for survey-level issues", () => {
    const fixture = buildTranslationSurveyFixture();
    const polishedBundle = {
      ...fixture.targetTranslations,
      survey_title: "Titre ameliore",
      survey_description: "Description amelioree",
    };

    const reconciled = reconcileTranslationRetryBundle({
      previousBundle: fixture.targetTranslations,
      polishedBundle,
      validationIssues: [
        {
          language: fixture.targetLanguage,
          type: "quality",
          severity: "advisory",
          message: "El encabezado suena poco natural.",
        },
      ],
      questions: fixture.questions,
    });

    expect(reconciled.survey_title).toBe("Titre ameliore");
    expect(reconciled.survey_description).toBe("Description amelioree");
  });
});
