"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MouseEvent, ReactNode, useTransition } from "react";
import { PendingViewOverlay } from "@/components/pending-view-overlay";
import {
  getPendingNavigationCopy,
  type PendingNavigationCopy,
} from "@/lib/navigation/pending-navigation";

type PendingNavLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  title?: string;
  description?: string;
  "aria-label"?: string;
};

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  );
}

export function PendingNavLink({
  href,
  className,
  children,
  title,
  description,
  "aria-label": ariaLabel,
}: PendingNavLinkProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inferred = getPendingNavigationCopy(href);
  const copy: PendingNavigationCopy | null = title
    ? { title, description: description ?? inferred?.description ?? "" }
    : inferred;

  if (!copy) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <>
      <PendingViewOverlay
        pending={pending}
        title={copy.title}
        description={copy.description || undefined}
      />
      <Link
        href={href}
        className={className}
        aria-label={ariaLabel}
        onClick={(event) => {
          if (isModifiedClick(event)) {
            return;
          }

          event.preventDefault();
          startTransition(() => {
            router.push(href);
          });
        }}
      >
        {children}
      </Link>
    </>
  );
}
