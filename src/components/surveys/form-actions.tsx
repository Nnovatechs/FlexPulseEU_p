"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

const GENERATE_STEPS = [
  "Analyzing selected concepts...",
  "Establishing measurement strategy...",
  "Generating survey structure...",
  "Building ontology mappings...",
  "Validating output...",
];

function GenerateOverlay() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, GENERATE_STEPS.length - 1));
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="generate-overlay" role="status" aria-live="polite">
      <div className="generate-overlay__card">
        <div className="generate-overlay__spinner" aria-hidden="true" />
        <p className="generate-overlay__title">Generating survey</p>
        <p className="generate-overlay__step">{GENERATE_STEPS[stepIndex]}</p>
      </div>
    </div>
  );
}

type FormActionsInnerProps = {
  initialHasTargets: boolean;
};

function FormActionsInner({ initialHasTargets }: FormActionsInnerProps) {
  const { pending } = useFormStatus();
  const [hasTargets, setHasTargets] = useState(initialHasTargets);
  const [lastIntent, setLastIntent] = useState<"save" | "generate" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const showOverlay = pending && lastIntent === "generate";

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;

    function handleChange() {
      const checked = form!.querySelectorAll(
        'input[name="ontologyTargets"]:checked',
      );
      setHasTargets(checked.length > 0);
    }

    form.addEventListener("change", handleChange);
    return () => form.removeEventListener("change", handleChange);
  }, []);

  return (
    <div ref={ref} className="form-actions">
      {showOverlay && <GenerateOverlay />}

      <div className="form-actions__primary">
        <button
          type="submit"
          name="intent"
          value="generate"
          className="button button--primary"
          disabled={!hasTargets || pending}
          onClick={() => setLastIntent("generate")}
          title={
            hasTargets
              ? "Save settings and generate survey questions"
              : "Select at least one concept to generate"
          }
        >
          Save and generate
        </button>
        <button
          type="submit"
          name="intent"
          value="save"
          className="button button--secondary"
          disabled={pending}
          onClick={() => setLastIntent("save")}
        >
          Save
        </button>
      </div>

      {!hasTargets && (
        <span className="form-actions__hint muted">
          Select concepts to enable generation
        </span>
      )}
    </div>
  );
}

type FormActionsProps = {
  initialHasTargets: boolean;
};

export function FormActions({ initialHasTargets }: FormActionsProps) {
  return <FormActionsInner initialHasTargets={initialHasTargets} />;
}
