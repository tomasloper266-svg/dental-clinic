"use client";

import { Clock, Users } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { useMoney } from "@/components/ui/CurrencyContext";

// شريط أرقام اليوم — تسلسل بصري مقصود: الصافي هو الرقم المرجعي الأكبر،
// وبقية الأرقام صف ثانوي. الأرقام المالية بمعالجة numeric (تبويبية).
// كل رقم يفتح صفحته — صفحات الدفتر والتقارير قادمة في موجة الحسابات،
// لذا الأرقام المالية بلا روابط الآن والأرقام التشغيلية مربوطة بصفحاتها.

type DailySummaryStripProps = {
  netSyp: number;
  collectedSyp: number;
  expensesSyp: number;
  patientsToday: number;
  waitlistCount: number;
};

const secondaryCell =
  "flex flex-col gap-1 rounded-panel border border-warm-200 bg-surface-raised px-4 py-3";

export function DailySummaryStrip({
  netSyp,
  collectedSyp,
  expensesSyp,
  patientsToday,
  waitlistCount,
}: DailySummaryStripProps) {
  const money = useMoney();
  const netNegative = netSyp < 0;

  return (
    <section
      aria-label="أرقام اليوم"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {/* الرقم المرجعي — يمتد صفاً كاملاً بأولوية بصرية أعلى */}
      <div
        className={cn(
          "rounded-panel col-span-2 flex flex-col gap-1 border px-5 py-4 lg:col-start-1 lg:row-span-2 lg:row-start-1",
          netNegative
            ? "border-danger-300 bg-danger-50"
            : "border-primary-200 bg-primary-50",
        )}
      >
        <span className="text-warm-600 text-xs font-medium">
          صافي اليوم
        </span>
        <span
          className={cn(
            "numeric text-4xl leading-tight font-semibold",
            netNegative ? "text-danger-700" : "text-primary-800",
          )}
        >
          {money(netSyp)}
        </span>
        <span className="text-warm-500 text-xs">
          التحصيل − المصاريف − الاستردادات
        </span>
      </div>

      <div className={secondaryCell}>
        <span className="text-warm-500 text-xs">التحصيل</span>
        <span className="numeric text-ink-900 text-lg font-semibold">
          {money(collectedSyp)}
        </span>
      </div>

      <div className={secondaryCell}>
        <span className="text-warm-500 text-xs">المصاريف</span>
        <span className="numeric text-ink-900 text-lg font-semibold">
          {money(expensesSyp)}
        </span>
      </div>

      <a
        href="/appointments"
        className={cn(
          secondaryCell,
          "hover:border-primary-300 hover:bg-surface-hover transition-colors",
        )}
      >
        <span className="text-warm-500 flex items-center gap-1.5 text-xs">
          <Users size={16} aria-hidden /> مرضى اليوم
        </span>
        <span className="numeric text-ink-900 text-lg font-semibold">
          {patientsToday}
        </span>
      </a>

      <a
        href="/waitlist"
        className={cn(
          secondaryCell,
          "hover:border-primary-300 hover:bg-surface-hover transition-colors",
        )}
      >
        <span className="text-warm-500 flex items-center gap-1.5 text-xs">
          <Clock size={16} aria-hidden /> منتظرو الانتظار
        </span>
        <span className="numeric text-ink-900 text-lg font-semibold">
          {waitlistCount}
        </span>
      </a>
    </section>
  );
}
