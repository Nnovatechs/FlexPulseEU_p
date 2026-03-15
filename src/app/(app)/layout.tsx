import { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireCurrentSession } from "@/lib/auth/session";

type AppLayoutProps = {
  children: ReactNode;
};

export default async function ProtectedAppLayout({ children }: AppLayoutProps) {
  const session = await requireCurrentSession();

  return (
    <AppShell userName={session.name} userEmail={session.email}>
      {children}
    </AppShell>
  );
}
