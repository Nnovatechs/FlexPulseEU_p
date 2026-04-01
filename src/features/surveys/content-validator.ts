import { createHash } from "node:crypto";
import OpenAI from "openai";
import {
  buildOntologyTarget,
  fpBehaviourV1Concepts,
} from "@/features/ontology/fp-behaviour-v1";
import { getOpenAIEnv } from "@/lib/llm/env";
import type {
  ContentValidationIssue,
  ContentValidationResult,
  SurveyLanguageTranslations,
  SurveyMappingDefinition,
  SurveyQuestionDefinition,
} from "./generator-types";

// ---------------------------------------------------------------------------
// PII detection — keyword/pattern based, no LLM
// ---------------------------------------------------------------------------

const PII_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(your\s+)?(full|first|last)\s+name\b/i, label: "personal name" },
  { pattern: /\bsurname\b/i, label: "personal name" },
  { pattern: /\bemail(\s+address)?\b/i, label: "email address" },
  { pattern: /\be-mail(\s+address)?\b/i, label: "email address" },
  { pattern: /\b(phone|telephone|mobile|cell)\s*(number)?\b/i, label: "phone number" },
  { pattern: /\b(home|street|postal|mailing)\s+address\b/i, label: "physical address" },
  { pattern: /\bdate\s+of\s+birth\b/i, label: "date of birth" },
  { pattern: /\bbirthday\b/i, label: "date of birth" },
  { pattern: /\bbank\s+account\b/i, label: "bank account" },
  { pattern: /\bIBAN\b/, label: "IBAN" },
  { pattern: /\bcredit\s+card\b/i, label: "credit card number" },
  { pattern: /\bdebit\s+card\b/i, label: "debit card number" },
  { pattern: /\bpassport\s*(number)?\b/i, label: "passport number" },
  { pattern: /\bnational\s+id\b/i, label: "national ID" },
  { pattern: /\bsocial\s+security\b/i, label: "social security number" },
  { pattern: /\bSSN\b/, label: "SSN" },
  { pattern: /\bNIF\b/, label: "NIF" },
  { pattern: /\bNIE\b/, label: "NIE" },
  { pattern: /\bDNI\b/, label: "DNI" },
];

function checkPII(
  questions: SurveyQuestionDefinition[],
  translations: SurveyLanguageTranslations,
): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];

  for (const q of questions) {
    const trans = translations.questions[q.question_key];
    if (!trans) continue;

    const textsToCheck = [
      trans.title,
      trans.description ?? "",
      ...Object.values(trans.options ?? {}),
    ];

    let matched = false;
    for (const text of textsToCheck) {
      if (matched) break;
      for (const { pattern, label } of PII_PATTERNS) {
        if (pattern.test(text)) {
          issues.push({
            question_key: q.question_key,
            type: "pii",
            message: `This question may request personal data (${label}). Remove or rephrase to avoid collecting PII.`,
          });
          matched = true;
          break;
        }
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Semantic alignment — LLM batch check
// ---------------------------------------------------------------------------

const semanticCheckOutputSchema = {
  name: "semantic_check_output",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question_key", "passes", "issue"],
          properties: {
            question_key: { type: "string" },
            passes: { type: "boolean" },
            issue: {
              anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
            },
          },
        },
      },
    },
  },
} as const;

async function checkSemanticAlignment(
  questions: SurveyQuestionDefinition[],
  mappings: SurveyMappingDefinition[],
  translations: SurveyLanguageTranslations,
): Promise<ContentValidationIssue[]> {
  const conceptDescByTarget: Record<string, string> = {};
  for (const concept of fpBehaviourV1Concepts) {
    const target = buildOntologyTarget(concept.block, concept.attribute);
    conceptDescByTarget[target] = concept.description;
  }

  const mappingByKey: Record<string, SurveyMappingDefinition> = {};
  for (const m of mappings) {
    mappingByKey[m.question_key] = m;
  }

  const questionInputs = questions.map((q) => {
    const trans = translations.questions[q.question_key];
    const mapping = mappingByKey[q.question_key];
    return {
      question_key: q.question_key,
      title: trans?.title ?? "",
      description: trans?.description ?? "",
      options: trans?.options ? Object.values(trans.options) : [],
      ontology_target: mapping?.ontology_target ?? "unknown",
      concept_description: mapping
        ? (conceptDescByTarget[mapping.ontology_target] ?? "No description available.")
        : "No mapping found.",
    };
  });

  const systemPrompt =
    "You are a survey quality auditor for behavioural energy research. " +
    "Your role is to verify that each survey question genuinely measures its assigned ontological concept. " +
    "A question FAILS only when it asks about something clearly unrelated to the concept — for example, " +
    "asking about food preferences when the concept is energy flexibility willingness. " +
    "Do NOT fail questions for imperfect wording, minor subjectivity, or different phrasing styles. " +
    "Only flag clear semantic mismatches that would produce data unmappable to the stated concept.";

  const userPrompt =
    "Evaluate whether each of the following survey questions genuinely measures its stated ontological concept.\n\n" +
    `Questions:\n${JSON.stringify(questionInputs, null, 2)}\n\n` +
    "Return a JSON result for every question.";

  const env = getOpenAIEnv();
  const client = new OpenAI({ apiKey: env.apiKey });

  const completion = await client.chat.completions.create({
    model: env.model,
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: semanticCheckOutputSchema,
    },
  });

  const message = completion.choices[0]?.message;

  if (message?.refusal) {
    throw new Error(`Semantic validation was refused: ${message.refusal}`);
  }

  if (!message?.content) {
    throw new Error("Semantic validation returned an empty response.");
  }

  const parsed = JSON.parse(message.content) as {
    results: Array<{ question_key: string; passes: boolean; issue: string | null }>;
  };

  return parsed.results
    .filter((r) => !r.passes)
    .map((r) => ({
      question_key: r.question_key,
      type: "semantic" as const,
      message:
        r.issue ??
        "This question does not appear to measure its assigned ontology concept.",
    }));
}

// ---------------------------------------------------------------------------
// Content hash — detects stale validation after edits
// ---------------------------------------------------------------------------

export function computeContentHash(
  questions: SurveyQuestionDefinition[],
  translations: SurveyLanguageTranslations,
): string {
  const parts = questions.map((q) => {
    const trans = translations.questions[q.question_key];
    const optionTexts =
      q.options?.map((o) => trans?.options?.[o.option_key] ?? "").join("|") ?? "";
    return `${q.question_key}:${trans?.title ?? ""}:${trans?.description ?? ""}:${optionTexts}`;
  });
  return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runContentValidation(
  questions: SurveyQuestionDefinition[],
  mappings: SurveyMappingDefinition[],
  translations: SurveyLanguageTranslations,
): Promise<ContentValidationResult> {
  const content_hash = computeContentHash(questions, translations);

  // Step 1: PII check — fast, no LLM, hard gate
  const piiIssues = checkPII(questions, translations);

  // Step 2: Semantic alignment — LLM, only if PII passed
  const semanticIssues =
    piiIssues.length === 0
      ? await checkSemanticAlignment(questions, mappings, translations)
      : [];

  const issues = [...piiIssues, ...semanticIssues];

  return {
    validated_at: new Date().toISOString(),
    content_hash,
    passed: issues.length === 0,
    issues,
  };
}
