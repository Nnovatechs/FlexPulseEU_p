"use client";

import { useTransition } from "react";
import { archiveSurveyAction, deleteSurveyDraftAction } from "@/features/surveys/actions";
import type { SurveyStatus } from "@/features/surveys/types";

type SurveyLifecycleActionProps = {
  surveyId: string;
  surveyTitle: string;
  status: SurveyStatus;
};

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M9 3h6m-7 4h8M10 11v6m4-6v6M5 7l1 13a1 1 0 001 1h10a1 1 0 001-1l1-13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M4 7.5h16M6 7.5V5.8A1.8 1.8 0 017.8 4h8.4A1.8 1.8 0 0118 5.8V7.5m-11 0v11.2A1.8 1.8 0 008.8 20.5h6.4a1.8 1.8 0 001.8-1.8V7.5M10 11.5h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SurveyLifecycleAction({
  surveyId,
  surveyTitle,
  status,
}: SurveyLifecycleActionProps) {
  const [isPending, startTransition] = useTransition();

  if (status === "Archived") {
    return null;
  }

  const isDraft = status === "Draft";
  const actionLabel = isDraft ? "Delete survey" : "Archive survey";
  const confirmMessage = isDraft
    ? `Delete "${surveyTitle}" permanently? This cannot be undone.`
    : `Archive "${surveyTitle}"? It will be hidden from the workspace, but collected responses are kept.`;

  function handleClick() {
    if (!window.confirm(confirmMessage)) {
      return;
    }

    const formData = new FormData();
    formData.set("surveyId", surveyId);

    startTransition(async () => {
      if (isDraft) {
        await deleteSurveyDraftAction(formData);
        return;
      }

      if (status === "Published") {
        await archiveSurveyAction(formData);
      }
    });
  }

  return (
    <button
      type="button"
      className={`icon-action-button${isDraft ? " icon-action-button--danger" : " icon-action-button--archive"}`}
      disabled={isPending}
      onClick={handleClick}
      aria-label={actionLabel}
      title={actionLabel}
    >
      {isDraft ? <TrashIcon /> : <ArchiveIcon />}
    </button>
  );
}
