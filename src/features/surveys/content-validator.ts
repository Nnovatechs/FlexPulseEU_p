import { createHash } from "node:crypto";
import OpenAI from "openai";
import {
  buildOntologyTarget,
  fpBehaviourV1Concepts,
} from "@/features/ontology/fp-behaviour-v1";
import {
  buildUntrustedSurveyContentNotice,
  detectPromptInjectionSignals,
} from "@/lib/llm/prompt-safety";
import { getOpenAIEnv } from "@/lib/llm/env";
import type {
  ContentValidationIssue,
  ContentValidationResult,
  SurveyLanguageTranslations,
  SurveyMappingDefinition,
  SurveyQuestionDefinition,
} from "./generator-types";

// ---------------------------------------------------------------------------
// PII detection — structured patterns
// ---------------------------------------------------------------------------

const PII_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // English
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

  // Spanish
  { pattern: /\b(nombre|nombre completo|apellido|apellidos)\b/i, label: "personal name" },
  { pattern: /\bcorreo( electrónico)?\b/i, label: "email address" },
  { pattern: /\bemail\b/i, label: "email address" },
  { pattern: /\b(teléfono|telefono|móvil|movil|celular)\b/i, label: "phone number" },
  { pattern: /\b(dirección|direccion|domicilio)\b/i, label: "physical address" },
  { pattern: /\b(fecha de nacimiento|cumpleaños|cumpleanos)\b/i, label: "date of birth" },
  { pattern: /\b(cuenta bancaria|datos bancarios)\b/i, label: "bank account" },
  { pattern: /\b(tarjeta de crédito|tarjeta de credito)\b/i, label: "credit card number" },
  { pattern: /\b(tarjeta de débito|tarjeta de debito)\b/i, label: "debit card number" },
  { pattern: /\b(pasaporte|número de pasaporte|numero de pasaporte)\b/i, label: "passport number" },
  { pattern: /\bNIF\b/, label: "NIF" },
  { pattern: /\bNIE\b/, label: "NIE" },
  { pattern: /\bDNI\b/, label: "DNI" },

  // Croatian
  { pattern: /\b(ime i prezime|ime|prezime)\b/i, label: "personal name" },
  { pattern: /\b(e-mail|email|adresa e-pošte|adresa e-pošte)\b/i, label: "email address" },
  { pattern: /\b(broj telefona|telefon|mobitel)\b/i, label: "phone number" },
  { pattern: /\b(adresa stanovanja|kućna adresa|kucna adresa|adresa)\b/i, label: "physical address" },
  { pattern: /\b(datum rođenja|datum rodenja)\b/i, label: "date of birth" },
  { pattern: /\b(bankovni račun|bankovni racun|iban)\b/i, label: "bank account" },
  { pattern: /\b(broj putovnice|putovnica)\b/i, label: "passport number" },
  { pattern: /\b(osobna iskaznica|oib)\b/i, label: "national ID" },

  // French
  { pattern: /\b(nom complet|prénom|prenom|nom de famille)\b/i, label: "personal name" },
  { pattern: /\b(adresse e-?mail|courriel|email)\b/i, label: "email address" },
  { pattern: /\b(numéro de téléphone|numero de telephone|téléphone|telephone|portable)\b/i, label: "phone number" },
  { pattern: /\b(adresse postale|adresse du domicile|adresse)\b/i, label: "physical address" },
  { pattern: /\b(date de naissance)\b/i, label: "date of birth" },
  { pattern: /\b(compte bancaire|coordonnées bancaires|coordonnees bancaires)\b/i, label: "bank account" },
  { pattern: /\b(carte bancaire|carte de crédit|carte de credit)\b/i, label: "credit card number" },
  { pattern: /\b(numéro de passeport|numero de passeport|passeport)\b/i, label: "passport number" },

  // German
  { pattern: /\b(vollständiger name|vollstaendiger name|vorname|nachname)\b/i, label: "personal name" },
  { pattern: /\b(e-mail-adresse|email-adresse|email)\b/i, label: "email address" },
  { pattern: /\b(telefonnummer|handynummer|mobilnummer)\b/i, label: "phone number" },
  { pattern: /\b(wohnadresse|postanschrift|adresse)\b/i, label: "physical address" },
  { pattern: /\b(geburtsdatum)\b/i, label: "date of birth" },
  { pattern: /\b(bankkonto|bankverbindung|iban)\b/i, label: "bank account" },
  { pattern: /\b(passnummer|reisepass|ausweisnummer)\b/i, label: "passport number" },
];

export function checkStructuredPII(
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

export function checkPromptInjectionHeuristics(
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

    const detected = detectPromptInjectionSignals(textsToCheck);
    if (detected.length === 0) continue;

    issues.push({
      question_key: q.question_key,
      type: "prompt_injection",
      message:
        "This question contains text patterns associated with prompt injection " +
        `(${detected.join(", ")}). Remove instruction-like or role-like content before validating.`,
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// LLM output schemas
// ---------------------------------------------------------------------------

const piiIntentOutputSchema = {
  name: "pii_intent_output",
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
          required: ["question_key", "passes", "issue_type", "issue"],
          properties: {
            question_key: { type: "string" },
            passes: { type: "boolean" },
            issue_type: {
              anyOf: [
                { type: "string", enum: ["semantic", "quality"] },
                { type: "null" },
              ],
            },
            issue: {
              anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
            },
          },
        },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// PII intent — LLM batch check
// ---------------------------------------------------------------------------

async function checkPIIIntentWithLLM(
  questions: SurveyQuestionDefinition[],
  translations: SurveyLanguageTranslations,
  surveyLanguage: string,
): Promise<ContentValidationIssue[]> {
  const questionInputs = questions.map((q) => {
    const trans = translations.questions[q.question_key];
    return {
      question_key: q.question_key,
      title: trans?.title ?? "",
      description: trans?.description ?? "",
      options: trans?.options ? Object.values(trans.options) : [],
    };
  });

  const untrustedContentNotice = buildUntrustedSurveyContentNotice();
  const systemPrompt =
    "You are a privacy auditor for surveys. " +
    "Your role is to detect whether a question explicitly or effectively asks respondents to provide personally identifiable information or direct contact/financial/government identification data. " +
    "The survey may be written in any language, and some questions may mix multiple languages. " +
    "Do not assume English. Read the content semantically regardless of language. " +
    "Fail a question if it asks for identity, contact details, addresses, birth dates, account details, document numbers, or any other directly identifying personal data. " +
    "Do NOT fail questions that ask for non-identifying contextual attributes useful for analytics, such as country, region, language, broad age band, household characteristics, or technology ownership, unless they directly request identifying details. " +
    untrustedContentNotice;

  const userPrompt =
    `Canonical survey language: ${surveyLanguage}\n` +
    "The content may still contain multiple languages or mixed-language phrasing.\n\n" +
    "Evaluate whether each question asks for personally identifiable information.\n\n" +
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
      json_schema: piiIntentOutputSchema,
    },
  });

  const message = completion.choices[0]?.message;

  if (message?.refusal) {
    throw new Error(`PII validation was refused: ${message.refusal}`);
  }

  if (!message?.content) {
    throw new Error("PII validation returned an empty response.");
  }

  const parsed = JSON.parse(message.content) as {
    results: Array<{ question_key: string; passes: boolean; issue: string | null }>;
  };

  const expectedKeys = new Set(questions.map((q) => q.question_key));
  if (parsed.results.length !== questions.length) {
    throw new Error(
      "PII validation returned an unexpected number of question results.",
    );
  }

  for (const result of parsed.results) {
    if (!expectedKeys.has(result.question_key)) {
      throw new Error(
        `PII validation returned an unknown question key: ${result.question_key}`,
      );
    }
  }

  return parsed.results
    .filter((r) => !r.passes)
    .map((r) => ({
      question_key: r.question_key,
      type: "pii" as const,
      message:
        r.issue ??
        "This question appears to request personally identifiable information.",
    }));
}

// ---------------------------------------------------------------------------
// Semantic alignment — LLM batch check
// ---------------------------------------------------------------------------

async function checkSemanticAlignment(
  questions: SurveyQuestionDefinition[],
  mappings: SurveyMappingDefinition[],
  translations: SurveyLanguageTranslations,
  surveyLanguage: string,
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

  const untrustedContentNotice = buildUntrustedSurveyContentNotice();
  const systemPrompt =
    "You are a survey quality auditor for behavioural energy research. " +
    "Your role is to verify that each survey question genuinely measures its assigned ontological concept and is written clearly enough to be publishable in a professional survey. " +
    "The survey may be written in any language, and some questions may mix multiple languages. " +
    "Do not assume English. Judge the content semantically regardless of language. " +
    "A question also FAILS if it is malformed, visibly incomplete, contains editing leftovers, broken wording, inconsistent answer framing, or is too unclear to be safely published as a survey item. " +
    "A question FAILS only when it asks about something clearly unrelated to the concept — for example, " +
    "asking about food preferences when the concept is energy flexibility willingness. " +
    "Do NOT fail questions for minor wording imperfections, minor subjectivity, or harmless phrasing differences when the item is still clear and publishable. " +
    "Only flag clear semantic mismatches that would produce data unmappable to the stated concept. " +
    untrustedContentNotice;

  const userPrompt =
    `Canonical survey language: ${surveyLanguage}\n` +
    "The content may still contain multiple languages or mixed-language phrasing.\n\n" +
    "Evaluate whether each of the following survey questions genuinely measures its stated ontological concept and whether it is clear and publishable.\n\n" +
    "Use issue_type = semantic when the question does not properly measure the concept.\n" +
    "Use issue_type = quality when the question is too malformed, broken, incomplete or poorly written to be publishable, even if its intent is approximately related.\n\n" +
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
    results: Array<{
      question_key: string;
      passes: boolean;
      issue_type: "semantic" | "quality" | null;
      issue: string | null;
    }>;
  };

  const expectedKeys = new Set(questions.map((q) => q.question_key));
  if (parsed.results.length !== questions.length) {
    throw new Error(
      "Semantic validation returned an unexpected number of question results.",
    );
  }

  for (const result of parsed.results) {
    if (!expectedKeys.has(result.question_key)) {
      throw new Error(
        `Semantic validation returned an unknown question key: ${result.question_key}`,
      );
    }
  }

  return parsed.results
    .filter((r) => !r.passes)
    .map((r) => ({
      question_key: r.question_key,
      type: (r.issue_type ?? "semantic") as "semantic" | "quality",
      message:
        r.issue ??
        (r.issue_type === "quality"
          ? "This question is too unclear or malformed to be published."
          : "This question does not appear to measure its assigned ontology concept."),
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
  surveyLanguage: string,
): Promise<ContentValidationResult> {
  const content_hash = computeContentHash(questions, translations);

  // Step 1: structured PII check — universal patterns and common languages
  const structuredPIIIssues = checkStructuredPII(questions, translations);

  // Step 2: prompt injection heuristics — fail closed on clear attack markers
  const promptInjectionIssues =
    structuredPIIIssues.length === 0
      ? checkPromptInjectionHeuristics(questions, translations)
      : [];

  // Step 3: semantic PII intent check — LLM, only if prior safety checks passed
  const llmPIIIssues =
    structuredPIIIssues.length === 0 && promptInjectionIssues.length === 0
      ? await checkPIIIntentWithLLM(questions, translations, surveyLanguage)
      : [];

  // Step 4: semantic alignment — LLM, only if no safety or PII issues passed through
  const semanticIssues =
    structuredPIIIssues.length === 0 &&
    promptInjectionIssues.length === 0 &&
    llmPIIIssues.length === 0
      ? await checkSemanticAlignment(
          questions,
          mappings,
          translations,
          surveyLanguage,
        )
      : [];

  const issues = [
    ...structuredPIIIssues,
    ...promptInjectionIssues,
    ...llmPIIIssues,
    ...semanticIssues,
  ];

  return {
    validated_at: new Date().toISOString(),
    content_hash,
    passed: issues.length === 0,
    issues,
  };
}
