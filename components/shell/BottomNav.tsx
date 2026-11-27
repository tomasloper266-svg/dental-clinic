"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { Drawer } from "@/components/ui/Drawer";
import {
  mobileBarNav,
  navGroups,
  badgeTotal,
  type BadgeKey,
  type NavGroup,
} from "./nav-items";

/**
 * زر درج «المزيد» — يحمل نقطة تنبيه حمراء عند وجود شارات قائمة،
 * نظير عدّاد جرس الشريط العلوي فلا تختفي التنبيهات على الموبايل.
 */
function MoreButton({
  active,
  expanded,
  total,
  onOpen,
}: {
  active: boolean;
  /** حالة الدرج الفعلية — لسمة aria-expanded لا للتنشيط البصري */
  expanded: boolean;
  total: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-expanded={expanded}
      aria-label={total > 0 ? `المزيد — لديك ${total} تنبيه` : "المزيد"}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 rounded-field px-2 py-1 text-[11px] transition-colors",
        active
          ? "bg-primary-50 font-semibold text-primary-700"
          : "text-warm-500 hover:text-ink-900",
      )}
    >
      <span className="relative">
        <MoreHorizontal size={20} aria-hidden />
        {total > 0 && (
          <span
            aria-hidden
            className="absolute -end-1 -top-0.5 size-2 rounded-full bg-danger-500"
          />
        )}
      </span>
      المزيد
    </button>
  );
}

type BottomNavProps = {
  badges: Record<BadgeKey, number>;
};

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/** أيقونة شارة الشاشة الصغيرة — نقطة تحذير فقط في الشريط، والرقم في الدرج */
function BarEntry({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: NavGroup["items"][number]["icon"];
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 rounded-field px-2 py-1 text-[11px] transition-colors",
        active
          ? "bg-primary-50 font-semibold text-primary-700"
          : "text-warm-500 hover:text-ink-900",
      )}
    >
      <Icon size={20} aria-hidden />
      {label}
    </Link>
  );
}

/** عنصر درج «المزيد» — شارة رقمية مطابقة لشارة السايدبار */
function DrawerEntry({
  href,
  label,
  icon: Icon,
  active,
  count,
  badgeKey,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: NavGroup["items"][number]["icon"];
  active: boolean;
  count?: number;
  badgeKey?: BadgeKey;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-field px-3 py-2.5 text-sm",
        active
          ? "bg-primary-50 font-semibold text-primary-700"
          : "text-ink-900 hover:bg-surface-hover",
      )}
    >
      <Icon size={20} aria-hidden />
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "numeric rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
            badgeKey === "lowStock"
              ? "bg-warning-300 text-warning-900"
              : "bg-primary-200 text-primary-800",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

/**
 * تنقل الموبايل السفلي: الرئيسية والمرضى (بحث المرضى) والمواعيد مباشرة،
 * ودرج «المزيد» يجمع بقية الأقسام بنفس تجميع السايدبار وشاراته الرقمية.
 */
export function BottomNav({ badges }: BottomNavProps) {
  const pathname = usePathname() ?? "/";
  const [moreOpen, setMoreOpen] = useState(false);
  const barActive = (href: string) => isItemActive(pathname, href);
  const moreActive = navGroups.some((group) =>
    group.items.some((item) => isItemActive(pathname, item.href)),
  );

  return (
    <>
      <nav
        aria-label="تنقل الموبايل"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-warm-200 bg-surface-raised px-2 shadow-sm md:hidden"
      >
        {mobileBarNav.map((item) => (
          <BarEntry
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={barActive(item.href)}
          />
        ))}
        <MoreButton
          active={moreActive}
          expanded={moreOpen}
          total={badgeTotal(badges)}
          onOpen={() => setMoreOpen(true)}
        />
      </nav>

      <Drawer open={moreOpen} onClose={() => setMoreOpen(false)} title="المزيد">
        <ul className="flex flex-col gap-2">
          {navGroups.map((group) => {
            const groupActive = group.items.some((item) =>
              isItemActive(pathname, item.href),
            );
            return (
              <li key={group.key}>
                <p
                  className={cn(
                    "px-3 pb-1 pt-2 text-[11px] font-semibold",
                    groupActive ? "text-primary-700" : "text-warm-500",
                  )}
                >
                  {group.label}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <DrawerEntry
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        active={isItemActive(pathname, item.href)}
                        count={item.badge ? badges[item.badge] : undefined}
                        badgeKey={item.badge}
                        onNavigate={() => setMoreOpen(false)}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </Drawer>
    </>
  );
}
