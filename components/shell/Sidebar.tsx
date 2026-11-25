"use client";

import { PanelRightClose, PanelRightOpen, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatDualFromUsd, DEFAULT_USD_RATE } from "@/lib/currency";
import { BrandMark } from "@/components/auth/BrandMark";
import LogoutButton from "@/components/LogoutButton";
import { cn } from "@/components/ui/cn";
import { navGroups, homeNav, type BadgeKey, type NavGroup } from "./nav-items";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  userName: string;
  /** اسم العيادة المسجل — يُعرض في الترويسة تحت «DENTIQ عيادتي» */
  clinicName?: string;
  /** حرف الشعار المخزّن — بلا أثر بعد تبنّي بلاطة BrandMark المتدرجة، ويُرجَع للتوافق مع المُستهلكين */
  logoLetter?: string;
  badges: Record<BadgeKey, number>;
  /** المستحقات غير المسددة عبر المرضى — بطاقة التنبيه المثبتة أسفل الشريط */
  outstandingDuesUsd?: number;
  /** سعر صرف الدولار — لعرض العملة المزدوجة في بطاقة التنبيه */
  usdRate?: number;
};

const SYSTEM_NAME = "عيادات الأسنان";

/*
 * هوية السايدبار — مربوط بنظام التصميم عبر الرموز الدلالية (نمط AuthShell):
 * سطح مرتفع فاتح بحد شعري، والعنصر النشط حبّة أزرق DENTIQ بنص أبيض،
 * فيبقى متطابقاً مع الهوية في الوضعين الفاتح والداكن.
 */
const SIDEBAR_BG = "var(--color-surface-raised)";
const SIDEBAR_LINE = "var(--color-warm-200)";
const ACTIVE_BG = "var(--color-primary-500)";
const ACTIVE_TEXT = "#FFFFFF";
const MUTED_TEXT = "var(--color-warm-500)";
const FAINT_TEXT = "var(--color-warm-400)";
const ACCENT = "var(--color-primary-600)";
/* توهج الأيقونة النشطة — نظير --glowS في المرجع */
const ICON_GLOW = "drop-shadow(0 0 10px rgba(91, 108, 228, 0.35))";
const BADGE_BG = "#FB7185";

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

/** رابط تنقل — العنصر النشط حبّة أزرق DENTIQ بأيقونة بيضاء متوهجة على نمط الأزرار الأولية */
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
      style={active ? { background: ACTIVE_BG, color: ACTIVE_TEXT } : { color: MUTED_TEXT }}
      className={cn(
        "relative flex items-center gap-3 rounded-[11px] px-2.5 py-2 text-[13px] font-semibold transition-colors hover:bg-warm-100 hover:text-warm-900",
        active && "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon
        size={20}
        aria-hidden
        className="shrink-0"
        style={active ? { color: ACCENT, filter: ICON_GLOW } : undefined}
      />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && count !== undefined && count > 0 && (
        <span
          className="numeric grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
          style={{ background: BADGE_BG }}
        >
          {count}
        </span>
      )}
      {collapsed && count !== undefined && count > 0 && (
        <span
          aria-hidden
          className="absolute start-1 top-1.5 size-2 rounded-full"
          style={{ background: BADGE_BG }}
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
        <p
          className="flex items-center gap-2.5 px-3 pb-1 text-[10px] font-bold tracking-wide"
          style={{ color: FAINT_TEXT }}
        >
          <span>{group.label}</span>
          <span
            aria-hidden
            className="h-px flex-1"
            style={{
              background: `linear-gradient(to left, ${SIDEBAR_LINE}, transparent)`,
            }}
          />
        </p>
      ) : (
        <div
          role="presentation"
          className="mx-auto my-2 h-px w-8"
          style={{ background: SIDEBAR_LINE }}
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
        title={`مستحقات غير مسددة: ${formatDualFromUsd(dues, usdRate)}`}
        className="mx-auto grid size-8 place-items-center rounded-full border border-danger-300/40 bg-danger-500/15 transition-colors hover:bg-danger-500/25"
      >
        <span
          aria-hidden
          className="size-2.5 rounded-full"
          style={{ background: BADGE_BG }}
        />
      </Link>
    );
  }
  return (
    <Link
      href="/dues"
      className="block rounded-field border border-danger-300/40 bg-danger-500/10 px-3 py-2.5 transition-colors hover:bg-danger-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-300"
    >
      <p className="flex items-center gap-2 text-xs font-semibold text-danger-100">
        <Wallet size={14} aria-hidden className="shrink-0" />
        مستحقات غير مسددة
      </p>
      <p className="numeric mt-1 text-sm font-bold text-white">
        {formatDualFromUsd(dues, usdRate)}
      </p>
    </Link>
  );
}

/** سايدبار DENTIQ الجرافيتي القابل للطي — ترويسة هوية، مجموعات، تنبيه مثبت */
export function Sidebar({
  collapsed,
  onToggle,
  userName,
  clinicName,
  badges,
  outstandingDuesUsd = 0,
  usdRate = DEFAULT_USD_RATE,
}: SidebarProps) {
  const pathname = usePathname() ?? "/dashboard";
  const ToggleIcon = collapsed ? PanelRightOpen : PanelRightClose;

  return (
    <aside
      style={{ background: SIDEBAR_BG, borderInlineEnd: `1px solid ${SIDEBAR_LINE}` }}
      className={cn(
        "fixed inset-y-0 start-0 z-40 hidden flex-col transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* ترويسة الهوية: بلاطة BrandMark المتدرجة + «DENTIQ عيادتي» + اسم العيادة */}
      <div
        className={cn(
          "flex items-center gap-2.5 px-3.5 pt-4 pb-3",
          collapsed && "justify-center px-0",
        )}
      >
        <BrandMark size={collapsed ? 32 : 36} />
        {!collapsed && (
          <span className="min-w-0">
            <span
              className="block truncate text-sm font-bold tracking-wide"
              style={{ color: ACTIVE_TEXT }}
            >
              <span className="numeric" style={{ color: ACCENT }}>
                DENTIQ
              </span>{" "}
              عيادتي
            </span>
            <span
              className="block truncate text-[11px]"
              style={{ color: MUTED_TEXT }}
            >
              {clinicHeaderName(clinicName)}
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
        style={{ borderColor: SIDEBAR_LINE }}
        className={cn(
          "flex flex-col gap-2 border-t p-3",
          collapsed && "items-center",
        )}
      >
        <DuesAlertCard
          dues={outstandingDuesUsd}
          usdRate={usdRate}
          collapsed={collapsed}
        />
        {!collapsed && (
          <span
            className="truncate text-xs"
            style={{ color: MUTED_TEXT }}
          >
            {userName}
          </span>
        )}
        <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
          <LogoutButton
            className={cn(
              "flex-1 rounded-field border border-warm-200 text-warm-800 hover:bg-warm-100",
              collapsed && "w-full",
            )}
          />
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
            className="rounded-field p-2 text-warm-500 transition-colors hover:bg-warm-100 hover:text-warm-900"
          >
            <ToggleIcon size={20} aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}
