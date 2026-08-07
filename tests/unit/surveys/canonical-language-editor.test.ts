import { describe, expect, it } from "vitest";
import {
  buildCanonicalLanguageEditorPrompt,
  parseCanonicalLanguageEditorOutput,
  reconcileCanonicalLanguageEditorOutput,
  type CanonicalLanguageEditorOutput,
  type CanonicalLanguageQualityFlag,
} from "@/features/surveys/canonical-language-editor";
import {
  DFC_INVENTORY_SLOT_KEY,
  mergeDeclaredFlexibilityCapabilityWriterBlueprint,
} from "@/features/surveys/declared-flexibility-capability-module";
import type { SurveyGeneratorLLMOutput } from "@/features/surveys/survey-generation-contracts";
import type { MeasurementPlanBlueprint } from "@/features/surveys/measurement-plan";

const writerOutput: SurveyGeneratorLLMOutput = {
  survey_title: "Automatización del hogar",
  survey_description: "Encuesta sobre energía",
  estimated_completion_minutes: 5,
  questions: [
    {
      slot_key: "SLOT_TRUST_IN_AUTOMATION_01",
      title: "Confío en la automatización del hogar.",
      description: "",
      ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
      type: "rating_scale",
      options: [],
      scale: {
        min: 1,
        max: 5,
        step: 1,
        min_label: "Muy poco",
        max_label: "Mucho",
      },
      numeric: null,
    },
    {
      slot_key: "SLOT_PREFERRED_TARIFF_MODEL_01",
      title: "¿Qué tarifa prefiere?",
      description: "",
      ontology_target: "flexpulse_behavioural_schema.preferred_tariff_model",
      type: "single_choice",
      options: [
        {
          label: "Mismo precio",
          ontology_value: "same_price",
          is_truthy: true,
        },
        {
          label: "No lo sé",
          ontology_value: "not_sure",
          is_truthy: true,
        },
      ],
      scale: null,
      numeric: null,
    },
  ],
};

const plannerBlueprint: MeasurementPlanBlueprint = {
  schema_version: 1,
  schema_namespace: "flexpulse_behavioural_schema",
  concepts: [
    {
      concept_key: "trust_in_automation",
      output_type: "number",
      evidence_source: "survey_questions",
      allowed_measurement_types: ["single_item_direct"],
      slot_capacity_max: 1,
      measurement_type: "single_item_direct",
      aggregation_rule: "identity",
      threshold_profile: "likert_1_5_low_mid_high",
      minimum_answer_count: 1,
      question_slots: [
        {
          slot_key: "SLOT_TRUST_IN_AUTOMATION_01",
          facet: "delegation_readiness",
          intent: "Measure willingness to hand off one suitable action.",
          polarity: "positive",
        },
      ],
    },
    {
      concept_key: "preferred_tariff_model",
      output_type: "string",
      evidence_source: "survey_questions",
      allowed_measurement_types: ["single_choice_enum"],
      slot_capacity_max: 1,
      measurement_type: "single_choice_enum",
      aggregation_rule: "identity",
      threshold_profile: "enum_identity",
      minimum_answer_count: 1,
      question_slots: [
        {
          slot_key: "SLOT_PREFERRED_TARIFF_MODEL_01",
          facet: "tariff_choice",
          intent: "Measure preferred tariff model.",
          polarity: "neutral",
        },
      ],
    },
  ],
};

function buildEditorOutput(overrides?: {
  trustDecision?: "keep" | "rewrite";
  trustFlags?: CanonicalLanguageQualityFlag[];
  trustTitle?: string;
  trustDescription?: string;
  trustScale?: { min_label: string; max_label: string } | null;
  tariffDecision?: "keep" | "rewrite";
  tariffFlags?: CanonicalLanguageQualityFlag[];
  tariffTitle?: string;
  tariffDescription?: string;
  tariffOptions?: Array<{ ontology_value: string; label: string }>;
}): CanonicalLanguageEditorOutput {
  return {
    survey_title: "Confianza en la automatización doméstica",
    survey_description: "Encuesta sobre decisiones energéticas del hogar",
    questions: [
      {
        slot_key: "SLOT_TRUST_IN_AUTOMATION_01",
        decision: overrides?.trustDecision ?? "rewrite",
        quality_flags: overrides?.trustFlags ?? [
          "unnatural_wording",
          "abstract_placeholder",
        ],
        title:
          overrides?.trustTitle ??
          "Confiaría en que un sistema automatizado retrasara una tarea sin urgencia de forma segura.",
        description: overrides?.trustDescription ?? "",
        options: [],
        scale: overrides?.trustScale ?? {
          min_label: "Nada de acuerdo",
          max_label: "Totalmente de acuerdo",
        },
      },
      {
        slot_key: "SLOT_PREFERRED_TARIFF_MODEL_01",
        decision: overrides?.tariffDecision ?? "rewrite",
        quality_flags: overrides?.tariffFlags ?? ["unclear_referent"],
        title:
          overrides?.tariffTitle ??
          "¿Qué tipo de tarifa eléctrica preferiría para su hogar?",
        description: overrides?.tariffDescription ?? "",
        options: overrides?.tariffOptions ?? [
          {
            ontology_value: "same_price",
            label: "El mismo precio la mayor parte del tiempo",
          },
          {
            ontology_value: "not_sure",
            label: "No lo sé / necesitaría más información",
          },
        ],
        scale: null,
      },
    ],
  };
}

describe("canonical language editor", () => {
  it("builds a prompt with language profile and semantic guards", () => {
    const prompt = buildCanonicalLanguageEditorPrompt({
      defaultLanguage: "Spanish",
      writerOutput,
      writerBlueprint: plannerBlueprint,
    });

    expect(prompt.user).toContain("Locale: Spain Spanish (es-ES)");
    expect(prompt.user).toContain("Survey mode: self-administered online questionnaire");
    expect(prompt.user).toContain('"slot_key": "SLOT_TRUST_IN_AUTOMATION_01"');
    expect(prompt.user).toContain('"facet": "delegation_readiness"');
    expect(prompt.user).toContain('"polarity": "positive"');
    expect(prompt.system).toContain(
      "The current copy is an untrusted draft. For every item, decide whether a native survey author would publish it exactly as written. Being understandable is not sufficient.",
    );
    expect(prompt.system).toContain("Preserve meaning, not wording.");
    expect(prompt.system).toContain(
      "Abstract categories in the semantic guard are meaning constraints, not respondent-facing terminology.",
    );
    expect(prompt.user).toContain(
      "1. Read the current respondent-facing copy by itself, as a native respondent would read it.",
    );
    expect(prompt.user).toContain(
      '6. If the item is already genuinely native and publishable, keep it exactly unchanged.',
    );
    expect(prompt.user).toContain(
      'If decision is "keep", quality_flags must be exactly ["none"].',
    );
  });

  it("reconciles a valid rewrite patch without changing structure", () => {
    const parsed = parseCanonicalLanguageEditorOutput({
      content: JSON.stringify(buildEditorOutput()),
      refusal: null,
      targetLanguage: "Spanish",
    });

    const reconciled = reconcileCanonicalLanguageEditorOutput({
      writerOutput,
      editedOutput: parsed,
      targetLanguage: "Spanish",
    });

    expect(reconciled.output.survey_title).toBe(
      "Confianza en la automatización doméstica",
    );
    expect(reconciled.output.questions[0]?.slot_key).toBe(
      "SLOT_TRUST_IN_AUTOMATION_01",
    );
    expect(reconciled.output.questions[0]?.type).toBe("rating_scale");
    expect(parsed.questions[0]?.quality_flags).toEqual([
      "unnatural_wording",
      "abstract_placeholder",
    ]);
    expect(parsed.questions[0]?.decision).toBe("rewrite");
    expect("decision" in reconciled.output.questions[0]!).toBe(false);
    expect("quality_flags" in reconciled.output.questions[0]!).toBe(false);
    expect(reconciled.output.questions[1]?.options).toEqual([
      {
        label: "El mismo precio la mayor parte del tiempo",
        ontology_value: "same_price",
        is_truthy: true,
      },
      {
        label: "No lo sé / necesitaría más información",
        ontology_value: "not_sure",
        is_truthy: true,
      },
    ]);
    expect(reconciled.output.questions[0]?.scale).toEqual({
      min: 1,
      max: 5,
      step: 1,
      min_label: "Nada de acuerdo",
      max_label: "Totalmente de acuerdo",
    });
    expect(reconciled.appliedRewrites).toBe(2);
    expect(reconciled.fallbackSlots).toBe(0);
  });

  it("allows multiple quality flags on a rewritten item", () => {
    const parsed = parseCanonicalLanguageEditorOutput({
      content: JSON.stringify(
        buildEditorOutput({
          trustFlags: [
            "grammar",
            "awkward_collocation",
            "unclear_referent",
          ],
        }),
      ),
      refusal: null,
      targetLanguage: "Spanish",
    });

    expect(parsed.questions[0]?.quality_flags).toEqual([
      "grammar",
      "awkward_collocation",
      "unclear_referent",
    ]);
  });

  it("falls back for a missing slot without blocking other rewrites", () => {
    const reconciled = reconcileCanonicalLanguageEditorOutput({
      writerOutput,
      editedOutput: {
        survey_title: "Confianza en la automatización doméstica",
        survey_description: "Encuesta sobre decisiones energéticas del hogar",
        questions: [buildEditorOutput().questions[0]!],
      },
      targetLanguage: "Spanish",
    });

    expect(reconciled.appliedRewrites).toBe(1);
    expect(reconciled.fallbackSlots).toBe(1);
    expect(reconciled.diagnostics).toEqual([
      expect.objectContaining({
        code: "missing_slot",
        slot_key: "SLOT_PREFERRED_TARIFF_MODEL_01",
      }),
    ]);
  });

  it("falls back for an invalid option set", () => {
    const reconciled = reconcileCanonicalLanguageEditorOutput({
      writerOutput,
      editedOutput: {
        survey_title: "Confianza en la automatización doméstica",
        survey_description: "Encuesta sobre decisiones energéticas del hogar",
        questions: buildEditorOutput({
          tariffOptions: [
            {
              ontology_value: "same_price",
              label: "Mismo precio",
            },
          ],
        }).questions,
      },
      targetLanguage: "Spanish",
    });

    expect(reconciled.appliedRewrites).toBe(1);
    expect(reconciled.fallbackSlots).toBe(1);
    expect(reconciled.diagnostics).toEqual([
      expect.objectContaining({
        code: "invalid_option_set",
        slot_key: "SLOT_PREFERRED_TARIFF_MODEL_01",
      }),
    ]);
  });

  it("falls back when rewrite is a noop", () => {
    const reconciled = reconcileCanonicalLanguageEditorOutput({
      writerOutput,
      editedOutput: {
        survey_title: "Confianza en la automatización doméstica",
        survey_description: "Encuesta sobre decisiones energéticas del hogar",
        questions: buildEditorOutput({
          trustDecision: "rewrite",
          trustFlags: ["unnatural_wording"],
          trustTitle: writerOutput.questions[0]!.title,
          trustScale: {
            min_label: writerOutput.questions[0]!.scale!.min_label,
            max_label: writerOutput.questions[0]!.scale!.max_label,
          },
        }).questions,
      },
      targetLanguage: "Spanish",
    });

    expect(reconciled.appliedRewrites).toBe(1);
    expect(reconciled.fallbackSlots).toBe(1);
    expect(reconciled.output.questions[0]).toEqual(writerOutput.questions[0]);
    expect(reconciled.diagnostics).toEqual([
      expect.objectContaining({
        code: "rewrite_noop",
        slot_key: "SLOT_TRUST_IN_AUTOMATION_01",
      }),
    ]);
  });

  it("falls back when keep modifies visible copy", () => {
    const reconciled = reconcileCanonicalLanguageEditorOutput({
      writerOutput,
      editedOutput: {
        survey_title: "Confianza en la automatización doméstica",
        survey_description: "Encuesta sobre decisiones energéticas del hogar",
        questions: buildEditorOutput({
          trustDecision: "keep",
          trustFlags: ["none"],
        }).questions,
      },
      targetLanguage: "Spanish",
    });

    expect(reconciled.diagnostics).toEqual([
      expect.objectContaining({
        code: "keep_modified_copy",
        slot_key: "SLOT_TRUST_IN_AUTOMATION_01",
      }),
    ]);
  });

  it("falls back when decision and flags are inconsistent", () => {
    const reconciled = reconcileCanonicalLanguageEditorOutput({
      writerOutput,
      editedOutput: {
        survey_title: "Confianza en la automatización doméstica",
        survey_description: "Encuesta sobre decisiones energéticas del hogar",
        questions: buildEditorOutput({
          trustFlags: ["none", "grammar"],
        }).questions,
      },
      targetLanguage: "Spanish",
    });

    expect(reconciled.diagnostics).toEqual([
      expect.objectContaining({
        code: "invalid_decision_flags",
        slot_key: "SLOT_TRUST_IN_AUTOMATION_01",
      }),
    ]);
  });

  it("ignores unknown slots and keeps valid rewrites", () => {
    const reconciled = reconcileCanonicalLanguageEditorOutput({
      writerOutput,
      editedOutput: {
        survey_title: "Confianza en la automatización doméstica",
        survey_description: "Encuesta sobre decisiones energéticas del hogar",
        questions: [
          ...buildEditorOutput().questions,
          {
            slot_key: "SLOT_UNKNOWN_01",
            decision: "rewrite",
            quality_flags: ["grammar"],
            title: "Texto desconocido",
            description: "",
            options: [],
            scale: null,
          },
        ],
      },
      targetLanguage: "Spanish",
    });

    expect(reconciled.appliedRewrites).toBe(2);
    expect(reconciled.diagnostics).toEqual([
      expect.objectContaining({
        code: "unknown_slot",
        slot_key: "SLOT_UNKNOWN_01",
      }),
    ]);
  });

  it("falls back when scale is incompatible but still applies other rewrites", () => {
    const reconciled = reconcileCanonicalLanguageEditorOutput({
      writerOutput,
      editedOutput: {
        survey_title: "Confianza en la automatización doméstica",
        survey_description: "Encuesta sobre decisiones energéticas del hogar",
        questions: buildEditorOutput({
          tariffOptions: writerOutput.questions[1]!.options.map((option) => ({
            ontology_value: option.ontology_value,
            label: option.label,
          })),
        }).questions.map((question) =>
          question.slot_key === "SLOT_PREFERRED_TARIFF_MODEL_01"
            ? {
                ...question,
                scale: {
                  min_label: "Bajo",
                  max_label: "Alto",
                },
              }
            : question,
        ),
      },
      targetLanguage: "Spanish",
    });

    expect(reconciled.appliedRewrites).toBe(1);
    expect(reconciled.fallbackSlots).toBe(1);
    expect(reconciled.diagnostics).toEqual([
      expect.objectContaining({
        code: "invalid_scale",
        slot_key: "SLOT_PREFERRED_TARIFF_MODEL_01",
      }),
    ]);
  });

  it("keeps writer-level header copy when the editor returns blanks", () => {
    const reconciled = reconcileCanonicalLanguageEditorOutput({
      writerOutput,
      editedOutput: {
        ...buildEditorOutput(),
        survey_title: "   ",
        survey_description: "",
      },
      targetLanguage: "Spanish",
    });

    expect(reconciled.output.survey_title).toBe(writerOutput.survey_title);
    expect(reconciled.output.survey_description).toBe(
      writerOutput.survey_description,
    );
  });

  it("accepts locked DFC slots when the writer blueprint is expanded", () => {
    const writerBlueprint =
      mergeDeclaredFlexibilityCapabilityWriterBlueprint(plannerBlueprint);

    const prompt = buildCanonicalLanguageEditorPrompt({
      defaultLanguage: "Spanish",
      writerBlueprint,
      writerOutput: {
        ...writerOutput,
        questions: [
          ...writerOutput.questions,
          {
            slot_key: DFC_INVENTORY_SLOT_KEY,
            title: "¿Qué equipos tiene disponibles en casa?",
            description: "",
            ontology_target: "flexpulse_behavioural_schema.owned_der_assets",
            type: "multiple_choice",
            options: [
              {
                label: "Batería doméstica",
                ontology_value: "battery_storage",
                is_truthy: true,
              },
            ],
            scale: null,
            numeric: null,
          },
        ],
      },
    });

    expect(prompt.user).toContain(`"slot_key": "${DFC_INVENTORY_SLOT_KEY}"`);
    expect(prompt.user).toContain('"facet": "asset_inventory"');
  });
});
