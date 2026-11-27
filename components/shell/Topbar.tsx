"use client";

import { Bell, ChevronLeft, ArrowRight, Lock, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { BrandMark } from "@/components/auth/BrandMark";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  activeBadgeEntries,
  badgeTotal,
  breadcrumbsFromPath,
  navItemByHref,
  segmentLabelKey,
  type BadgeKey,
} from "./nav-items";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";

/** مسار بحث المرضى القائم — وجهة حقل البحث ولمحة ⌘K */
const PATIENTS_SEARCH_HREF = "/patients";

/** زر رجوع ذكي: يعود للتاريخ إن وُجد، وإلا للرئيسية — ويختفي في الرئيسية */
function SmartBack({ pathname }: { pathname: string }) {
  const router = useRouter();
  const { t } = useI18n();
  if (pathname === "/dashboard") return null;

  function onBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <button
      type="button"
      onClick={onBack}
      aria-label={t("common.back")}
      className="rounded-field text-warm-600 hover:bg-surface-hover hover:text-ink-900 p-1.5"
    >
      <ArrowRight size={20} aria-hidden />
    </button>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const { t } = useI18n();
  const crumbs = breadcrumbsFromPath(pathname).map((crumb) => {
    // التسمية المترجمة حسب اللغة — والمفتاح الغائب يبقي العربية الافتراضية
    const key = segmentLabelKey(crumb.href.split("/").pop() ?? "");
    return { ...crumb, label: key ? t(key) : crumb.label };
  });

  return (
    <nav aria-label={t("shell.pagePath")} className="min-w-0">
      <ol className="text-warm-500 flex items-center gap-1 text-xs">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronLeft size={16} className="shrink-0" aria-hidden />
              )}
              {isLast ? (
                <span
                  aria-current="page"
                  className="text-ink-900 truncate font-semibold"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="hover:text-ink-900 truncate hover:underline"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** حقل البحث الدائري — يفتح بحث المرضى القائم، لا بحثاً جديداً */
function SearchPill() {
  const { t } = useI18n();
  return (
    <Link
      href={PATIENTS_SEARCH_HREF}
      aria-label={t("shell.searchAria")}
      className="border-warm-200 bg-surface-raised text-warm-500 hover:border-primary-300 hover:text-primary-600 hidden max-w-80 flex-1 items-center gap-2 rounded-full border px-4 py-1.5 text-xs transition-colors md:flex"
    >
      <Search size={14} aria-hidden className="shrink-0" />
      <span className="flex-1 truncate">{t("shell.searchPlaceholder")}</span>
      <kbd className="numeric border-primary-200 bg-primary-50 text-primary-600 shrink-0 rounded border px-1.5 py-0.5 text-[9px]">
        ⌘K
      </kbd>
    </Link>
  );
}

/** لمحة ⌘K / Ctrl+K تفتح بحث المرضى — تأثير مفاتيح واحد على مستوى النافذة */
function usePatientsSearchShortcut() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push(PATIENTS_SEARCH_HREF);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
}

/**
 * جرس التنبيهات — عدّاد يلخص الشارات القائمة (انتظار/مستحقات/مخزون)
 * وقائمة منبثقة بمداخلها فقط؛ اختفاء الجرس بلا شارات يعني لا تنبيهات.
 */
function NotificationsBell({
  badges,
}: {
  badges?: Partial<Record<BadgeKey, number>>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const entries = activeBadgeEntries(badges ?? {});
  const total = badgeTotal(badges ?? {});

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={
          total > 0
            ? t("shell.notificationsWithCount", { count: total })
            : t("shell.notifications")
        }
        title={t("shell.notifications")}
        className="rounded-field text-warm-600 hover:bg-surface-hover hover:text-ink-900 relative p-1.5 transition-colors"
      >
        <Bell size={18} aria-hidden />
        {total > 0 && (
          <span className="numeric bg-danger-500 absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white">
            {total}
          </span>
        )}
      </button>
      {open && (
        <div
          className="rounded-panel border-warm-200 bg-surface-raised absolute end-0 top-full z-40 mt-2 w-60 border p-2 shadow-md"
          role="dialog"
          aria-label={t("shell.notificationsList")}
        >
          {entries.length === 0 ? (
            <p className="text-warm-500 px-2 py-3 text-center text-xs">
              {t("shell.noNotifications")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {entries.map((entry) => (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    onClick={() => setOpen(false)}
                    className="rounded-field text-ink-900 hover:bg-surface-hover flex items-center gap-2 px-2.5 py-2 text-sm transition-colors"
                  >
                    <entry.icon
                      size={16}
                      aria-hidden
                      className="text-warm-500"
                    />
                    <span className="flex-1 truncate">{t(entry.labelKey)}</span>
                    <span className="numeric bg-danger-500 grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {entry.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** زر القفل اليدوي — يحذف كوكي فتح القفل فتعود شاشة القفل فوراً */
function ManualLock() {
  const router = useRouter();
  const { t } = useI18n();
  const [locking, setLocking] = useState(false);

  async function onLock() {
    if (locking) return;
    setLocking(true);
    try {
      await fetch("/api/lock", { method: "DELETE" });
      router.refresh();
    } catch {
      // فشل الشبكة: تبقى الصفحة مفتوحة — القفل إجراء قابل للتكرار
      setLocking(false);
      return;
    }
  }

  return (
    <button
      type="button"
      onClick={onLock}
      disabled={locking}
      aria-label={t("shell.lockApp")}
      title={t("shell.lockApp")}
      className="rounded-field text-warm-600 hover:bg-surface-hover hover:text-ink-900 ms-auto p-1.5 disabled:opacity-50"
    >
      <Lock size={18} aria-hidden />
    </button>
  );
}

/** الشريط العلوي على هوية المرجع: بحث دائري + تنبيهات + رجوع ومسار وثيم وقفل */
export function Topbar({
  className,
  lockEnabled = false,
  badges,
}: {
  className?: string;
  /** يظهر زر القفل اليدوي فقط حين يكون قفل حساب الجلسة مفعّلاً */
  lockEnabled?: boolean;
  /** شارات التنبيه القائمة — عدّاد الجرس من انتظار/مستحقات/مخزون */
  badges?: Partial<Record<BadgeKey, number>>;
}) {
  const { t } = useI18n();
  const pathname = usePathname() ?? "/";
  const current = navItemByHref(pathname);
  usePatientsSearchShortcut();

  return (
    <div
      className={cn(
        "border-warm-200 bg-surface/90 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur-sm",
        className,
      )}
    >
      {/* بلاطة DENTIQ المصغّرة — على الموبايل فقط، حيث يغيب السايدبار وترويسته */}
      <span
        aria-hidden
        data-testid="topbar-brand"
        className="shrink-0 md:hidden"
      >
        <BrandMark size={32} />
      </span>
      <SearchPill />
      <SmartBack pathname={pathname} />
      <Breadcrumbs pathname={pathname} />
      <div className="ms-auto flex items-center gap-1">
        <NotificationsBell badges={badges} />
        <LanguageSwitcher />
        <ThemeToggle />
        {current && !lockEnabled && (
          <span className="text-warm-500 hidden truncate text-sm font-semibold sm:inline">
            {t(current.labelKey)}
          </span>
        )}
        {lockEnabled && <ManualLock />}
      </div>
    </div>
  );
}
