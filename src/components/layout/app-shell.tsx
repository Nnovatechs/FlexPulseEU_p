import Link from "next/link";
import { ReactNode } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { signOutAction } from "@/lib/auth/actions";
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
            <Link href={appRoutes.dashboard} className="brand-mark" aria-label="FlexPulse-EU">
              <BrandLogo size={40} priority />
              <span className="brand-mark__title">FlexPulse-EU</span>
            </Link>
          </div>
          <div className="topbar__controls">
            <div className="user-chip">
              <div className="user-chip__avatar">{userName.slice(0, 1)}</div>
              <div>
                <strong>{userName}</strong>
                <p>{userEmail}</p>
              </div>
            </div>

            <form action={signOutAction}>
              <button type="submit" className="button button--ghost button--compact">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main className="app-shell__main">{children}</main>
      </div>
    </div>
  );
}
