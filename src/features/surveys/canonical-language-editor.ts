import OpenAI from "openai";
import { getOpenAIEnv } from "@/lib/llm/env";
import type {
  SurveyGeneratorLLMOutput,
  SurveyGeneratorLLMQuestion,
} from "./survey-generation-contracts";
import type { MeasurementPlanBlueprint } from "./measurement-plan";
import { getSurveyLanguageProfile } from "./survey-language-profile";
import {
  writeSurveyGeneratorDebugJson,
  writeSurveyGeneratorDebugText,
} from "./generator-debug";
import { timeSurveyStep } from "./local-timing";

type CanonicalLanguageEditorInput = {
  defaultLanguage: string;
  writerOutput: SurveyGeneratorLLMOutput;
  writerBlueprint: MeasurementPlanBlueprint;
  debugFilePrefix?: string;
};

type CanonicalLanguageQualityFlag =
  | "grammar"
  | "unnatural_wording"
  | "awkward_collocation"
  | "unclear_referent"
  | "abstract_placeholder"
  | "technical_or_internal_language"
  | "response_anchor_mismatch"
  | "none";

type CanonicalLanguageEditorDecision = "keep" | "rewrite";

type CanonicalLanguageEditorQuestionPatch = {
  slot_key: string;
  decision: CanonicalLanguageEditorDecision;
  quality_flags: CanonicalLanguageQualityFlag[];
  title: string;
  description: string;
  options: Array<{
    ontology_value: string;
    label: string;
  }>;
  scale:
    | {
        min_label: string;
        max_label: string;
      }
    | null;
};

type CanonicalLanguageEditorOutput = {
  survey_title: string;
  survey_description: string;
  questions: CanonicalLanguageEditorQuestionPatch[];
};

type CanonicalLanguageEditorDiagnosticCode =
  | "editor_call_failed"
  | "invalid_output"
  | "missing_slot"
  | "duplicate_slot"
  | "unknown_slot"
  | "invalid_option_set"
  | "invalid_scale"
  | "invalid_decision_flags"
  | "rewrite_noop"
  | "keep_modified_copy";

type CanonicalLanguageEditorDiagnostic = {
  code: CanonicalLanguageEditorDiagnosticCode;
  slot_key?: string;
  message: string;
};

type CanonicalLanguageEditorReport = {
  language: string;
  status: "completed" | "partial" | "fallback";
  total_slots: number;
  kept_slots: number;
  applied_rewrites: number;
  fallback_slots: number;
  diagnostics: CanonicalLanguageEditorDiagnostic[];
};

type CanonicalLanguageEditorRunResult = {
  output: SurveyGeneratorLLMOutput;
  report: CanonicalLanguageEditorReport;
};

type CanonicalLanguageEditorReconcileResult = {
  output: SurveyGeneratorLLMOutput;
  keptSlots: number;
  appliedRewrites: number;
  fallbackSlots: number;
  diagnostics: CanonicalLanguageEditorDiagnostic[];
};

const CANONICAL_LANGUAGE_QUALITY_FLAGS = [
  "grammar",
  "unnatural_wording",
  "awkward_collocation",
  "unclear_referent",
  "abstract_placeholder",
  "technical_or_internal_language",
  "response_anchor_mismatch",
  "none",
] as const;

const canonicalLanguageEditorOutputSchema = {
  name: "canonical_language_editor_output",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["survey_title", "survey_description", "questions"],
    properties: {
      survey_title: { type: "string", minLength: 1 },
      survey_description: { type: "string" },
      questions: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "slot_key",
            "decision",
            "quality_flags",
            "title",
            "description",
            "options",
            "scale",
          ],
          properties: {
            slot_key: { type: "string", minLength: 1 },
            decision: {
              type: "string",
              enum: ["keep", "rewrite"],
            },
            quality_flags: {
              type: "array",
              minItems: 1,
              items: {
                type: "string",
                enum: CANONICAL_LANGUAGE_QUALITY_FLAGS,
              },
            },
            title: { type: "string", minLength: 1 },
            description: { type: "string" },
            options: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["ontology_value", "label"],
                properties: {
                  ontology_value: { type: "string", minLength: 1 },
                  label: { type: "string", minLength: 1 },
                },
              },
            },
            scale: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["min_label", "max_label"],
                  properties: {
                    min_label: { type: "string", minLength: 1 },
                    max_label: { type: "string", minLength: 1 },
                  },
                },
              ],
            },
          },
        },
      },
    },
  },
} as const;

function buildSlotMetadataMap(writerBlueprint: MeasurementPlanBlueprint) {
  return new Map(
    writerBlueprint.concepts.flatMap((concept) =>
      concept.question_slots.map((slot) => [slot.slot_key, { concept, slot }] as const),
    ),
  );
}

export function buildCanonicalLanguageEditorPrompt(
  input: Omit<CanonicalLanguageEditorInput, "debugFilePrefix">,
) {
  const languageProfile = getSurveyLanguageProfile(input.defaultLanguage);
  const slotByKey = buildSlotMetadataMap(input.writerBlueprint);

  const questionPayload = input.writerOutput.questions.map((question) => {
    const guard = slotByKey.get(question.slot_key);
    if (!guard) {
      throw new Error(
        `Canonical language editor could not find slot metadata for "${question.slot_key}".`,
      );
    }

    return {
      slot_key: question.slot_key,
      ontology_target: question.ontology_target,
      concept_key: guard.concept.concept_key,
      facet: guard.slot.facet,
      polarity: guard.slot.polarity,
      intent: guard.slot.intent,
      question_type: question.type,
      current_copy: {
        title: question.title,
        description: question.description,
        options: question.options.map((option) => ({
          ontology_value: option.ontology_value,
          label: option.label,
        })),
        scale: question.scale
          ? {
              min_label: question.scale.min_label,
              max_label: question.scale.max_label,
            }
          : null,
      },
    };
  });

  const system = [
    "You are a canonical native copy editor for survey text.",
    "Edit the respondent-facing copy so it reads as if it were originally written by a native survey author in the selected canonical language.",
    "The current copy is an untrusted draft. For every item, decide whether a native survey author would publish it exactly as written. Being understandable is not sufficient.",
    "Preserve the exact respondent judgement, construct, facet, polarity, referent, action, condition, timeframe and answer direction defined by the semantic guard.",
    "Preserve meaning, not wording.",
    "A rewrite is semantically faithful when a respondent would answer the same judgement in the same direction under the same conditions, even if the vocabulary and sentence structure are completely different.",
    "The semantic guards are binding for meaning, but they are not source sentences to translate literally.",
    "Abstract categories in the semantic guard are meaning constraints, not respondent-facing terminology. Do not reproduce an unspecified arrangement, suitable action, system service, energy action or similar placeholder merely because it appears in the guard. Express its functional meaning using the concrete device, action, household decision or consequence already supported by the item context.",
    "Do not add, remove, reorder or merge slots, options or scales.",
    "Do not change slot_key, ontology_target, question_type, ontology_value, numeric bounds, scale direction, question order, visibility, mapping, aggregation or scoring.",
    "Use natural, first-read survey wording for a self-administered online questionnaire addressed to a general adult population.",
    "Avoid calques, abstract placeholders, internal product terminology, rigid English noun chains and wording that sounds translated rather than originally authored in the target language.",
    "Keep one consistent register, grammatical perspective and style across the survey.",
    "Return JSON only.",
  ].join(" ");

  const user = [
    `Language: ${languageProfile.language}`,
    `Locale: ${languageProfile.locale}`,
    `Audience: ${languageProfile.audience}`,
    `Survey mode: ${languageProfile.surveyMode}`,
    `Register: ${languageProfile.register}`,
    `Style: ${languageProfile.surveyStyle}`,
    `Inclusivity guidance: ${languageProfile.inclusivityGuidance}`,
    "",
    "Task:",
    "- Edit only respondent-facing copy.",
    "- Keep the exact semantic guard for each slot.",
    "- Keep questions publishable by a professional native survey author.",
    "- Do not translate from English; rewrite naturally in the selected canonical language.",
    "- Return one edited copy block for every slot_key provided.",
    "- For each slot, return a decision and quality_flags.",
    "- Option labels must be keyed by the exact ontology_value already present in the current copy.",
    "- Rating-scale endpoint labels must preserve answer direction while sounding natural in the canonical language.",
    "",
    "For every item:",
    "1. Read the current respondent-facing copy by itself, as a native respondent would read it.",
    "2. Decide whether a professional native survey author would publish it exactly as written.",
    "3. Check grammar, idiomatic wording, collocations, referent clarity, respondent-facing terminology and response-anchor fit.",
    "4. Use the semantic guard only to preserve measurement meaning and answer direction.",
    "5. If any publishability condition fails, rewrite the copy freely in the canonical language.",
    "6. If the item is already genuinely native and publishable, keep it exactly unchanged.",
    "",
    "Decision rules:",
    '- Use decision "keep" only when the item is already publishable exactly as written.',
    '- Use decision "rewrite" whenever grammar, phrasing, terminology, referents or anchors would not be publishable.',
    '- If decision is "keep", quality_flags must be exactly ["none"].',
    '- If decision is "rewrite", quality_flags must contain one or more non-"none" flags.',
    "",
    `Current survey title: ${input.writerOutput.survey_title}`,
    `Current survey description: ${input.writerOutput.survey_description}`,
    "",
    `Question guards:\n${JSON.stringify(questionPayload, null, 2)}`,
  ].join("\n");

  return { system, user };
}

function getVisibleTextSnapshot(question: {
  title: string;
  description: string;
  options: Array<{ ontology_value: string; label: string }>;
  scale: { min_label: string; max_label: string } | null;
}) {
  return {
    title: question.title,
    description: question.description,
    options: Object.fromEntries(
      question.options.map((option) => [option.ontology_value, option.label]),
    ),
    scale: question.scale
      ? {
          min_label: question.scale.min_label,
          max_label: question.scale.max_label,
        }
      : null,
  };
}

function hasVisibleCopyChanged(input: {
  originalQuestion: SurveyGeneratorLLMQuestion;
  editedQuestion: CanonicalLanguageEditorQuestionPatch;
}) {
  const original = getVisibleTextSnapshot(input.originalQuestion);
  const edited = getVisibleTextSnapshot(input.editedQuestion);
  return JSON.stringify(original) !== JSON.stringify(edited);
}

export function parseCanonicalLanguageEditorOutput(input: {
  content: string | null | undefined;
  refusal: string | null | undefined;
  targetLanguage: string;
}): CanonicalLanguageEditorOutput {
  if (input.refusal) {
    throw new Error(
      `Canonical language editor was refused for ${input.targetLanguage}: ${input.refusal}`,
    );
  }

  if (!input.content) {
    throw new Error(
      `Canonical language editor returned an empty response for ${input.targetLanguage}.`,
    );
  }

  return JSON.parse(input.content) as CanonicalLanguageEditorOutput;
}

function applyCanonicalLanguageEditorQuestionPatch(input: {
  originalQuestion: SurveyGeneratorLLMQuestion;
  patch: CanonicalLanguageEditorQuestionPatch;
}) {
  const optionPatchByValue = new Map(
    input.patch.options.map((option) => [option.ontology_value, option]),
  );

  return {
    ...input.originalQuestion,
    title: input.patch.title,
    description: input.patch.description,
    options: input.originalQuestion.options.map((option) => ({
      ...option,
      label:
        optionPatchByValue.get(option.ontology_value)?.label ?? option.label,
    })),
    scale: input.originalQuestion.scale
      ? {
          ...input.originalQuestion.scale,
          min_label:
            input.patch.scale?.min_label ?? input.originalQuestion.scale.min_label,
          max_label:
            input.patch.scale?.max_label ?? input.originalQuestion.scale.max_label,
        }
      : null,
  };
}

function createDiagnostic(
  code: CanonicalLanguageEditorDiagnosticCode,
  message: string,
  slot_key?: string,
): CanonicalLanguageEditorDiagnostic {
  return { code, message, ...(slot_key ? { slot_key } : {}) };
}

function buildFallbackReport(input: {
  language: string;
  totalSlots: number;
  diagnostics: CanonicalLanguageEditorDiagnostic[];
}): CanonicalLanguageEditorReport {
  return {
    language: input.language,
    status: "fallback",
    total_slots: input.totalSlots,
    kept_slots: 0,
    applied_rewrites: 0,
    fallback_slots: input.totalSlots,
    diagnostics: input.diagnostics,
  };
}

function finalizeReport(input: {
  language: string;
  totalSlots: number;
  keptSlots: number;
  appliedRewrites: number;
  fallbackSlots: number;
  diagnostics: CanonicalLanguageEditorDiagnostic[];
}): CanonicalLanguageEditorReport {
  const status =
    input.fallbackSlots === input.totalSlots
      ? "fallback"
      : input.diagnostics.length === 0
        ? "completed"
        : "partial";

  return {
    language: input.language,
    status,
    total_slots: input.totalSlots,
    kept_slots: input.keptSlots,
    applied_rewrites: input.appliedRewrites,
    fallback_slots: input.fallbackSlots,
    diagnostics: input.diagnostics,
  };
}

export function reconcileCanonicalLanguageEditorOutput(input: {
  writerOutput: SurveyGeneratorLLMOutput;
  editedOutput: CanonicalLanguageEditorOutput;
  targetLanguage: string;
}): CanonicalLanguageEditorReconcileResult {
  const diagnostics: CanonicalLanguageEditorDiagnostic[] = [];
  const patchCountsBySlot = new Map<string, number>();
  const patchBySlot = new Map<string, CanonicalLanguageEditorQuestionPatch>();

  for (const patch of input.editedOutput.questions) {
    patchCountsBySlot.set(
      patch.slot_key,
      (patchCountsBySlot.get(patch.slot_key) ?? 0) + 1,
    );
    if (!patchBySlot.has(patch.slot_key)) {
      patchBySlot.set(patch.slot_key, patch);
    }
  }

  for (const patch of input.editedOutput.questions) {
    if (!input.writerOutput.questions.some((question) => question.slot_key === patch.slot_key)) {
      diagnostics.push(
        createDiagnostic(
          "unknown_slot",
          `Canonical language editor returned unknown slot "${patch.slot_key}" for ${input.targetLanguage}.`,
          patch.slot_key,
        ),
      );
    }
  }

  let keptSlots = 0;
  let appliedRewrites = 0;
  let fallbackSlots = 0;

  const questions = input.writerOutput.questions.map((question) => {
    const patchCount = patchCountsBySlot.get(question.slot_key) ?? 0;
    if (patchCount === 0) {
      fallbackSlots += 1;
      diagnostics.push(
        createDiagnostic(
          "missing_slot",
          `Canonical language editor did not return slot "${question.slot_key}" for ${input.targetLanguage}.`,
          question.slot_key,
        ),
      );
      return question;
    }

    if (patchCount > 1) {
      fallbackSlots += 1;
      diagnostics.push(
        createDiagnostic(
          "duplicate_slot",
          `Canonical language editor returned duplicate slot "${question.slot_key}" for ${input.targetLanguage}.`,
          question.slot_key,
        ),
      );
      return question;
    }

    const patch = patchBySlot.get(question.slot_key);
    if (!patch?.title?.trim()) {
      fallbackSlots += 1;
      diagnostics.push(
        createDiagnostic(
          "invalid_output",
          `Canonical language editor returned an empty title for slot "${question.slot_key}" in ${input.targetLanguage}.`,
          question.slot_key,
        ),
      );
      return question;
    }

    const uniqueFlags = new Set(patch.quality_flags);
    if (uniqueFlags.size !== patch.quality_flags.length) {
      fallbackSlots += 1;
      diagnostics.push(
        createDiagnostic(
          "invalid_decision_flags",
          `Canonical language editor returned duplicate quality flags for slot "${question.slot_key}" in ${input.targetLanguage}.`,
          question.slot_key,
        ),
      );
      return question;
    }

    const expectedOptionKeys = new Set(
      question.options.map((option) => option.ontology_value),
    );
    const outputOptionKeys = new Set(
      patch.options.map((option) => option.ontology_value),
    );

    if (outputOptionKeys.size !== expectedOptionKeys.size) {
      fallbackSlots += 1;
      diagnostics.push(
        createDiagnostic(
          "invalid_option_set",
          `Canonical language editor returned an unexpected option set for slot "${question.slot_key}" in ${input.targetLanguage}.`,
          question.slot_key,
        ),
      );
      return question;
    }

    for (const optionKey of expectedOptionKeys) {
      if (!outputOptionKeys.has(optionKey)) {
        fallbackSlots += 1;
        diagnostics.push(
          createDiagnostic(
            "invalid_option_set",
            `Canonical language editor is missing option "${optionKey}" for slot "${question.slot_key}" in ${input.targetLanguage}.`,
            question.slot_key,
          ),
        );
        return question;
      }
    }

    if (question.type === "rating_scale") {
      if (!patch.scale?.min_label?.trim() || !patch.scale.max_label?.trim()) {
        fallbackSlots += 1;
        diagnostics.push(
          createDiagnostic(
            "invalid_scale",
            `Canonical language editor returned invalid scale anchors for slot "${question.slot_key}" in ${input.targetLanguage}.`,
            question.slot_key,
          ),
        );
        return question;
      }
    } else if (patch.scale !== null) {
      fallbackSlots += 1;
      diagnostics.push(
        createDiagnostic(
          "invalid_scale",
          `Canonical language editor returned incompatible scale anchors for slot "${question.slot_key}" in ${input.targetLanguage}.`,
          question.slot_key,
        ),
      );
      return question;
    }

    const hasChangedVisibleCopy = hasVisibleCopyChanged({
      originalQuestion: question,
      editedQuestion: patch,
    });
    const hasNoneFlag = patch.quality_flags.includes("none");

    if (patch.decision === "keep") {
      if (
        patch.quality_flags.length !== 1 ||
        patch.quality_flags[0] !== "none"
      ) {
        fallbackSlots += 1;
        diagnostics.push(
          createDiagnostic(
            "invalid_decision_flags",
            `Canonical language editor returned inconsistent decision/flags for keep on slot "${question.slot_key}" in ${input.targetLanguage}.`,
            question.slot_key,
          ),
        );
        return question;
      }

      if (hasChangedVisibleCopy) {
        fallbackSlots += 1;
        diagnostics.push(
          createDiagnostic(
            "keep_modified_copy",
            `Canonical language editor modified visible copy while returning keep for slot "${question.slot_key}" in ${input.targetLanguage}.`,
            question.slot_key,
          ),
        );
        return question;
      }

      keptSlots += 1;
      return question;
    }

    if (patch.quality_flags.length === 0 || hasNoneFlag) {
      fallbackSlots += 1;
      diagnostics.push(
        createDiagnostic(
          "invalid_decision_flags",
          `Canonical language editor returned inconsistent decision/flags for rewrite on slot "${question.slot_key}" in ${input.targetLanguage}.`,
          question.slot_key,
        ),
      );
      return question;
    }

    if (!hasChangedVisibleCopy) {
      fallbackSlots += 1;
      diagnostics.push(
        createDiagnostic(
          "rewrite_noop",
          `Canonical language editor returned rewrite without visible copy changes for slot "${question.slot_key}" in ${input.targetLanguage}.`,
          question.slot_key,
        ),
      );
      return question;
    }

    appliedRewrites += 1;
    return applyCanonicalLanguageEditorQuestionPatch({
      originalQuestion: question,
      patch,
    });
  });

  const output: SurveyGeneratorLLMOutput = {
    ...input.writerOutput,
    survey_title: input.editedOutput.survey_title || input.writerOutput.survey_title,
    survey_description:
      input.editedOutput.survey_description ?? input.writerOutput.survey_description,
    questions,
  };

  return {
    output,
    keptSlots,
    appliedRewrites,
    fallbackSlots,
    diagnostics,
  };
}

function createClient() {
  const env = getOpenAIEnv();
  return {
    env,
    client: new OpenAI({
      apiKey: env.apiKey,
    }),
  };
}

export async function runCanonicalLanguageCopyEditor(
  input: CanonicalLanguageEditorInput,
): Promise<CanonicalLanguageEditorRunResult> {
  const debugPrefix = input.debugFilePrefix ?? "canonical-language-editor";

  let env: ReturnType<typeof getOpenAIEnv>;
  let client: OpenAI;

  try {
    const created = createClient();
    env = created.env;
    client = created.client;
  } catch (error) {
    const report = buildFallbackReport({
      language: input.defaultLanguage,
      totalSlots: input.writerOutput.questions.length,
      diagnostics: [
        createDiagnostic(
          "editor_call_failed",
          error instanceof Error
            ? error.message
            : "Canonical language editor failed to initialize.",
        ),
      ],
    });

    await Promise.all([
      writeSurveyGeneratorDebugJson(`${debugPrefix}/report.json`, report),
      writeSurveyGeneratorDebugJson(
        `${debugPrefix}/applied-output.json`,
        input.writerOutput,
      ),
    ]);

    return { output: input.writerOutput, report };
  }

  const prompt = buildCanonicalLanguageEditorPrompt(input);

  await Promise.all([
    writeSurveyGeneratorDebugText(`${debugPrefix}/prompt-system.txt`, prompt.system),
    writeSurveyGeneratorDebugText(`${debugPrefix}/prompt-user.txt`, prompt.user),
    writeSurveyGeneratorDebugJson(
      `${debugPrefix}/response-schema.json`,
      canonicalLanguageEditorOutputSchema,
    ),
  ]);

  try {
    const completion = await timeSurveyStep(
      "llm.canonical_language_editor",
      {
        model: env.model,
        target_language: input.defaultLanguage,
        question_count: input.writerOutput.questions.length,
      },
      async () =>
        client.chat.completions.create({
          model: env.model,
          temperature: 0.2,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: canonicalLanguageEditorOutputSchema,
          },
        }),
    );

    const message = completion.choices[0]?.message;

    await writeSurveyGeneratorDebugText(
      `${debugPrefix}/output-raw.json`,
      message?.content ?? "",
    );

    const parsed = parseCanonicalLanguageEditorOutput({
      content: message?.content,
      refusal: message?.refusal,
      targetLanguage: input.defaultLanguage,
    });

    await writeSurveyGeneratorDebugJson(`${debugPrefix}/output-parsed.json`, parsed);

    const reconciled = reconcileCanonicalLanguageEditorOutput({
      writerOutput: input.writerOutput,
      editedOutput: parsed,
      targetLanguage: input.defaultLanguage,
    });

    const report = finalizeReport({
      language: input.defaultLanguage,
      totalSlots: input.writerOutput.questions.length,
      keptSlots: reconciled.keptSlots,
      appliedRewrites: reconciled.appliedRewrites,
      fallbackSlots: reconciled.fallbackSlots,
      diagnostics: reconciled.diagnostics,
    });

    await Promise.all([
      writeSurveyGeneratorDebugJson(`${debugPrefix}/report.json`, report),
      writeSurveyGeneratorDebugJson(
        `${debugPrefix}/applied-output.json`,
        reconciled.output,
      ),
    ]);

    return {
      output: reconciled.output,
      report,
    };
  } catch (error) {
    const report = buildFallbackReport({
      language: input.defaultLanguage,
      totalSlots: input.writerOutput.questions.length,
      diagnostics: [
        createDiagnostic(
          "editor_call_failed",
          error instanceof Error
            ? error.message
            : "Canonical language editor failed during execution.",
        ),
      ],
    });

    await Promise.all([
      writeSurveyGeneratorDebugJson(`${debugPrefix}/report.json`, report),
      writeSurveyGeneratorDebugJson(
        `${debugPrefix}/applied-output.json`,
        input.writerOutput,
      ),
    ]);

    return { output: input.writerOutput, report };
  }
}

export type {
  CanonicalLanguageEditorDecision,
  CanonicalLanguageEditorDiagnostic,
  CanonicalLanguageEditorDiagnosticCode,
  CanonicalLanguageEditorOutput,
  CanonicalLanguageEditorQuestionPatch,
  CanonicalLanguageEditorReport,
  CanonicalLanguageEditorRunResult,
  CanonicalLanguageQualityFlag,
};
