"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { cn } from "@/components/ui/cn";
import { navGroups, homeNav, type BadgeKey, type NavGroup } from "./nav-items";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  userName: string;
  badges: Record<BadgeKey, number>;
};

const SYSTEM_NAME = "عيادات الأسنان";

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/** رابط تنقل — تحديد الصفحة الحالية بخلفية فاتحة وحد جانبي بلون التفاعل */
function NavEntry({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  count,
  badgeKey,
}: {
  href: string;
  label: string;
  icon: NavItemIcon;
  active: boolean;
  collapsed: boolean;
  count?: number;
  badgeKey?: BadgeKey;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-field border-s-2 px-3 py-2 text-sm transition-colors",
        active
          ? "border-s-primary-300 bg-white/95 font-semibold text-primary-900 shadow-xs"
          : "border-s-transparent text-primary-50/80 hover:bg-white/10 hover:text-white",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon size={20} className="shrink-0" aria-hidden />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && count !== undefined && count > 0 && (
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
      {collapsed && count !== undefined && count > 0 && (
        <span
          aria-hidden
          className="absolute start-1 top-1.5 size-2 rounded-full bg-warning-300"
        />
      )}
    </Link>
  );
}

type NavItemIcon = NavGroup["items"][number]["icon"];

/** مجموعة تنقل بعنوان صغير — تُطوى إلى فاصل في الوضع المطوي */
function NavSection({
  group,
  pathname,
  collapsed,
  badges,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  badges: Record<BadgeKey, number>;
}) {
  return (
    <li className="mt-3 first:mt-1">
      {!collapsed && (
        <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-primary-200/70">
          {group.label}
        </p>
      )}
      {collapsed && (
        <div
          className="mx-auto mb-2 h-px w-8 bg-white/15"
          aria-hidden
          role="presentation"
        />
      )}
      <ul className="flex flex-col gap-0.5">
        {group.items.map((item) => (
          <li key={item.href}>
            <NavEntry
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isItemActive(pathname, item.href)}
              collapsed={collapsed}
              count={item.badge ? badges[item.badge] : undefined}
              badgeKey={item.badge}
            />
          </li>
        ))}
      </ul>
    </li>
  );
}

/** السايدبار الأخضر الطبي العميق القابل للطي — أيقونة+عنوان ⇄ أيقونة فقط */
export function Sidebar({ collapsed, onToggle, userName, badges }: SidebarProps) {
  const pathname = usePathname() ?? "/dashboard";
  const ToggleIcon = collapsed ? PanelRightOpen : PanelRightClose;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 start-0 z-40 hidden flex-col bg-primary-900 transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center gap-2 border-b border-white/10 px-3",
          collapsed && "justify-center px-0",
        )}
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-field bg-primary-500 text-sm font-bold text-white shadow-xs"
        >
          س
        </span>
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-white">
            {SYSTEM_NAME}
          </span>
        )}
      </div>

      <nav aria-label="التنقل الرئيسي" className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-0.5">
          <li>
            <NavEntry
              href={homeNav.href}
              label={homeNav.label}
              icon={homeNav.icon}
              active={isItemActive(pathname, homeNav.href)}
              collapsed={collapsed}
            />
          </li>
          {navGroups.map((group) => (
            <NavSection
              key={group.key}
              group={group}
              pathname={pathname}
              collapsed={collapsed}
              badges={badges}
            />
          ))}
        </ul>
      </nav>

      <div
        className={cn(
          "flex flex-col gap-2 border-t border-white/10 p-3",
          collapsed && "items-center",
        )}
      >
        {!collapsed && (
          <span className="truncate text-xs text-primary-100/70">
            {userName}
          </span>
        )}
        <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
          <LogoutButton
            className={cn(
              "flex-1 rounded-field border border-white/20 text-primary-50 hover:bg-white/10",
              collapsed && "w-full",
            )}
          />
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
            className="rounded-field p-2 text-primary-50/80 hover:bg-white/10 hover:text-white"
          >
            <ToggleIcon size={20} aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}
