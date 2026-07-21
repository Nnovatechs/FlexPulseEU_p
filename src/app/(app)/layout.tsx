import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { isTermsAcceptanceRequired } from "@/features/access/terms-config";
import { getCurrentTermsAcceptance } from "@/features/access/repository";
import { requireCurrentSession } from "@/lib/auth/session";
import { appRoutes } from "@/lib/config/routes";

type AppLayoutProps = {
  children: ReactNode;
};

export default async function ProtectedAppLayout({ children }: AppLayoutProps) {
  const session = await requireCurrentSession();
  const termsAcceptance =
    isTermsAcceptanceRequired() ? await getCurrentTermsAcceptance() : null;

  if (isTermsAcceptanceRequired() && !termsAcceptance) {
    redirect(appRoutes.terms);
  }

  return (
    <AppShell userName={session.name} userEmail={session.email}>
      {children}
    </AppShell>
  );
}
