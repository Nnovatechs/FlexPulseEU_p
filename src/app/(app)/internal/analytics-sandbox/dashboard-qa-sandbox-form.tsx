"use client";

import { useFormStatus } from "react-dom";

function PendingSubmitButton({
  idleLabel,
  pendingLabel,
}: {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button button--primary" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

export function DashboardQaSandboxForm({
  action,
  idleLabel,
  pendingLabel,
}: {
  action: () => Promise<void>;
  idleLabel: string;
  pendingLabel: string;
}) {
  return (
    <form action={action}>
      <PendingSubmitButton idleLabel={idleLabel} pendingLabel={pendingLabel} />
    </form>
  );
}
