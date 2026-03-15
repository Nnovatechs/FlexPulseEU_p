import { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getMockSession } from "@/lib/auth/session";

type AppLayoutProps = {
  children: ReactNode;
};

export default async function ProtectedAppLayout({ children }: AppLayoutProps) {
  const session = await getMockSession();

  return (
    <AppShell userName={session.name} userRole={session.role}>
      {children}
    </AppShell>
  );
}
