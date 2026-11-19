"use client";

import { ChevronLeft, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { clinicLogoLetter } from "@/lib/branding";
import { breadcrumbsFromPath, navItemByHref } from "./nav-items";
import { ThemeToggle } from "./ThemeToggle";

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

/** الشريط العلوي: رجوع ذكي + مسار تفصّل + عنوان الصفحة الحالي */
export function Topbar({
  className,
  lockEnabled = false,
  logoLetter,
  clinicName,
}: {
  className?: string;
  /** يظهر زر القفل اليدوي فقط حين يكون قفل حساب الجلسة مفعّلاً */
  lockEnabled?: boolean;
  /** حرف الشعار المخصّص — يظهر على الموبايل حيث السايدبار مخفي */
  logoLetter?: string;
  /** اسم العيادة — مصدر الحرف البديل عند غياب الحرف المخزّن */
  clinicName?: string;
}) {
  const pathname = usePathname() ?? "/";
  const current = navItemByHref(pathname);

  return (
    <div
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-warm-200 bg-surface/90 px-4 backdrop-blur-sm",
        className,
      )}
    >
      {/* مربع الشعار المصغّر — على الموبايل فقط، حيث يغيب السايدبار وصاحبه الحرف */}
      <span
        aria-hidden
        className="glow-accent grid size-8 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-primary-400 to-primary-500 font-display text-sm font-bold text-white shadow-xs md:hidden"
      >
        {clinicLogoLetter(logoLetter, clinicName)}
      </span>
      <SmartBack pathname={pathname} />
      <Breadcrumbs pathname={pathname} />
      <div className="ms-auto flex items-center gap-1">
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
