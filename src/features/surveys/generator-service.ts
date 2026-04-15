import OpenAI from "openai";
import { getOpenAIEnv } from "@/lib/llm/env";
import {
  buildMeasurementPlannerOutputJsonSchema,
  MeasurementPlannerLLMOutput,
  parseMeasurementPlannerLLMOutput,
  SurveyGeneratorLLMOutput,
  parseSurveyGeneratorLLMOutput,
  surveyGeneratorOutputJsonSchema,
} from "./generator-llm-types";
import {
  buildMeasurementPlannerPrompt,
  buildSurveyGeneratorPrompt,
} from "./generator-prompt";
import { GeneratorTargetConfig } from "./generator-config";
import { MeasurementPlanBlueprint } from "./measurement-plan";

type GenerateSurveyWithLLMInput = {
  surveyName: string;
  surveyDescription: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  schemaTargets: string[];
  configs: GeneratorTargetConfig[];
  measurementPlanBlueprint: MeasurementPlanBlueprint;
};

type GenerateMeasurementPlanWithLLMInput = {
  surveyName: string;
  surveyDescription: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  behaviouralConceptKeys: string[];
  schemaTargets: string[];
  configs: GeneratorTargetConfig[];
  baseMeasurementPlanBlueprint: MeasurementPlanBlueprint;
  repairFeedback?: string[];
};

function createClient() {
  const env = getOpenAIEnv();
  return {
    env,
    client: new OpenAI({
      apiKey: env.apiKey,
    }),
  };
}

export async function generateMeasurementPlanWithLLM(
  input: GenerateMeasurementPlanWithLLMInput,
): Promise<MeasurementPlannerLLMOutput> {
  const { env, client } = createClient();
  const prompt = buildMeasurementPlannerPrompt(input);
  const responseSchema = buildMeasurementPlannerOutputJsonSchema(
    input.baseMeasurementPlanBlueprint,
  );

  const completion = await client.chat.completions.create({
    model: env.model,
    temperature: 0.2,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: responseSchema,
    },
  });

  const message = completion.choices[0]?.message;

  if (message?.refusal) {
    throw new Error(`OpenAI refused measurement planning: ${message.refusal}`);
  }

  if (!message?.content) {
    throw new Error("OpenAI returned an empty measurement planning response.");
  }

  return parseMeasurementPlannerLLMOutput(message.content);
}

export async function generateSurveyWithLLM(
  input: GenerateSurveyWithLLMInput,
): Promise<SurveyGeneratorLLMOutput> {
  const { env, client } = createClient();

  const prompt = buildSurveyGeneratorPrompt(input);

  const completion = await client.chat.completions.create({
    model: env.model,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: prompt.system,
      },
      {
        role: "user",
        content: prompt.user,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: surveyGeneratorOutputJsonSchema,
    },
  });

  const message = completion.choices[0]?.message;

  if (message?.refusal) {
    throw new Error(`OpenAI refused survey generation: ${message.refusal}`);
  }

  if (!message?.content) {
    throw new Error("OpenAI returned an empty survey generation response.");
  }

  return parseSurveyGeneratorLLMOutput(message.content);
}
