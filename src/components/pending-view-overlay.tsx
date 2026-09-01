"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";

type PendingViewOverlayProps = {
  pending: boolean;
  title: string;
  description?: string;
};

export function PendingViewOverlay({
  pending,
  title,
  description,
}: PendingViewOverlayProps) {
  if (!pending) {
    return null;
  }

  const overlay = (
    <div
      className="pending-view-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pending-view-overlay__card">
        <div className="pending-view-overlay__spinner" aria-hidden="true" />
        <p className="pending-view-overlay__title">{title}</p>
        {description ? (
          <p className="pending-view-overlay__description">{description}</p>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return overlay;
  }

  return createPortal(overlay, document.body);
}

type FormPendingOverlayProps = {
  title: string;
  description?: string;
};

export function FormPendingOverlay({
  title,
  description,
}: FormPendingOverlayProps) {
  const { pending } = useFormStatus();

  return (
    <PendingViewOverlay
      pending={pending}
      title={title}
      description={description}
    />
  );
}

type PendingSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function PendingSubmitButton({
  children,
  disabled,
  type = "submit",
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button {...props} type={type} disabled={disabled || pending}>
      {children}
    </button>
  );
}
