import {
  getGeneratorTargetConfigs,
  type GeneratorTargetConfig,
} from "./generator-config";
import { generateSurveyWithLLM } from "./generator-service";
import { transformGeneratedSurvey } from "./generator-transform";
import {
  validateGeneratedSurveyDraft,
  type SurveyValidationIssue,
} from "./generator-validation";
import { PersistedSurvey } from "./generator-types";

type GenerateSurveyDraftProposalInput = {
  survey: PersistedSurvey;
  surveyName: string;
  surveyDescription: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  ontologyTargets: string[];
};

export type GeneratedSurveyDraftProposal = {
  definition: PersistedSurvey["definition_json"];
  mappingContract: PersistedSurvey["mapping_contract_json"];
  configs: GeneratorTargetConfig[];
};

function assertSelectedTargets(ontologyTargets: string[]) {
  if (ontologyTargets.length === 0) {
    throw new Error("Select at least one ontology concept before generating.");
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

export async function generateSurveyDraftProposal(
  input: GenerateSurveyDraftProposalInput,
): Promise<GeneratedSurveyDraftProposal> {
  assertSelectedTargets(input.ontologyTargets);

  const configs = getGeneratorTargetConfigs(input.ontologyTargets);
  const output = await generateSurveyWithLLM({
    surveyName: input.surveyName,
    surveyDescription: input.surveyDescription,
    defaultLanguage: input.defaultLanguage,
    supportedLanguages: input.supportedLanguages,
    ontologyTargets: input.ontologyTargets,
    configs,
  });

  const transformed = transformGeneratedSurvey({
    output,
    baseDefinition: input.survey.definition_json,
    defaultLanguage: input.defaultLanguage,
    supportedLanguages: input.supportedLanguages,
    ontologyTargets: input.ontologyTargets,
    fallbackSurveyTitle: input.surveyName,
    fallbackSurveyDescription: input.surveyDescription,
  });

  assertNoValidationIssues(
    validateGeneratedSurveyDraft(
      transformed.definition,
      transformed.mappingContract,
    ),
  );

  return {
    definition: transformed.definition,
    mappingContract: transformed.mappingContract,
    configs,
  };
}
