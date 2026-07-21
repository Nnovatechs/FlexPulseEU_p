"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { signOutAction } from "@/lib/auth/actions";
import { appRoutes } from "@/lib/config/routes";

type UserMenuProps = {
  userName: string;
  userEmail: string;
};

export function UserMenu({ userName, userEmail }: UserMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      const menu = menuRef.current;

      if (menu?.open && !menu.contains(event.target as Node)) {
        menu.removeAttribute("open");
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  return (
    <details ref={menuRef} className="user-menu">
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
        <Link href={appRoutes.privacySettings} className="user-menu__item">
          Privacy Settings
        </Link>
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
  );
}
