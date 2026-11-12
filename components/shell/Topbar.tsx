"use client";

import { ChevronLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
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

/** الشريط العلوي: رجوع ذكي + مسار تفصّل + عنوان الصفحة الحالي */
export function Topbar({ className }: { className?: string }) {
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
      {current && (
        <span className="ms-auto hidden truncate text-sm font-semibold text-warm-500 sm:inline">
          {current.label}
        </span>
      )}
    </div>
  );
}
