import OpenAI from "openai";
import { getOpenAIEnv } from "@/lib/llm/env";
import {
  writeSurveyGeneratorDebugJson,
  writeSurveyGeneratorDebugText,
} from "./generator-debug";
import {
  buildMeasurementPlannerOutputJsonSchema,
  MeasurementPlannerLLMOutput,
  parseMeasurementPlannerLLMOutput,
  SurveyGeneratorLLMOutput,
  parseSurveyGeneratorLLMOutput,
  surveyGeneratorOutputJsonSchema,
} from "./survey-generation-contracts";
import {
  buildMeasurementPlannerPrompt,
  buildSurveyGeneratorPrompt,
} from "./survey-generation-prompts";
import { GeneratorTargetConfig } from "./generator-config";
import {
  MeasurementPlanBaseBlueprint,
  MeasurementPlanBlueprint,
} from "./measurement-plan";

type GenerateSurveyWithLLMInput = {
  surveyName: string;
  surveyDescription: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  schemaTargets: string[];
  configs: GeneratorTargetConfig[];
  measurementPlanBlueprint: MeasurementPlanBlueprint;
  debugFilePrefix?: string;
};

type GenerateMeasurementPlanWithLLMInput = {
  surveyName: string;
  surveyDescription: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  behaviouralConceptKeys: string[];
  schemaTargets: string[];
  configs: GeneratorTargetConfig[];
  baseMeasurementPlanBlueprint: MeasurementPlanBaseBlueprint;
  repairFeedback?: string[];
  debugFilePrefix?: string;
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
  const debugPrefix = input.debugFilePrefix ?? "planner";

  await Promise.all([
    writeSurveyGeneratorDebugText(
      `${debugPrefix}/prompt-system.txt`,
      prompt.system,
    ),
    writeSurveyGeneratorDebugText(
      `${debugPrefix}/prompt-user.txt`,
      prompt.user,
    ),
    writeSurveyGeneratorDebugJson(
      `${debugPrefix}/response-schema.json`,
      responseSchema,
    ),
  ]);

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

  await writeSurveyGeneratorDebugText(
    `${debugPrefix}/output-raw.json`,
    message.content,
  );

  const parsed = parseMeasurementPlannerLLMOutput(message.content);

  await writeSurveyGeneratorDebugJson(
    `${debugPrefix}/output-parsed.json`,
    parsed,
  );

  return parsed;
}

export async function generateSurveyWithLLM(
  input: GenerateSurveyWithLLMInput,
): Promise<SurveyGeneratorLLMOutput> {
  const { env, client } = createClient();

  const prompt = buildSurveyGeneratorPrompt(input);
  const debugPrefix = input.debugFilePrefix ?? "writer";

  await Promise.all([
    writeSurveyGeneratorDebugText(
      `${debugPrefix}/prompt-system.txt`,
      prompt.system,
    ),
    writeSurveyGeneratorDebugText(
      `${debugPrefix}/prompt-user.txt`,
      prompt.user,
    ),
  ]);

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

  await writeSurveyGeneratorDebugText(
    `${debugPrefix}/output-raw.json`,
    message.content,
  );

  const parsed = parseSurveyGeneratorLLMOutput(message.content);

  await writeSurveyGeneratorDebugJson(
    `${debugPrefix}/output-parsed.json`,
    parsed,
  );

  return parsed;
}
