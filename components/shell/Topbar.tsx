"use client";

import { ChevronLeft, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { breadcrumbsFromPath, navItemByHref } from "./nav-items";

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
}: {
  className?: string;
  /** يظهر زر القفل اليدوي فقط حين يكون قفل حساب الجلسة مفعّلاً */
  lockEnabled?: boolean;
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
      <SmartBack pathname={pathname} />
      <Breadcrumbs pathname={pathname} />
      {current && !lockEnabled && (
        <span className="ms-auto hidden truncate text-sm font-semibold text-warm-500 sm:inline">
          {current.label}
        </span>
      )}
      {lockEnabled && <ManualLock />}
    </div>
  );
}
