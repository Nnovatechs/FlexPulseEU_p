import Link from "next/link";
import { ReactNode } from "react";
import { signOutAction } from "@/lib/auth/actions";
import { appRoutes } from "@/lib/config/routes";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  {
    href: appRoutes.dashboard,
    label: "Surveys",
  },
  {
    href: appRoutes.surveys,
    label: "Library",
  },
  {
    href: appRoutes.surveyNew,
    label: "New survey",
  },
];

type AppShellProps = {
  userName: string;
  userEmail: string;
  children: ReactNode;
};

export function AppShell({ userName, userEmail, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="brand-badge">FP</div>
          <div>
            <p className="sidebar__eyebrow">FlexPulseEU</p>
            <h1>Research surveys</h1>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="app-shell__content">
        <header className="topbar">
          <div>
            <p className="topbar__eyebrow">Workspace</p>
            <h2>Survey management</h2>
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
