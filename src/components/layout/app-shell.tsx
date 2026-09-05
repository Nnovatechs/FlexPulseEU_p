import { ReactNode } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { UserMenu } from "@/components/layout/user-menu";
import { PendingNavLink } from "@/components/pending-nav-link";
import { appRoutes } from "@/lib/config/routes";

type AppShellProps = {
  userName: string;
  userEmail: string;
  children: ReactNode;
};

export function AppShell({ userName, userEmail, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="app-shell__content">
        <header className="topbar">
          <div className="topbar__brand">
            <PendingNavLink href={appRoutes.dashboard} className="brand-mark" aria-label="FlexPulse-EU">
              <BrandLogo size={40} priority />
              <span className="brand-mark__title">FlexPulse-EU</span>
            </PendingNavLink>
          </div>
          <div className="topbar__controls">
            <UserMenu userName={userName} userEmail={userEmail} />
          </div>
        </header>

        <main className="app-shell__main">{children}</main>
      </div>
    </div>
  );
}
