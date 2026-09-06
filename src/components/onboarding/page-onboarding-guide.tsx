"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { OnboardingGuideContent } from "./guides";

type PageOnboardingGuideProps = OnboardingGuideContent & {
  theme?: "standard" | "analytics";
};

export function PageOnboardingGuide({
  ariaLabel,
  title,
  intro,
  sections,
  theme = "standard",
}: PageOnboardingGuideProps) {
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = triggerRef.current;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  const overlay = open ? (
    <div
      className={`page-onboarding-guide__overlay${
        theme === "analytics" ? " page-onboarding-guide__overlay--analytics" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => setOpen(false)}
    >
      <div
        className="page-onboarding-guide__card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="page-onboarding-guide__header">
          <h2 id={titleId} className="page-onboarding-guide__title">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="page-onboarding-guide__icon-close"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        <div className="page-onboarding-guide__body">
          <p className="page-onboarding-guide__intro">{intro}</p>
          {sections.map((section) => (
            <section key={section.title} className="page-onboarding-guide__section">
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
        <div className="page-onboarding-guide__actions">
          <button
            type="button"
            className="page-onboarding-guide__close"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`page-onboarding-guide__trigger${
          theme === "analytics" ? " page-onboarding-guide__trigger--analytics" : ""
        }`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        i
      </button>
      {overlay
        ? typeof document === "undefined"
          ? overlay
          : createPortal(overlay, document.body)
        : null}
    </>
  );
}
