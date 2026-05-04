import { deriveSchemaTargetsFromBehaviouralConceptKeys } from "@/features/ontology/flexpulse-behavioural-schema";
import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type PersistedSurvey,
} from "@/features/surveys/generator-types";

// A generator eval fixture is a synthetic product scenario, not a synthetic
// respondent dataset. Each fixture tells the eval runner which ontology
// concepts to select, what the generated survey is supposed to measure, and
// which minimum structural expectations must hold for the generated instrument.
export type GeneratorEvalFixture = {
  id: string;
  purpose: string;
  surveyName: string;
  surveyDescription: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  behaviouralConceptKeys: string[];
  minQuestionsByConcept: Record<string, number>;
  zeroQuestionConcepts?: string[];
  minTotalQuestions: number;
  maxTotalQuestions: number;
  minimumScore: number;
  minimumMethodologyScore: number;
};

// The real generator expects an existing draft survey. These fixtures create
// the smallest valid draft needed to exercise the same planner + writer flow
// that product code uses, without involving Supabase or UI actions.
export function buildGeneratorEvalSurveyFixture(
  fixture: GeneratorEvalFixture,
): PersistedSurvey {
  const definition = createInitialSurveyDefinition(
    fixture.defaultLanguage,
    fixture.supportedLanguages,
  );

  definition.survey_meta.behavioural_concept_keys = fixture.behaviouralConceptKeys;
  definition.survey_meta.ontology_targets =
    deriveSchemaTargetsFromBehaviouralConceptKeys(fixture.behaviouralConceptKeys);
  definition.translations[fixture.defaultLanguage] = {
    survey_title: fixture.surveyName,
    survey_description: fixture.surveyDescription,
    questions: {},
  };

  return {
    id: `eval_${fixture.id}`,
    name: fixture.surveyName,
    status: "draft",
    created_by: "eval_runner",
    created_at: "2026-04-06T10:00:00.000Z",
    updated_at: "2026-04-06T10:00:00.000Z",
    published_at: null,
    default_language: fixture.defaultLanguage,
    supported_languages: fixture.supportedLanguages,
    definition_json: definition,
    mapping_contract_json: createInitialMappingContract(),
    mapping_compiled_json: null,
    mapping_hash: null,
  };
}

// This is the exact input shape consumed by generateSurveyDraftProposal.
// Keeping this adapter here makes eval cases easy to read: fixture in,
// real generator input out.
export function buildGeneratorEvalInput(fixture: GeneratorEvalFixture) {
  return {
    survey: buildGeneratorEvalSurveyFixture(fixture),
    surveyName: fixture.surveyName,
    surveyDescription: fixture.surveyDescription,
    defaultLanguage: fixture.defaultLanguage,
    supportedLanguages: fixture.supportedLanguages,
    behaviouralConceptKeys: fixture.behaviouralConceptKeys,
    schemaTargets: deriveSchemaTargetsFromBehaviouralConceptKeys(
      fixture.behaviouralConceptKeys,
    ),
  };
}

// These scenarios intentionally cover different failure modes:
// - core psychological axes with depth requirements
// - mixed profile + applicability concepts
// - runtime context concepts that should not become respondent questions
// - multilingual/cross-cultural wording pressure
// - closely related constructs that are easy to blur
// - economic/tariff concepts that often become too shallow or too technical
export const generatorEvalFixtures: GeneratorEvalFixture[] = [
  {
    id: "core-behavioural-axes",
    purpose:
      "Core profiling axes should receive enough measurement depth and map cleanly into profile outputs.",
    surveyName: "Household flexibility attitudes",
    surveyDescription:
      "Generate a compact survey that measures household willingness to offer flexibility and trust automated energy control.",
    defaultLanguage: "English",
    supportedLanguages: ["English", "Spanish"],
    behaviouralConceptKeys: [
      "trust_in_automation",
      "flexibility_willingness",
    ],
    minQuestionsByConcept: {
      trust_in_automation: 2,
      flexibility_willingness: 2,
    },
    minTotalQuestions: 4,
    maxTotalQuestions: 10,
    minimumScore: 85,
    minimumMethodologyScore: 4,
  },
  {
    id: "profile-plus-assets",
    purpose:
      "The generator should combine psychological profile axes with asset inventory concepts without mixing their measurement semantics.",
    surveyName: "Residential flexibility readiness",
    surveyDescription:
      "Assess trust, willingness, and household flexibility assets for later segmentation.",
    defaultLanguage: "English",
    supportedLanguages: ["English"],
    behaviouralConceptKeys: [
      "trust_in_automation",
      "flexibility_willingness",
      "owned_der_assets",
    ],
    minQuestionsByConcept: {
      trust_in_automation: 2,
      flexibility_willingness: 2,
      owned_der_assets: 1,
    },
    minTotalQuestions: 5,
    maxTotalQuestions: 12,
    minimumScore: 85,
    minimumMethodologyScore: 4,
  },
  {
    id: "context-stays-outside-respondent-items",
    purpose:
      "Runtime context and enrichment concepts should stay out of respondent-facing question design.",
    surveyName: "Context integrity check",
    surveyDescription:
      "Generate a survey with one behavioural concept while preserving runtime context as metadata.",
    defaultLanguage: "English",
    supportedLanguages: ["English"],
    behaviouralConceptKeys: [
      "trust_in_automation",
      "country_code",
      "climate_context",
    ],
    minQuestionsByConcept: {
      trust_in_automation: 2,
    },
    zeroQuestionConcepts: ["country_code", "climate_context"],
    minTotalQuestions: 2,
    maxTotalQuestions: 7,
    minimumScore: 90,
    minimumMethodologyScore: 4,
  },
  {
    id: "cross-cultural-tariff-and-automation",
    purpose:
      "Questions should remain clear and translatable when measuring automation and tariff preferences across several languages.",
    surveyName: "Energy flexibility preferences across regions",
    surveyDescription:
      "Create a multilingual survey about automation trust and tariff preference orientation for European households.",
    defaultLanguage: "English",
    supportedLanguages: ["English", "Spanish", "French"],
    behaviouralConceptKeys: [
      "trust_in_automation",
      "tariff_preference_orientation",
    ],
    minQuestionsByConcept: {
      trust_in_automation: 2,
      tariff_preference_orientation: 2,
    },
    minTotalQuestions: 4,
    maxTotalQuestions: 10,
    minimumScore: 85,
    minimumMethodologyScore: 4,
  },
  {
    id: "comfort-and-override-behaviour",
    purpose:
      "The generator should distinguish comfort constraints from automation override preferences without writing double-barrelled items.",
    surveyName: "Comfort and control preferences",
    surveyDescription:
      "Measure how households balance thermal comfort, automation and manual control during flexibility events.",
    defaultLanguage: "English",
    supportedLanguages: ["English"],
    behaviouralConceptKeys: [
      "thermal_comfort_norms",
      "manual_override_need",
      "event_frequency_tolerance",
    ],
    minQuestionsByConcept: {
      thermal_comfort_norms: 2,
      manual_override_need: 2,
      event_frequency_tolerance: 2,
    },
    minTotalQuestions: 6,
    maxTotalQuestions: 12,
    minimumScore: 85,
    minimumMethodologyScore: 4,
  },
  {
    id: "economic-modulators",
    purpose:
      "Economic motivation and bill stability should be measured as related but distinct behavioural modulators.",
    surveyName: "Household flexibility incentives",
    surveyDescription:
      "Generate a short survey about savings motivation, bill stability needs and preferred tariff models.",
    defaultLanguage: "English",
    supportedLanguages: ["English", "Spanish"],
    behaviouralConceptKeys: [
      "savings_motivation",
      "bill_stability_need",
      "preferred_tariff_model",
    ],
    minQuestionsByConcept: {
      savings_motivation: 2,
      bill_stability_need: 2,
      preferred_tariff_model: 1,
    },
    minTotalQuestions: 5,
    maxTotalQuestions: 11,
    minimumScore: 85,
    minimumMethodologyScore: 4,
  },
  {
    id: "awareness-explainability-readiness",
    purpose:
      "Awareness and explainability should be evaluated as different constructs, not collapsed into generic knowledge questions.",
    surveyName: "Understanding and explainability needs",
    surveyDescription:
      "Assess how much households understand flexibility and what explanations they need before accepting automated control.",
    defaultLanguage: "English",
    supportedLanguages: ["English", "French"],
    behaviouralConceptKeys: [
      "awareness_of_energy_systems",
      "explainability_need",
      "trust_in_automation",
    ],
    minQuestionsByConcept: {
      awareness_of_energy_systems: 2,
      explainability_need: 2,
      trust_in_automation: 2,
    },
    minTotalQuestions: 6,
    maxTotalQuestions: 12,
    minimumScore: 85,
    minimumMethodologyScore: 4,
  },
];
