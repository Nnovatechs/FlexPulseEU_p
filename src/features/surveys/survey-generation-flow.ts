import {
  getGeneratorTargetConfigs,
  type GeneratorTargetConfig,
} from "./generator-config";
import { deriveSchemaTargetsFromBehaviouralConceptKeys } from "@/features/ontology/flexpulse-behavioural-schema";
import {
  DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
  DFC_INVENTORY_CONCEPT_KEY,
  DFC_INVENTORY_QUESTION_KEY,
  DFC_INVENTORY_SLOT_KEY,
  createDeclaredFlexibilityCapabilityBlueprintArtifact,
  createDeclaredFlexibilityCapabilityDefinitionArtifacts,
  hasDeclaredFlexibilityCapability,
  mergeDeclaredFlexibilityCapabilityWriterBlueprint,
} from "./declared-flexibility-capability-module";
import { runCanonicalLanguageCopyEditor } from "./canonical-language-editor";
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
import { timeSurveyStep } from "./local-timing";
import { getCanonicalDerAssetOptionLabel } from "./asset-option-labels";

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
  warnings?: string[];
};

type SurveyGenerationContext = GenerateSurveyDraftProposalInput & {
  configs: GeneratorTargetConfig[];
  plannerBehaviouralConceptKeys: string[];
  plannerSchemaTargets: string[];
  baseMeasurementPlanBlueprint: MeasurementPlanBaseBlueprint;
  capabilityModuleSelected: boolean;
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
  const capabilityModuleSelected = hasDeclaredFlexibilityCapability(
    input.behaviouralConceptKeys,
  );
  const plannerBehaviouralConceptKeys = capabilityModuleSelected
    ? input.behaviouralConceptKeys.filter(
        (conceptKey) =>
          conceptKey !== DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY &&
          conceptKey !== DFC_INVENTORY_CONCEPT_KEY,
      )
    : input.behaviouralConceptKeys;
  const plannerSchemaTargets = deriveSchemaTargetsFromBehaviouralConceptKeys(
    plannerBehaviouralConceptKeys,
  );

  return {
    ...input,
    configs: getGeneratorTargetConfigs(plannerSchemaTargets),
    plannerBehaviouralConceptKeys,
    plannerSchemaTargets,
    baseMeasurementPlanBlueprint: createPlannerBaseBlueprint(
      plannerBehaviouralConceptKeys,
    ),
    capabilityModuleSelected,
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
    behaviouralConceptKeys: context.plannerBehaviouralConceptKeys,
    schemaTargets: context.plannerSchemaTargets,
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
  if (context.baseMeasurementPlanBlueprint.concepts.length === 0) {
    return {
      ...context.baseMeasurementPlanBlueprint,
      concepts: [],
    };
  }

  let repairFeedback: string[] | undefined;
  let lastIssues: SurveyValidationIssue[] = [];

  for (let attempt = 1; attempt <= MAX_MEASUREMENT_PLANNER_ATTEMPTS; attempt += 1) {
    const debugAttemptPrefix = `planner/attempt-${String(attempt).padStart(2, "0")}`;

    const attemptResult = await timeSurveyStep(
      `planner_attempt_${String(attempt).padStart(2, "0")}`,
      {
        attempt,
        repair_feedback_count: repairFeedback?.length ?? 0,
      },
      async () => {
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
          behaviouralConceptKeys: context.plannerBehaviouralConceptKeys,
          plannerOutput,
          baseMeasurementPlanBlueprint: context.baseMeasurementPlanBlueprint,
        });

        await writeSurveyGeneratorDebugJson(
          `${debugAttemptPrefix}/validation-issues.json`,
          issues,
        );

        return { issues, acceptedBlueprint };
      },
    );

    if (attemptResult.issues.length === 0 && attemptResult.acceptedBlueprint) {
      await writeSurveyGeneratorDebugJson(
        "planner/accepted-blueprint.json",
        attemptResult.acceptedBlueprint,
      );
      return attemptResult.acceptedBlueprint;
    }

    lastIssues = attemptResult.issues;
    repairFeedback = formatValidationIssuesForRepair(attemptResult.issues);
  }

  assertNoValidationIssues(lastIssues);
  throw new Error("Measurement planner failed without validation details.");
}

export async function runWriterPhase(input: {
  context: SurveyGenerationContext;
  acceptedBlueprint: MeasurementPlanBlueprint;
}): Promise<SurveyGeneratorLLMOutput> {
  const { context, acceptedBlueprint } = input;
  const writerBlueprint = getWriterBlueprint(context, acceptedBlueprint);

  return timeSurveyStep(
    "writer_phase",
    {
      concept_count: writerBlueprint.concepts.length,
      slot_count: writerBlueprint.concepts.reduce(
        (sum, concept) => sum + concept.question_slots.length,
        0,
      ),
    },
    async () =>
      generateSurveyWithLLM({
        surveyName: context.surveyName,
        surveyDescription: context.surveyDescription,
        defaultLanguage: context.defaultLanguage,
        supportedLanguages: context.supportedLanguages,
        schemaTargets: context.schemaTargets,
        configs: context.configs,
        measurementPlanBlueprint: writerBlueprint,
        debugFilePrefix: "writer",
      }),
  );
}

function getWriterBlueprint(
  context: SurveyGenerationContext,
  acceptedBlueprint: MeasurementPlanBlueprint,
) {
  return context.capabilityModuleSelected
    ? mergeDeclaredFlexibilityCapabilityWriterBlueprint(acceptedBlueprint)
    : acceptedBlueprint;
}

function buildCanonicalLanguageEditorWarning(input: {
  language: string;
  status: "completed" | "partial" | "fallback";
  fallbackSlots: number;
  totalSlots: number;
}) {
  if (input.status === "completed") {
    return null;
  }

  if (input.status === "fallback") {
    return `Canonical language editor fallback: the ${input.language} native-copy pass could not be applied, so the draft kept the raw writer copy. Review wording carefully before publishing.`;
  }

  return `Canonical language editor partial fallback: ${input.fallbackSlots} of ${input.totalSlots} ${input.totalSlots === 1 ? "slot kept" : "slots kept"} the raw writer copy in ${input.language}. Review wording carefully before publishing.`;
}

export function compileWriterOutput(input: {
  context: SurveyGenerationContext;
  acceptedBlueprint: MeasurementPlanBlueprint;
  writerOutput: SurveyGeneratorLLMOutput;
}) {
  const { context, acceptedBlueprint, writerOutput } = input;

  if (!context.capabilityModuleSelected) {
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

  return compileWriterOutputWithDeclaredFlexibilityCapability({
    context,
    acceptedBlueprint,
    writerOutput,
  });
}

function humanizeOptionValue(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function compileWriterOutputWithDeclaredFlexibilityCapability(input: {
  context: SurveyGenerationContext;
  acceptedBlueprint: MeasurementPlanBlueprint;
  writerOutput: SurveyGeneratorLLMOutput;
}) {
  const { context, acceptedBlueprint, writerOutput } = input;
  const capabilityBlueprint =
    createDeclaredFlexibilityCapabilityBlueprintArtifact();
  const capabilitySlotToQuestionKey = new Map([
    [DFC_INVENTORY_SLOT_KEY, DFC_INVENTORY_QUESTION_KEY],
    ...capabilityBlueprint.sets.flatMap((set) =>
      set.questions.map(
        (question) => [question.slot_key, question.question_key] as const,
      ),
    ),
  ]);
  const capabilitySlotKeys = new Set(capabilitySlotToQuestionKey.keys());
  const capabilityWriterQuestions = writerOutput.questions.filter((question) =>
    capabilitySlotKeys.has(question.slot_key),
  );
  const normalWriterQuestions = writerOutput.questions.filter(
    (question) => !capabilitySlotKeys.has(question.slot_key),
  );
  const capabilityQuestionsBySlot = new Map(
    capabilityWriterQuestions.map((question) => [question.slot_key, question]),
  );

  if (
    capabilityQuestionsBySlot.size !== capabilitySlotKeys.size ||
    capabilityWriterQuestions.length !== capabilitySlotKeys.size
  ) {
    throw new Error(
      "Writer must return exactly one canonical-language copy entry for every locked DFC slot.",
    );
  }

  const compiledSurvey = compileWriterOutputToArtifacts({
    writerOutput: {
      ...writerOutput,
      questions: normalWriterQuestions,
    },
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
  const capabilityArtifacts =
    createDeclaredFlexibilityCapabilityDefinitionArtifacts(
      compiledSurvey.definition.questions.length + 1,
    );
  const canonicalQuestions =
    compiledSurvey.definition.translations[context.defaultLanguage].questions;

  for (const question of capabilityArtifacts.questions) {
    const slotEntry = Array.from(capabilitySlotToQuestionKey.entries()).find(
      ([, questionKey]) => questionKey === question.question_key,
    );
    const writerQuestion = slotEntry
      ? capabilityQuestionsBySlot.get(slotEntry[0])
      : undefined;

    if (!writerQuestion?.title.trim()) {
      throw new Error(
        `Writer returned empty canonical copy for locked DFC question "${question.question_key}".`,
      );
    }

    if (
      question.type === "rating_scale" &&
      (!writerQuestion.scale?.min_label.trim() ||
        !writerQuestion.scale.max_label.trim())
    ) {
      throw new Error(
        `Writer returned empty canonical scale anchors for locked DFC question "${question.question_key}".`,
      );
    }

    canonicalQuestions[question.question_key] = {
      title: writerQuestion.title.trim(),
      ...(writerQuestion.description.trim()
        ? { description: writerQuestion.description.trim() }
        : {}),
      ...(question.question_key === DFC_INVENTORY_QUESTION_KEY
        ? {
            options: Object.fromEntries(
              (question.options ?? []).map((option) => {
                const writerLabel = writerQuestion.options.find(
                  (candidate) =>
                    candidate.ontology_value === option.option_key,
                )?.label;
                return [
                  option.option_key,
                  getCanonicalDerAssetOptionLabel(
                    option.option_key,
                    context.defaultLanguage,
                  ) ||
                    writerLabel?.trim() ||
                    humanizeOptionValue(option.option_key),
                ];
              }),
            ),
          }
        : {}),
      ...(question.type === "rating_scale" && writerQuestion.scale
        ? {
            scale: {
              min_label: writerQuestion.scale.min_label.trim(),
              max_label: writerQuestion.scale.max_label.trim(),
            },
          }
        : {}),
    };
  }

  compiledSurvey.definition.questions.push(...capabilityArtifacts.questions);
  compiledSurvey.mappingContract.mappings.push(
    ...capabilityArtifacts.mappingContract.mappings,
  );
  measurementPlan.concepts.push(
    ...capabilityArtifacts.measurementPlan.concepts.map((concept) => ({
      ...concept,
      question_intents: concept.question_intents ?? [],
    })),
  );
  compiledSurvey.definition.survey_meta.capability_module_version =
    capabilityArtifacts.module_version;
  compiledSurvey.slotBindings = {
    ...compiledSurvey.slotBindings,
    ...Object.fromEntries(capabilitySlotToQuestionKey),
  };

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

  return timeSurveyStep(
    "survey_generation_flow",
    {
      survey_id: input.survey.id,
      behavioural_concept_count: input.behaviouralConceptKeys.length,
      supported_language_count: input.supportedLanguages.length,
    },
    async () => {
      const context = buildGenerationContext(input);
      const generationWarnings: string[] = [];

      await writeSurveyGeneratorDebugJson(
        "planner/base-blueprint.json",
        context.baseMeasurementPlanBlueprint,
      );

      const acceptedBlueprint = await runPlannerOrchestrator(context);
      const writerBlueprint = getWriterBlueprint(context, acceptedBlueprint);
      const writerOutput = await runWriterPhase({ context, acceptedBlueprint });
      const finalWriterOutput =
        context.defaultLanguage === "English"
          ? writerOutput
          : await timeSurveyStep(
              "canonical_language_editor_phase",
              {
                question_count: writerOutput.questions.length,
                default_language: context.defaultLanguage,
              },
              async () => {
                const canonicalEditorResult = await runCanonicalLanguageCopyEditor({
                  defaultLanguage: context.defaultLanguage,
                  writerOutput,
                  writerBlueprint,
                });
                const warning = buildCanonicalLanguageEditorWarning({
                  language: context.defaultLanguage,
                  status: canonicalEditorResult.report.status,
                  fallbackSlots: canonicalEditorResult.report.fallback_slots,
                  totalSlots: canonicalEditorResult.report.total_slots,
                });
                if (warning) {
                  generationWarnings.push(warning);
                }
                return canonicalEditorResult.output;
              },
            );
      const compiledSurvey = await timeSurveyStep(
        "compile_writer_output",
        {
          capability_module_selected: context.capabilityModuleSelected,
        },
        async () =>
          compileWriterOutput({
            context,
            acceptedBlueprint,
            writerOutput: finalWriterOutput,
          }),
      );

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

      await timeSurveyStep(
        "validate_generated_artifacts",
        {
          question_count: compiledSurvey.definition.questions.length,
        },
        async () => validateGeneratedArtifacts({ compiledSurvey }),
      );

      return {
        definition: compiledSurvey.definition,
        mappingContract: compiledSurvey.mappingContract,
        measurementPlan: compiledSurvey.measurementPlan,
        configs: context.configs,
        warnings: generationWarnings.length > 0 ? generationWarnings : undefined,
      };
    },
  );
}

export async function generateSurveyDraftProposal(
  input: GenerateSurveyDraftProposalInput,
): Promise<GeneratedSurveyDraftProposal> {
  return runSurveyGenerationFlow(input);
}
