import type { MappingContract, SurveyDefinition } from "./generator-types";
import {
  applyMeasurementPlannerOutput,
  createMeasurementPlanBlueprint,
  materializeMeasurementPlan,
  type MeasurementPlan,
  type MeasurementPlanBaseBlueprint,
  type MeasurementPlanBlueprint,
} from "./measurement-plan";
import type {
  MeasurementPlannerLLMOutput,
  SurveyGeneratorLLMOutput,
} from "./survey-generation-contracts";
import { transformGeneratedSurvey } from "./generator-transform";

export { createMeasurementPlanBlueprint as createPlannerBaseBlueprint };

type CompilePlannerOutputInput = {
  baseBlueprint: MeasurementPlanBaseBlueprint;
  plannerOutput: MeasurementPlannerLLMOutput;
};

type CompileWriterOutputInput = {
  writerOutput: SurveyGeneratorLLMOutput;
  baseDefinition: SurveyDefinition;
  defaultLanguage: string;
  supportedLanguages: string[];
  ontologyTargets: string[];
  acceptedBlueprint: MeasurementPlanBlueprint;
  fallbackSurveyTitle: string;
  fallbackSurveyDescription: string;
};

type CompileWriterOutputResult = {
  definition: SurveyDefinition;
  mappingContract: MappingContract;
  slotBindings: Record<string, string>;
};

type CompileMeasurementPlanInput = {
  acceptedBlueprint: MeasurementPlanBlueprint;
  slotBindings: Record<string, string>;
};

export function compilePlannerOutputToAcceptedBlueprint(
  input: CompilePlannerOutputInput,
): MeasurementPlanBlueprint {
  return applyMeasurementPlannerOutput(input.baseBlueprint, input.plannerOutput);
}

export function compileWriterOutputToArtifacts(
  input: CompileWriterOutputInput,
): CompileWriterOutputResult {
  return transformGeneratedSurvey({
    output: input.writerOutput,
    baseDefinition: input.baseDefinition,
    defaultLanguage: input.defaultLanguage,
    supportedLanguages: input.supportedLanguages,
    ontologyTargets: input.ontologyTargets,
    measurementPlanBlueprint: input.acceptedBlueprint,
    fallbackSurveyTitle: input.fallbackSurveyTitle,
    fallbackSurveyDescription: input.fallbackSurveyDescription,
  });
}

export function compileMeasurementPlanArtifact(
  input: CompileMeasurementPlanInput,
): MeasurementPlan {
  return materializeMeasurementPlan(input.acceptedBlueprint, input.slotBindings);
}
