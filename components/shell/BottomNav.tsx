"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { Drawer } from "@/components/ui/Drawer";
import { primaryNav, secondaryNav, type BadgeKey, type NavItem } from "./nav-items";

type BottomNavProps = {
  badges: Record<BadgeKey, number>;
};

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function MobileEntry({ item, active, count }: {
  item: NavItem;
  active: boolean;
  count?: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-field px-2 py-1 text-[11px] transition-colors",
        active
          ? "bg-primary-50 font-semibold text-primary-700"
          : "text-warm-500 hover:text-ink-900",
      )}
    >
      <span className="relative">
        <Icon size={20} aria-hidden />
        {count !== undefined && count > 0 && (
          <span
            aria-hidden
            className="absolute -top-1 -end-1.5 size-2 rounded-full bg-warning-300"
          />
        )}
      </span>
      {item.label}
    </Link>
  );
}

/** تنقل الموبايل السفلي: 4 أوامر أساسية + شريحة «المزيد» لبقية الأقسام */
export function BottomNav({ badges }: BottomNavProps) {
  const pathname = usePathname() ?? "/";
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = secondaryNav.some((item) => isItemActive(pathname, item.href));

  return (
    <>
      <nav
        aria-label="تنقل الموبايل"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-warm-200 bg-surface-raised md:hidden"
      >
        {primaryNav.map((item) => (
          <MobileEntry
            key={item.href}
            item={item}
            active={isItemActive(pathname, item.href)}
            count={item.badge ? badges[item.badge] : undefined}
          />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-field px-2 py-1 text-[11px] transition-colors",
            moreActive
              ? "bg-primary-50 font-semibold text-primary-700"
              : "text-warm-500 hover:text-ink-900",
          )}
        >
          <MoreHorizontal size={20} aria-hidden />
          المزيد
        </button>
      </nav>

      <Drawer open={moreOpen} onClose={() => setMoreOpen(false)} title="المزيد">
        <ul className="flex flex-col gap-1">
          {secondaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={isItemActive(pathname, item.href) ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-field px-3 py-2.5 text-sm",
                    isItemActive(pathname, item.href)
                      ? "bg-primary-50 font-semibold text-primary-700"
                      : "text-ink-900 hover:bg-surface-hover",
                  )}
                >
                  <Icon size={20} aria-hidden />
                  {item.label}
                  {item.badge && badges[item.badge] > 0 && (
                    <span className="numeric ms-auto rounded-full bg-warning-300 px-1.5 py-0.5 text-[11px] font-semibold text-warning-900">
                      {badges[item.badge]}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </Drawer>
    </>
  );
}
