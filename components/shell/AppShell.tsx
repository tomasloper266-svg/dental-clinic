"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ToastProvider } from "@/components/ui/Toast";
import { DEFAULT_USD_RATE } from "@/lib/currency";
import { onLedgerChanged } from "@/lib/ledger-events";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/components/ui/cn";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { BadgeKey } from "./nav-items";

type AppShellProps = {
  userName: string;
  /** اسم العيادة كما أدخله الطبيب عند التسجيل — لترويسة السايدبار */
  clinicName?: string;
  /** حرف الشعار المخصّص — يُفسَّر من اسم العيادة في الخدمة عند غيابه */
  logoLetter?: string;
  badges: Record<BadgeKey, number>;
  /** المستحقات غير المسددة — بطاقة التنبيه المثبتة في السايدبار */
  outstandingDuesUsd?: number;
  /** سعر صرف الدولار — لعرض العملة المزدوجة في بطاقة المستحقات */
  usdRate?: number;
  /** قفل حساب الجلسة مفعّل — يظهر زر القفل اليدوي في الشريط العلوي */
  lockEnabled?: boolean;
  /** بانر تحذير الاشتراك (≤ 5 أيام متبقية) — يُحسب من التواريخ على السيرفر */
  subscriptionBanner?: {
    daysLeft: number;
    endsAtIso: string;
    isTrial: boolean;
  } | null;
  children: React.ReactNode;
};

const COLLAPSE_KEY = "sidebar-collapsed";

/**
 * غلاف التطبيق المشترك: سايدبار كحلي قابل للطي (حالته في localStorage)،
 * شريط علوي بزر رجوع وbreadcrumbs، وتنقل سفلي على الموبايل.
 */
export function AppShell({
  userName,
  clinicName,
  logoLetter,
  badges,
  outstandingDuesUsd = 0,
  usdRate = DEFAULT_USD_RATE,
  lockEnabled = false,
  subscriptionBanner = null,
  children,
}: AppShellProps) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  // ملخص المستحقات الحي — يُهيّأ من التخطيط الخادم ويُجلب من جديد بعد كل
  // كتابة في الدفتر (قيد/دفعة/تسوية) كي تعكس بطاقة السايدبار وشارة النقل
  // آخر عملية فوراً بدل انتظار إعادة تحميل كاملة.
  const [outstandingDues, setOutstandingDues] = useState(outstandingDuesUsd);
  const [duesBadge, setDuesBadge] = useState(badges.dues);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onLedgerChanged(() => {
      fetch("/api/dues/summary")
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`حالة الجلب ${res.status}`);
          }
          const data = (await res.json()) as {
            outstandingDuesUsd?: number;
            patientsWithDues?: number;
          };
          if (cancelled) return;
          if (typeof data.outstandingDuesUsd === "number") {
            setOutstandingDues(data.outstandingDuesUsd);
          }
          if (typeof data.patientsWithDues === "number") {
            setDuesBadge(data.patientsWithDues);
          }
        })
        .catch((err) => {
          // فشل التجديد لا يُخفى — تبقى آخر قيمة معروفة والخطأ في السجل
          console.error("تعذر تحديث ملخص المستحقات", err);
        });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // استرجاع الحالة المحفوظة بعد التركيب فقط — تجنّباً لعدم تطابق الترطيب.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      window.localStorage.setItem(COLLAPSE_KEY, prev ? "0" : "1");
      return !prev;
    });
  }

  return (
    <ToastProvider>
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        userName={userName}
        clinicName={clinicName}
        logoLetter={logoLetter}
        badges={{ ...badges, dues: duesBadge }}
        outstandingDuesUsd={outstandingDues}
        usdRate={usdRate}
      />
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-200",
          collapsed ? "md:ps-16" : "md:ps-60",
        )}
      >
        <Topbar
          lockEnabled={lockEnabled}
          badges={{ ...badges, dues: duesBadge }}
        />
        {subscriptionBanner && (
          <Link
            href="/subscription-expired"
            className="focus-ring border-warning-300 bg-warning-50 text-warning-900 hover:bg-warning-100 block border-b px-4 py-2 text-center text-sm font-medium transition-colors"
          >
            {t("shell.subBanner", {
              plan: t(
                subscriptionBanner.isTrial
                  ? "shell.subPlanTrial"
                  : "shell.subPlanPaid",
              ),
              when:
                subscriptionBanner.daysLeft === 0
                  ? t("shell.subEndsToday")
                  : t("shell.subEndsIn", { days: subscriptionBanner.daysLeft }),
            })}
          </Link>
        )}
        <main className="flex-1 pb-20 md:pb-8">{children}</main>
      </div>
      <BottomNav badges={badges} />
    </ToastProvider>
  );
}
