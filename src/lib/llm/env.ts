type OpenAIEnv = {
  apiKey: string;
  model: string;
};

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getOpenAIEnv(): OpenAIEnv {
  return {
    apiKey: readRequiredEnv("OPENAI_API_KEY"),
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
  };
}
