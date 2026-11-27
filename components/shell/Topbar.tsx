"use client";

import { Bell, ChevronLeft, ArrowRight, Lock, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { BrandMark } from "@/components/auth/BrandMark";
import {
  activeBadgeEntries,
  badgeTotal,
  breadcrumbsFromPath,
  navItemByHref,
  type BadgeKey,
} from "./nav-items";
import { ThemeToggle } from "./ThemeToggle";

/** مسار بحث المرضى القائم — وجهة حقل البحث ولمحة ⌘K */
const PATIENTS_SEARCH_HREF = "/patients";

/** زر رجوع ذكي: يعود للتاريخ إن وُجد، وإلا للرئيسية — ويختفي في الرئيسية */
function SmartBack({ pathname }: { pathname: string }) {
  const router = useRouter();
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
      aria-label="رجوع"
      className="rounded-field p-1.5 text-warm-600 hover:bg-surface-hover hover:text-ink-900"
    >
      <ArrowRight size={20} aria-hidden />
    </button>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const crumbs = breadcrumbsFromPath(pathname);

  return (
    <nav aria-label="مسار الصفحة" className="min-w-0">
      <ol className="flex items-center gap-1 text-xs text-warm-500">
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
                  className="truncate font-semibold text-ink-900"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate hover:text-ink-900 hover:underline"
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
  return (
    <Link
      href={PATIENTS_SEARCH_HREF}
      aria-label="ابحث عن مريض، موعد، فاتورة"
      className="hidden max-w-80 flex-1 items-center gap-2 rounded-full border border-warm-200 bg-surface-raised px-4 py-1.5 text-xs text-warm-500 transition-colors hover:border-primary-300 hover:text-primary-600 md:flex"
    >
      <Search size={14} aria-hidden className="shrink-0" />
      <span className="flex-1 truncate">
        ابحث عن مريض، موعد، فاتورة…
      </span>
      <kbd className="numeric shrink-0 rounded border border-primary-200 bg-primary-50 px-1.5 py-0.5 text-[9px] text-primary-600">
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
        aria-label={`التنبيهات${total > 0 ? ` (${total})` : ""}`}
        title="التنبيهات"
        className="relative rounded-field p-1.5 text-warm-600 transition-colors hover:bg-surface-hover hover:text-ink-900"
      >
        <Bell size={18} aria-hidden />
        {total > 0 && (
          <span className="numeric absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger-500 px-1 text-[9px] font-bold text-white">
            {total}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute end-0 top-full z-40 mt-2 w-60 rounded-panel border border-warm-200 bg-surface-raised p-2 shadow-md"
          role="dialog"
          aria-label="قائمة التنبيهات"
        >
          {entries.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-warm-500">
              لا تنبيهات قائمة — كل شيء هادئ
            </p>
          ) : (
            <ul className="flex flex-col">
              {entries.map((entry) => (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-field px-2.5 py-2 text-sm text-ink-900 transition-colors hover:bg-surface-hover"
                  >
                    <entry.icon size={16} aria-hidden className="text-warm-500" />
                    <span className="flex-1 truncate">{entry.label}</span>
                    <span className="numeric grid min-w-5 place-items-center rounded-full bg-danger-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
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
      aria-label="قفل التطبيق"
      title="قفل التطبيق"
      className="ms-auto rounded-field p-1.5 text-warm-600 hover:bg-surface-hover hover:text-ink-900 disabled:opacity-50"
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
  const pathname = usePathname() ?? "/";
  const current = navItemByHref(pathname);
  usePatientsSearchShortcut();

  return (
    <div
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-warm-200 bg-surface/90 px-4 backdrop-blur-sm",
        className,
      )}
    >
      {/* بلاطة DENTIQ المصغّرة — على الموبايل فقط، حيث يغيب السايدبار وترويسته */}
      <span aria-hidden data-testid="topbar-brand" className="shrink-0 md:hidden">
        <BrandMark size={32} />
      </span>
      <SearchPill />
      <SmartBack pathname={pathname} />
      <Breadcrumbs pathname={pathname} />
      <div className="ms-auto flex items-center gap-1">
        <NotificationsBell badges={badges} />
        <ThemeToggle />
        {current && !lockEnabled && (
          <span className="hidden truncate text-sm font-semibold text-warm-500 sm:inline">
            {current.label}
          </span>
        )}
        {lockEnabled && <ManualLock />}
      </div>
    </div>
  );
}
