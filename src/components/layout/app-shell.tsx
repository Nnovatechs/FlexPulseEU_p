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
            <details className="user-menu">
              <summary className="user-chip">
                <div className="user-chip__avatar">{userName.slice(0, 1)}</div>
                <div className="user-chip__identity">
                  <strong>{userName}</strong>
                  <p>{userEmail}</p>
                </div>
                <span className="user-menu__chevron" aria-hidden="true">
                  ▾
                </span>
              </summary>

              <div className="user-menu__popover">
                <Link href={appRoutes.updatePassword} className="user-menu__item">
                  Change password
                </Link>
                <form action={signOutAction}>
                  <button type="submit" className="user-menu__item">
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>

        <main className="app-shell__main">{children}</main>
      </div>
    </div>
  );
}
