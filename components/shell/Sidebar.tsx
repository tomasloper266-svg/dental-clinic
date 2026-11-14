"use client";

import { PanelRightClose, PanelRightOpen, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatDualFromSyp, DEFAULT_USD_RATE } from "@/lib/currency";
import LogoutButton from "@/components/LogoutButton";
import { cn } from "@/components/ui/cn";
import { navGroups, homeNav, type BadgeKey, type NavGroup } from "./nav-items";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  userName: string;
  /** اسم العيادة المسجل — يُعرض بصيغة «{الاسم} لطب الأسنان» مع بقاء الافتراضي عند غيابه */
  clinicName?: string;
  badges: Record<BadgeKey, number>;
  /** المستحقات غير المسددة عبر المرضى — بطاقة التنبيه المثبتة أسفل الشريط */
  outstandingDuesSyp?: number;
  /** سعر صرف الدولار — لعرض العملة المزدوجة في بطاقة التنبيه */
  usdRate?: number;
};

const SYSTEM_NAME = "عيادات الأسنان";
const SYSTEM_SUBTITLE = "نظام إدارة العيادات";

/**
 * نقي — اسم ترويسة السايدبار: «{اسم العيادة} لطب الأسنان» لما وُجد اسم
 * مسجل، والاسم الافتراضي للنظام عند غيابه (عيادات قديمة أو بيانات ناقصة).
 */
export function clinicHeaderName(clinicName?: string): string {
  const trimmed = clinicName?.trim();
  if (!trimmed) return SYSTEM_NAME;
  // الاسم المسجل قد ينتهي بلاقة اللاحق نفسها — لا تُضف مرتين
  return trimmed.endsWith("لطب الأسنان")
    ? trimmed
    : `${trimmed} لطب الأسنان`;
}

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/** رابط تنقل — العنصر النشط حبة ممتلئة بعرض كامل بلون الهوية */
function NavEntry({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  count,
}: {
  href: string;
  label: string;
  icon: NavItemIcon;
  active: boolean;
  collapsed: boolean;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "relative flex items-center gap-3 px-3.5 py-2.5 text-sm transition-colors",
        active
          ? "rounded-xl bg-primary-600 font-semibold text-white shadow-xs"
          : "rounded-xl text-primary-50/80 hover:bg-white/10 hover:text-white",
        collapsed && "justify-center px-0",
      )}
    >
      {/* شريط جانبي نشئ على شكل المرجع — يبرز من الحبة النشطة فقط */}
      {active && (
        <span
          aria-hidden
          className="absolute -start-3 top-1/2 h-[22px] w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-primary-300 to-primary-500"
        />
      )}
      <Icon size={20} className="shrink-0" aria-hidden />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && count !== undefined && count > 0 && (
        <span className="numeric grid min-w-5 place-items-center rounded-full bg-danger-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
      {collapsed && count !== undefined && count > 0 && (
        <span
          aria-hidden
          className="absolute start-1 top-1.5 size-2 rounded-full bg-danger-500"
        />
      )}
    </Link>
  );
}

type NavItemIcon = NavGroup["items"][number]["icon"];

/** مجموعة تنقل بعنوان فرعي باهت وفاصل رفيع — تُطوى إلى فاصل في الوضع المطوي */
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
    <li className="mt-1">
      {!collapsed ? (
        <>
          <p className="flex items-center gap-2.5 px-3 pb-1 text-[10px] font-bold tracking-wide text-primary-100/60">
            <span>{group.label}</span>
            <span
              aria-hidden
              className="h-px flex-1 bg-gradient-to-l from-primary-300/50 to-transparent"
            />
          </p>
        </>
      ) : (
        <div
          role="presentation"
          className="mx-auto my-2 h-px w-8 bg-white/10"
          aria-hidden
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
            />
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * بطاقة التنبيه المثبتة أسفل الشريط — تملق حمراء شفافة بأيقونة وقيمة،
 * للمستحقات غير المسددة مع رابط إلى صفحة المستحقات. تُخفى بلا مستحقات.
 */
function DuesAlertCard({
  dues,
  usdRate,
  collapsed,
}: {
  dues: number;
  usdRate: number;
  collapsed: boolean;
}) {
  if (dues <= 0) return null;
  // الوضع المطوي — البطاقة لا تتسع، فتُستبدل بنقطة حمراء (نمط شارة التنقل)
  // كي لا يختفي تنبيه المستحقات كلياً في الوضع المطوي الافتراضي.
  if (collapsed) {
    return (
      <Link
        href="/dues"
        aria-label="مستحقات غير مسددة"
        title={`مستحقات غير مسددة: ${formatDualFromSyp(dues, usdRate)}`}
        className="mx-auto grid size-8 place-items-center rounded-full border border-danger-300/40 bg-danger-500/15 transition-colors hover:bg-danger-500/25"
      >
        <span
          aria-hidden
          className="size-2.5 rounded-full bg-danger-400"
        />
      </Link>
    );
  }
  return (
    <Link
      href="/dues"
      className={cn(
        "block rounded-field border border-danger-300/40 bg-danger-500/10 px-3 py-2.5 transition-colors hover:bg-danger-500/20",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-300",
      )}
    >
      <p className="flex items-center gap-2 text-xs font-semibold text-danger-100">
        <Wallet size={14} aria-hidden className="shrink-0" />
        مستحقات غير مسددة
      </p>
      <p className="numeric mt-1 text-sm font-bold text-white">
        {formatDualFromSyp(dues, usdRate)}
      </p>
    </Link>
  );
}

/** السايدبار الأخضر الطبي العميق القابل للطي — بلاطة شعار، مجموعات، تنبيه مثبت */
export function Sidebar({
  collapsed,
  onToggle,
  userName,
  clinicName,
  badges,
  outstandingDuesSyp = 0,
  usdRate = DEFAULT_USD_RATE,
}: SidebarProps) {
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
          "flex items-center gap-2.5 px-3 pt-4 pb-3",
          collapsed && "justify-center px-0",
        )}
      >
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-primary-500 font-display text-xl font-bold text-white shadow-xs"
        >
          س
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-normal text-white">
              {clinicHeaderName(clinicName)}
            </span>
            <span className="block truncate text-[11px] text-primary-100/60">
              {SYSTEM_SUBTITLE}
            </span>
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
        <DuesAlertCard
          dues={outstandingDuesSyp}
          usdRate={usdRate}
          collapsed={collapsed}
        />
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
