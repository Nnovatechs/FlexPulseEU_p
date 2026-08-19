"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  connectProlificIntegrationAction,
  disconnectProlificIntegrationAction,
} from "@/features/surveys/integrations/actions";
import type { ProlificIntegrationSummary } from "@/features/surveys/integrations/types";

type PublicLinkProlificCardProps = {
  surveyId: string;
  surveyLinkId: string;
  publicLinkUrl: string;
  integration: ProlificIntegrationSummary | null;
};

export function PublicLinkProlificCard({
  surveyId,
  surveyLinkId,
  publicLinkUrl,
  integration,
}: PublicLinkProlificCardProps) {
  const router = useRouter();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [studyId, setStudyId] = useState(integration?.studyId ?? "");
  const [completionUrl, setCompletionUrl] = useState(integration?.completionUrl ?? "");

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(publicLinkUrl);
      setCopyMessage("Public link copied.");
    } catch {
      setCopyMessage("Copy failed. Please copy the link manually.");
    }
  }

  function handleConnect() {
    setSaveError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("surveyId", surveyId);
        formData.set("surveyLinkId", surveyLinkId);
        formData.set("studyId", studyId);
        formData.set("completionUrl", completionUrl);
        await connectProlificIntegrationAction(formData);
        setIsPanelOpen(false);
        router.refresh();
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : "Failed to save Prolific integration.",
        );
      }
    });
  }

  function handleDisconnect() {
    setSaveError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("surveyId", surveyId);
        formData.set("surveyLinkId", surveyLinkId);
        await disconnectProlificIntegrationAction(formData);
        router.refresh();
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? error.message
            : "Failed to deactivate Prolific integration.",
        );
      }
    });
  }

  return (
    <article className="surface-card">
      <h2>Public default link</h2>
      <div className="stack-list">
        <div className="analytics-row">
          <strong>URL</strong>
          <span>{publicLinkUrl}</span>
        </div>
        {integration ? (
          <>
            <div className="analytics-row">
              <strong>Prolific</strong>
              <span>{integration.isActive ? "Connected" : "Inactive"}</span>
            </div>
            <div className="analytics-row">
              <strong>Study ID</strong>
              <span>{integration.studyId}</span>
            </div>
            <div className="analytics-row">
              <strong>Completion code</strong>
              <span>{integration.completionCode}</span>
            </div>
          </>
        ) : (
          <p className="muted">
            No Prolific integration is connected to this public link.
          </p>
        )}
      </div>

      <div className="button-row">
        <button type="button" className="button button--ghost" onClick={handleCopyLink}>
          Copy link
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            setSaveError(null);
            setIsPanelOpen((value) => !value);
          }}
        >
          {integration ? "Update Prolific" : "Connect Prolific"}
        </button>
        {integration ? (
          <button
            type="button"
            className="button button--ghost"
            onClick={handleDisconnect}
            disabled={isPending}
          >
            {isPending ? "Saving…" : "Disconnect"}
          </button>
        ) : null}
      </div>

      {copyMessage ? <p className="muted">{copyMessage}</p> : null}
      {saveError ? (
        <div className="notice notice--warning" role="alert">
          {saveError}
        </div>
      ) : null}

      {isPanelOpen ? (
        <div className="stack-list">
          <p className="muted">
            Supported Prolific mode: standard URL parameters only. Do not enable
            Secure external URL / JWT mode for this integration.
          </p>
          <label className="field">
            <span>Prolific Study ID</span>
            <input
              value={studyId}
              onChange={(event) => setStudyId(event.target.value)}
              disabled={isPending}
            />
          </label>
          <label className="field">
            <span>Prolific Completion URL</span>
            <input
              value={completionUrl}
              onChange={(event) => setCompletionUrl(event.target.value)}
              disabled={isPending}
            />
          </label>
          <div className="button-row">
            <button
              type="button"
              className="button button--primary"
              onClick={handleConnect}
              disabled={isPending}
            >
              {isPending ? "Saving…" : integration ? "Save changes" : "Connect"}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                setSaveError(null);
                setIsPanelOpen(false);
                setStudyId(integration?.studyId ?? "");
                setCompletionUrl(integration?.completionUrl ?? "");
              }}
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
