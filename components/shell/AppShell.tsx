"use client";

import { useEffect, useState } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { DEFAULT_USD_RATE } from "@/lib/currency";
import { onLedgerChanged } from "@/lib/ledger-events";
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
  outstandingDuesSyp?: number;
  /** سعر صرف الدولار — لعرض العملة المزدوجة في بطاقة المستحقات */
  usdRate?: number;
  /** قفل حساب الجلسة مفعّل — يظهر زر القفل اليدوي في الشريط العلوي */
  lockEnabled?: boolean;
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
  outstandingDuesSyp = 0,
  usdRate = DEFAULT_USD_RATE,
  lockEnabled = false,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  // ملخص المستحقات الحي — يُهيّأ من التخطيط الخادم ويُجلب من جديد بعد كل
  // كتابة في الدفتر (قيد/دفعة/تسوية) كي تعكس بطاقة السايدبار وشارة النقل
  // آخر عملية فوراً بدل انتظار إعادة تحميل كاملة.
  const [outstandingDues, setOutstandingDues] = useState(outstandingDuesSyp);
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
            outstandingDuesSyp?: number;
            patientsWithDues?: number;
          };
          if (cancelled) return;
          if (typeof data.outstandingDuesSyp === "number") {
            setOutstandingDues(data.outstandingDuesSyp);
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
        outstandingDuesSyp={outstandingDues}
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
          logoLetter={logoLetter}
          clinicName={clinicName}
        />
        <main className="flex-1 pb-20 md:pb-8">{children}</main>
      </div>
      <BottomNav badges={badges} />
    </ToastProvider>
  );
}
