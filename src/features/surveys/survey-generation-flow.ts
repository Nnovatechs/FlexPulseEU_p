import {
  getGeneratorTargetConfigs,
  type GeneratorTargetConfig,
} from "./generator-config";
import {
  resetSurveyGeneratorDebugLatest,
  writeSurveyGeneratorDebugJson,
} from "./generator-debug";
import {
  generateMeasurementPlanWithLLM,
  generateSurveyWithLLM,
} from "./generator-service";
import { PersistedSurvey } from "./generator-types";
import {
  validateGeneratedSurveyDraft,
  validateMeasurementPlanBlueprint,
  validateMeasurementPlannerConceptCoverage,
  type SurveyValidationIssue,
} from "./generator-validation";
import {
  compileMeasurementPlanArtifact,
  compilePlannerOutputToAcceptedBlueprint,
  compileWriterOutputToArtifacts,
  createPlannerBaseBlueprint,
} from "./survey-generation-compiler";
import type {
  MeasurementPlannerLLMOutput,
  SurveyGeneratorLLMOutput,
} from "./survey-generation-contracts";
import type {
  MeasurementPlanBaseBlueprint,
  MeasurementPlanBlueprint,
} from "./measurement-plan";

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

type SurveyGenerationContext = GenerateSurveyDraftProposalInput & {
  configs: GeneratorTargetConfig[];
  baseMeasurementPlanBlueprint: MeasurementPlanBaseBlueprint;
};

type PlannerCompileResult = {
  issues: SurveyValidationIssue[];
  acceptedBlueprint?: MeasurementPlanBlueprint;
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

export function buildGenerationContext(
  input: GenerateSurveyDraftProposalInput,
): SurveyGenerationContext {
  return {
    ...input,
    configs: getGeneratorTargetConfigs(input.schemaTargets),
    baseMeasurementPlanBlueprint: createPlannerBaseBlueprint(
      input.behaviouralConceptKeys,
    ),
  };
}

export async function runPlannerPhase(input: {
  context: SurveyGenerationContext;
  repairFeedback?: string[];
  debugFilePrefix: string;
}): Promise<MeasurementPlannerLLMOutput> {
  const { context, repairFeedback, debugFilePrefix } = input;

  return generateMeasurementPlanWithLLM({
    surveyName: context.surveyName,
    surveyDescription: context.surveyDescription,
    defaultLanguage: context.defaultLanguage,
    supportedLanguages: context.supportedLanguages,
    behaviouralConceptKeys: context.behaviouralConceptKeys,
    schemaTargets: context.schemaTargets,
    configs: context.configs,
    baseMeasurementPlanBlueprint: context.baseMeasurementPlanBlueprint,
    repairFeedback,
    debugFilePrefix,
  });
}

export function compilePlannerOutput(input: {
  behaviouralConceptKeys: string[];
  plannerOutput: MeasurementPlannerLLMOutput;
  baseMeasurementPlanBlueprint: MeasurementPlanBaseBlueprint;
}): PlannerCompileResult {
  const issues = validateMeasurementPlannerConceptCoverage(
    input.behaviouralConceptKeys,
    input.plannerOutput.concepts.map((concept) => concept.concept_key),
  );

  if (issues.length > 0) {
    return { issues };
  }

  try {
    const acceptedBlueprint = compilePlannerOutputToAcceptedBlueprint({
      baseBlueprint: input.baseMeasurementPlanBlueprint,
      plannerOutput: input.plannerOutput,
    });
    const blueprintIssues = validateMeasurementPlanBlueprint(acceptedBlueprint);

    return {
      issues: blueprintIssues,
      acceptedBlueprint: blueprintIssues.length === 0 ? acceptedBlueprint : undefined,
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

export async function runPlannerOrchestrator(
  context: SurveyGenerationContext,
): Promise<MeasurementPlanBlueprint> {
  let repairFeedback: string[] | undefined;
  let lastIssues: SurveyValidationIssue[] = [];

  for (let attempt = 1; attempt <= MAX_MEASUREMENT_PLANNER_ATTEMPTS; attempt += 1) {
    const debugAttemptPrefix = `planner/attempt-${String(attempt).padStart(2, "0")}`;

    await writeSurveyGeneratorDebugJson(
      `${debugAttemptPrefix}/repair-feedback.json`,
      repairFeedback ?? [],
    );

    const plannerOutput = await runPlannerPhase({
      context,
      repairFeedback,
      debugFilePrefix: debugAttemptPrefix,
    });

    const { issues, acceptedBlueprint } = compilePlannerOutput({
      behaviouralConceptKeys: context.behaviouralConceptKeys,
      plannerOutput,
      baseMeasurementPlanBlueprint: context.baseMeasurementPlanBlueprint,
    });

    await writeSurveyGeneratorDebugJson(
      `${debugAttemptPrefix}/validation-issues.json`,
      issues,
    );

    if (issues.length === 0 && acceptedBlueprint) {
      await writeSurveyGeneratorDebugJson(
        "planner/accepted-blueprint.json",
        acceptedBlueprint,
      );
      return acceptedBlueprint;
    }

    lastIssues = issues;
    repairFeedback = formatValidationIssuesForRepair(issues);
  }

  assertNoValidationIssues(lastIssues);
  throw new Error("Measurement planner failed without validation details.");
}

export async function runWriterPhase(input: {
  context: SurveyGenerationContext;
  acceptedBlueprint: MeasurementPlanBlueprint;
}): Promise<SurveyGeneratorLLMOutput> {
  const { context, acceptedBlueprint } = input;

  return generateSurveyWithLLM({
    surveyName: context.surveyName,
    surveyDescription: context.surveyDescription,
    defaultLanguage: context.defaultLanguage,
    supportedLanguages: context.supportedLanguages,
    schemaTargets: context.schemaTargets,
    configs: context.configs,
    measurementPlanBlueprint: acceptedBlueprint,
    debugFilePrefix: "writer",
  });
}

export function compileWriterOutput(input: {
  context: SurveyGenerationContext;
  acceptedBlueprint: MeasurementPlanBlueprint;
  writerOutput: SurveyGeneratorLLMOutput;
}) {
  const { context, acceptedBlueprint, writerOutput } = input;

  const compiledSurvey = compileWriterOutputToArtifacts({
    writerOutput,
    baseDefinition: context.survey.definition_json,
    defaultLanguage: context.defaultLanguage,
    supportedLanguages: context.supportedLanguages,
    ontologyTargets: context.schemaTargets,
    acceptedBlueprint,
    fallbackSurveyTitle: context.surveyName,
    fallbackSurveyDescription: context.surveyDescription,
  });
  const measurementPlan = compileMeasurementPlanArtifact({
    acceptedBlueprint,
    slotBindings: compiledSurvey.slotBindings,
  });

  compiledSurvey.definition.survey_meta.measurement_plan_json = measurementPlan;

  return {
    ...compiledSurvey,
    measurementPlan,
  };
}

export function validateGeneratedArtifacts(input: {
  compiledSurvey: ReturnType<typeof compileWriterOutput>;
}) {
  assertNoValidationIssues(
    validateGeneratedSurveyDraft(
      input.compiledSurvey.definition,
      input.compiledSurvey.mappingContract,
      input.compiledSurvey.measurementPlan,
    ),
  );
}

export async function runSurveyGenerationFlow(
  input: GenerateSurveyDraftProposalInput,
): Promise<GeneratedSurveyDraftProposal> {
  assertSelectedTargets(input.schemaTargets);
  await resetSurveyGeneratorDebugLatest();
  await writeSurveyGeneratorDebugJson("session.json", {
    surveyId: input.survey.id,
    surveyName: input.surveyName,
    surveyDescription: input.surveyDescription,
    defaultLanguage: input.defaultLanguage,
    supportedLanguages: input.supportedLanguages,
    behaviouralConceptKeys: input.behaviouralConceptKeys,
    schemaTargets: input.schemaTargets,
  });

  const context = buildGenerationContext(input);

  await writeSurveyGeneratorDebugJson(
    "planner/base-blueprint.json",
    context.baseMeasurementPlanBlueprint,
  );

  const acceptedBlueprint = await runPlannerOrchestrator(context);
  const writerOutput = await runWriterPhase({ context, acceptedBlueprint });
  const compiledSurvey = compileWriterOutput({
    context,
    acceptedBlueprint,
    writerOutput,
  });

  await Promise.all([
    writeSurveyGeneratorDebugJson(
      "writer/final-slot-bindings.json",
      compiledSurvey.slotBindings,
    ),
    writeSurveyGeneratorDebugJson(
      "writer/final-measurement-plan.json",
      compiledSurvey.measurementPlan,
    ),
  ]);

  validateGeneratedArtifacts({ compiledSurvey });

  return {
    definition: compiledSurvey.definition,
    mappingContract: compiledSurvey.mappingContract,
    measurementPlan: compiledSurvey.measurementPlan,
    configs: context.configs,
  };
}

export async function generateSurveyDraftProposal(
  input: GenerateSurveyDraftProposalInput,
): Promise<GeneratedSurveyDraftProposal> {
  return runSurveyGenerationFlow(input);
}
