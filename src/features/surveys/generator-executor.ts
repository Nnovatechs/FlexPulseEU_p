import {
  getGeneratorTargetConfigs,
  type GeneratorTargetConfig,
} from "./generator-config";
import {
  generateMeasurementPlanWithLLM,
  generateSurveyWithLLM,
} from "./generator-service";
import {
  applyMeasurementPlannerOutput,
  createMeasurementPlanBlueprint,
  materializeMeasurementPlan,
} from "./measurement-plan";
import { transformGeneratedSurvey } from "./generator-transform";
import {
  validateMeasurementPlannerConceptCoverage,
  validateMeasurementPlanBlueprint,
  validateGeneratedSurveyDraft,
  type SurveyValidationIssue,
} from "./generator-validation";
import { PersistedSurvey } from "./generator-types";
import type { MeasurementPlanBlueprint } from "./measurement-plan";

type GenerateSurveyDraftProposalInput = {
  survey: PersistedSurvey;
  surveyName: string;
  surveyDescription: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  behaviouralConceptKeys: string[];
  schemaTargets: string[];
};

export type GeneratedSurveyDraftProposal = {
  definition: PersistedSurvey["definition_json"];
  mappingContract: PersistedSurvey["mapping_contract_json"];
  measurementPlan: NonNullable<
    PersistedSurvey["definition_json"]["survey_meta"]["measurement_plan_json"]
  >;
  configs: GeneratorTargetConfig[];
};

const MAX_MEASUREMENT_PLANNER_ATTEMPTS = 3;

function assertSelectedTargets(schemaTargets: string[]) {
  if (schemaTargets.length === 0) {
    throw new Error("Select at least one behavioural concept before generating.");
  }
}

function assertNoValidationIssues(issues: SurveyValidationIssue[]) {
  if (issues.length === 0) {
    return;
  }

  const summary = issues
    .slice(0, 3)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join(" | ");

  throw new Error(`Generated survey failed validation. ${summary}`);
}

function formatValidationIssuesForRepair(issues: SurveyValidationIssue[]) {
  return issues.map((issue) => `${issue.path}: ${issue.message}`);
}

function buildPlannerValidationIssues(
  behaviouralConceptKeys: string[],
  plannedMeasurement: Awaited<ReturnType<typeof generateMeasurementPlanWithLLM>>,
  baseMeasurementPlanBlueprint: MeasurementPlanBlueprint,
): {
  issues: SurveyValidationIssue[];
  measurementPlanBlueprint?: MeasurementPlanBlueprint;
} {
  const issues = validateMeasurementPlannerConceptCoverage(
    behaviouralConceptKeys,
    plannedMeasurement.concepts.map((concept) => concept.concept_key),
  );

  if (issues.length > 0) {
    return { issues };
  }

  try {
    const measurementPlanBlueprint = applyMeasurementPlannerOutput(
      baseMeasurementPlanBlueprint,
      plannedMeasurement,
    );
    const blueprintIssues = validateMeasurementPlanBlueprint(measurementPlanBlueprint);

    return {
      issues: blueprintIssues,
      measurementPlanBlueprint:
        blueprintIssues.length === 0 ? measurementPlanBlueprint : undefined,
    };
  } catch (error) {
    return {
      issues: [
        {
          code: "invalid_measurement_planner_output",
          path: "measurement_planner_output",
          message:
            error instanceof Error
              ? error.message
              : "Measurement planner returned an invalid structure.",
        },
      ],
    };
  }
}

async function generateValidatedMeasurementPlan(
  input: Omit<GenerateSurveyDraftProposalInput, "survey"> & {
    configs: GeneratorTargetConfig[];
    baseMeasurementPlanBlueprint: MeasurementPlanBlueprint;
  },
) {
  let repairFeedback: string[] | undefined;
  let lastIssues: SurveyValidationIssue[] = [];

  for (let attempt = 1; attempt <= MAX_MEASUREMENT_PLANNER_ATTEMPTS; attempt += 1) {
    const plannedMeasurement = await generateMeasurementPlanWithLLM({
      surveyName: input.surveyName,
      surveyDescription: input.surveyDescription,
      defaultLanguage: input.defaultLanguage,
      supportedLanguages: input.supportedLanguages,
      behaviouralConceptKeys: input.behaviouralConceptKeys,
      schemaTargets: input.schemaTargets,
      configs: input.configs,
      baseMeasurementPlanBlueprint: input.baseMeasurementPlanBlueprint,
      repairFeedback,
    });

    const { issues, measurementPlanBlueprint } = buildPlannerValidationIssues(
      input.behaviouralConceptKeys,
      plannedMeasurement,
      input.baseMeasurementPlanBlueprint,
    );

    if (issues.length === 0 && measurementPlanBlueprint) {
      return { plannedMeasurement, measurementPlanBlueprint };
    }

    lastIssues = issues;
    repairFeedback = formatValidationIssuesForRepair(issues);
  }

  assertNoValidationIssues(lastIssues);
  throw new Error("Measurement planner failed without validation details.");
}

export async function generateSurveyDraftProposal(
  input: GenerateSurveyDraftProposalInput,
): Promise<GeneratedSurveyDraftProposal> {
  assertSelectedTargets(input.schemaTargets);

  const configs = getGeneratorTargetConfigs(input.schemaTargets);
  const baseMeasurementPlanBlueprint = createMeasurementPlanBlueprint(
    input.behaviouralConceptKeys,
  );
  const { measurementPlanBlueprint } = await generateValidatedMeasurementPlan({
    surveyName: input.surveyName,
    surveyDescription: input.surveyDescription,
    defaultLanguage: input.defaultLanguage,
    supportedLanguages: input.supportedLanguages,
    behaviouralConceptKeys: input.behaviouralConceptKeys,
    schemaTargets: input.schemaTargets,
    configs,
    baseMeasurementPlanBlueprint,
  });
  const output = await generateSurveyWithLLM({
    surveyName: input.surveyName,
    surveyDescription: input.surveyDescription,
    defaultLanguage: input.defaultLanguage,
    supportedLanguages: input.supportedLanguages,
    schemaTargets: input.schemaTargets,
    configs,
    measurementPlanBlueprint,
  });

  const transformed = transformGeneratedSurvey({
    output,
    baseDefinition: input.survey.definition_json,
    defaultLanguage: input.defaultLanguage,
    supportedLanguages: input.supportedLanguages,
    ontologyTargets: input.schemaTargets,
    measurementPlanBlueprint,
    fallbackSurveyTitle: input.surveyName,
    fallbackSurveyDescription: input.surveyDescription,
  });
  const measurementPlan = materializeMeasurementPlan(
    measurementPlanBlueprint,
    transformed.slotBindings,
  );
  transformed.definition.survey_meta.measurement_plan_json = measurementPlan;

  assertNoValidationIssues(
    validateGeneratedSurveyDraft(
      transformed.definition,
      transformed.mappingContract,
      measurementPlan,
    ),
  );

  return {
    definition: transformed.definition,
    mappingContract: transformed.mappingContract,
    measurementPlan,
    configs,
  };
}
