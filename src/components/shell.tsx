"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { deconnecter } from "@/app/actions";
import type { NavItem } from "@/lib/nav";

export function Shell({
  org,
  userName,
  roleLabel,
  items,
  children,
}: {
  org: string;
  userName: string;
  roleLabel: string;
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  let lastGroup = "";
  return (
    <div className={open ? "app nav-open" : "app"}>
      <aside className="sidebar">
        <div className="brand">
          <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#f3ecdf" />
            <path d="M16 34c7-14 22-18 32-8 4 5 2 13-5 16-8 4-17 1-23-2 7 2 15 1 19-4-8 7-19 6-23-2z" fill="#14352b" />
          </svg>
          <div>
            <strong>Cauris</strong>
            <span>{org}</span>
          </div>
        </div>
        <nav>
          {items.map((item) => {
            const group = item.group && item.group !== lastGroup ? item.group : "";
            if (item.group) lastGroup = item.group;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <div key={item.href}>
                {group ? <div className="nav-group">{group}</div> : null}
                <Link className={active ? "nav-link active" : "nav-link"} href={item.href} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <strong>{userName}</strong>
          <br />
          <small>{roleLabel}</small>
          <form action={deconnecter}>
            <button className="secondary" type="submit">Se déconnecter</button>
          </form>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <button className="burger" type="button" onClick={() => setOpen((value) => !value)}>Menu</button>
          <strong>Cauris</strong>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
