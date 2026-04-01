import OpenAI from "openai";
import { getOpenAIEnv } from "@/lib/llm/env";
import {
  SurveyGeneratorLLMOutput,
  parseSurveyGeneratorLLMOutput,
  surveyGeneratorOutputJsonSchema,
} from "./generator-llm-types";
import { buildSurveyGeneratorPrompt } from "./generator-prompt";
import { GeneratorTargetConfig } from "./generator-config";

type GenerateSurveyWithLLMInput = {
  surveyName: string;
  surveyDescription: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  ontologyTargets: string[];
  configs: GeneratorTargetConfig[];
};

export async function generateSurveyWithLLM(
  input: GenerateSurveyWithLLMInput,
): Promise<SurveyGeneratorLLMOutput> {
  const env = getOpenAIEnv();
  const client = new OpenAI({
    apiKey: env.apiKey,
  });

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
