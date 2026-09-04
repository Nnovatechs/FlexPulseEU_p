"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  activateSurveyAudienceLinkAction,
  createSurveyAudienceLinkAction,
  deactivateSurveyAudienceLinkAction,
} from "@/features/surveys/audience-link-actions";
import type { PersistedSurveyLink } from "@/features/surveys/generator-types";
import { appRoutes } from "@/lib/config/routes";

type AudienceLinksCardProps = {
  surveyId: string;
  surveyStatus: "Draft" | "Published" | "Archived";
  links: PersistedSurveyLink[];
};

function buildPublicUrl(origin: string | null, linkToken: string) {
  const path = appRoutes.publicSurveyLink(linkToken);
  return origin ? `${origin}${path}` : path;
}

export function AudienceLinksCard({
  surveyId,
  surveyStatus,
  links,
}: AudienceLinksCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [audienceLabel, setAudienceLabel] = useState("");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => null,
  );

  const readOnly = surveyStatus !== "Published";

  async function handleCopy(linkToken: string) {
    const publicUrl = buildPublicUrl(origin, linkToken);
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyMessage("Audience link copied.");
    } catch {
      setCopyMessage("Copy failed. Please copy the URL manually.");
    }
  }

  function handleCreate() {
    setCopyMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("surveyId", surveyId);
        formData.set("audienceLabel", audienceLabel);
        await createSurveyAudienceLinkAction(formData);
        setAudienceLabel("");
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to create audience link.",
        );
      }
    });
  }

  function handleToggle(linkId: string, isActive: boolean) {
    setCopyMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("surveyId", surveyId);
        formData.set("surveyLinkId", linkId);
        if (isActive) {
          await deactivateSurveyAudienceLinkAction(formData);
        } else {
          await activateSurveyAudienceLinkAction(formData);
        }
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to update audience link.",
        );
      }
    });
  }

  return (
    <article className="surface-card stack-form">
      <div>
        <h2>Audience links</h2>
        <p className="muted">
          Create additional public URLs for different audiences while keeping the same published
          survey, pipeline and analytics runtime.
        </p>
      </div>

      <label className="audience-links-card__toggle" aria-expanded={isExpanded}>
        <span className="audience-links-card__toggle-text">
          <strong>Activate</strong>
          <span className="muted">
            {readOnly
              ? "Review existing audience URLs."
              : "Reveal and manage additional audience URLs."}
          </span>
        </span>
        <span className="preview-tab__toggle-button-switch-wrapper">
          <input
            type="checkbox"
            checked={isExpanded}
            onChange={(event) => setIsExpanded(event.target.checked)}
            aria-label="Activate audience links"
          />
          <span
            className={`preview-tab__toggle-button-switch ${
              isExpanded ? "preview-tab__toggle-button-switch--on" : ""
            }`}
            aria-hidden="true"
          >
            <span className="preview-tab__toggle-button-knob" />
          </span>
        </span>
      </label>

      {isExpanded ? (
        <>
          <div className="notice notice--info">
            Use a non-identifying internal code. Do not enter addresses, building names, household
            names or resident details. Keep the correspondence between this code and the real
            audience in your own system.
          </div>

          {surveyStatus === "Archived" ? (
            <div className="notice notice--warning">
              Archived surveys are read-only. Audience links can still be reviewed here, but they
              cannot be changed.
            </div>
          ) : null}

          {copyMessage ? <p className="muted">{copyMessage}</p> : null}
          {errorMessage ? (
            <div className="notice notice--warning" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <div className="stack-list">
            {links.map((link) => {
              const publicUrl = buildPublicUrl(origin, link.link_token);
              const isDefault = link.audience_token === "default";
              return (
                <article key={link.id} className="audience-link-row">
                  <div className="audience-link-row__main">
                    <div className="audience-link-row__identity">
                      <h3>{link.audience_label}</h3>
                      <p className="muted">{publicUrl}</p>
                    </div>
                    <div className="audience-link-row__badges">
                      {isDefault ? <span className="badge">Default</span> : null}
                      <span className={`badge ${link.is_active ? "is-success" : "is-muted"}`}>
                        {link.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <div className="audience-link-row__actions">
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => handleCopy(link.link_token)}
                    >
                      Copy URL
                    </button>
                    <Link
                      href={publicUrl}
                      className="button button--secondary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open
                    </Link>
                    {!isDefault && !readOnly ? (
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => handleToggle(link.id, link.is_active)}
                        disabled={isPending}
                      >
                        {link.is_active ? "Deactivate" : "Activate"}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          {!readOnly ? (
            <div className="audience-link-create">
              <label className="field audience-link-create__field">
                <span>Audience label</span>
                <input
                  value={audienceLabel}
                  onChange={(event) => setAudienceLabel(event.target.value)}
                  placeholder="Pilot cohort A"
                  maxLength={80}
                  disabled={isPending}
                />
              </label>
              <button
                type="button"
                className="button button--primary"
                onClick={handleCreate}
                disabled={isPending || !audienceLabel.trim()}
              >
                {isPending ? "Creating…" : "Create link"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
