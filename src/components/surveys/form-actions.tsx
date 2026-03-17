"use client";

import { useEffect, useRef, useState } from "react";

type FormActionsProps = {
  initialHasTargets: boolean;
};

export function FormActions({ initialHasTargets }: FormActionsProps) {
  const [hasTargets, setHasTargets] = useState(initialHasTargets);
  const ref = useRef<HTMLDivElement>(null);

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
      <div className="form-actions__primary">
        <button
          type="submit"
          name="intent"
          value="generate"
          className="button button--primary"
          disabled={!hasTargets}
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
