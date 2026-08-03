"use client";

import { useState, useTransition } from "react";
import { duplicateSurveyAction } from "@/features/surveys/actions";
import { rethrowNextNavigationError } from "@/lib/navigation/errors";

type SurveyDuplicateActionProps = {
  surveyId: string;
  label?: string;
  className?: string;
};

export function SurveyDuplicateAction({
  surveyId,
  label = "Duplicate",
  className = "button button--ghost",
}: SurveyDuplicateActionProps) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  function handleClick() {
    const formData = new FormData();
    formData.set("surveyId", surveyId);
    setActionError(null);

    startTransition(async () => {
      try {
        await duplicateSurveyAction(formData);
      } catch (err) {
        rethrowNextNavigationError(err);
        setActionError(
          err instanceof Error ? err.message : "Duplication failed. Please try again.",
        );
      }
    });
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={isPending}
      aria-label={actionError ? `${label}: ${actionError}` : label}
      title={actionError ?? label}
    >
      {isPending ? "Duplicating…" : label}
    </button>
  );
}
