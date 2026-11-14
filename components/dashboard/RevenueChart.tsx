"use client";

import { useState } from "react";
import { useMoney } from "@/components/ui/CurrencyContext";
import { cn } from "@/components/ui/cn";
import { FilterPills } from "@/components/ui/Toolbar";
import { monthLabel } from "@/lib/reports-period-view";
import type { RevenueDualPoint } from "@/lib/revenue-views";

// رسم إيراد لوحة القيادة — مبدّل نافذة (آخر 7 أيام / آخر 6 أشهر) ومبدّل
// مقياس (رسوم صادرة / تحصيل) على شكل المرجع. التعريفان منفصلان دائماً:
// «رسوم صادرة» تجمع قيود الرسوم و«تحصيل» يجمع الدفعات، ولا يجتمعان في رقم
// واحد. الحساب النقي هنا والعرض من سلاسل جاهزة بلا إعادة تفسير.

const DAY_FMT = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  weekday: "short",
});

/** تسمية اليوم القصيرة العربية من مفتاح اليوم YYYY-MM-DD — دالة نقية */
export function shortDayLabel(dateKey: string): string {
  return DAY_FMT.format(new Date(dateKey + "T00:00:00Z"));
}

/** خيارات نافذة الرسم و مقياسه — ثابتة الترتيب */
const WINDOW_OPTIONS = [
  { value: "7d", label: "آخر 7 أيام" },
  { value: "6m", label: "آخر 6 أشهر" },
] as const;

const SCALE_OPTIONS = [
  { value: "charges", label: "رسوم صادرة" },
  { value: "collected", label: "تحصيل" },
] as const;

type WindowChoice = (typeof WINDOW_OPTIONS)[number]["value"];
type ScaleChoice = (typeof SCALE_OPTIONS)[number]["value"];

/**
 * نقي — ارتفاع كل عمود بالنسبة المئوية من أعلى قيمة، بأرضية صغيرة
 * لتبقى الأعمدة الصفرية مرئية كخط أساس.
 */
export function barHeights(values: ReadonlyArray<number>): number[] {
  const max = Math.max(...values, 0);
  return values.map((value) => (max > 0 ? Math.max((value / max) * 100, 4) : 4));
}

/** قيمة العمود حسب المقياس المختار — لا خلط بين التعريفين أبداً */
export function pointValue(
  point: RevenueDualPoint,
  scale: ScaleChoice,
): number {
  return scale === "charges" ? point.chargesSyp : point.collectedSyp;
}

/** رسم إيراد لوحة القيادة — مبدّلا نافذة ومقياس فوق أعمدة القيمة المختارة */
export function RevenueChart({
  daily,
  monthly,
}: {
  daily: RevenueDualPoint[];
  monthly: RevenueDualPoint[];
}) {
  const money = useMoney();
  const [windowChoice, setWindowChoice] = useState<WindowChoice>("7d");
  const [scaleChoice, setScaleChoice] = useState<ScaleChoice>("charges");

  const points = windowChoice === "7d" ? daily : monthly;
  const values = points.map((point) => pointValue(point, scaleChoice));
  const heights = barHeights(values);
  const scaleLabel = scaleChoice === "charges" ? "رسوم صادرة" : "تحصيل";
  const windowLabel = windowChoice === "7d" ? "آخر 7 أيام" : "آخر 6 أشهر";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPills
          ariaLabel="نافذة رسم الإيراد"
          value={windowChoice}
          onChange={setWindowChoice}
          options={WINDOW_OPTIONS}
        />
        <FilterPills
          ariaLabel="مقياس الإيراد"
          value={scaleChoice}
          onChange={setScaleChoice}
          options={SCALE_OPTIONS}
        />
      </div>
      <div
        role="img"
        aria-label={`${scaleLabel} — ${windowLabel}`}
        className="flex h-44 items-end justify-between gap-2"
      >
        {points.map((point, index) => (
          <div
            key={point.key}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
          >
            <span className="numeric text-[10px] text-warm-500">
              {values[index] > 0 ? money(values[index]) : ""}
            </span>
            <div
              className={cn(
                "w-full max-w-9 rounded-t-md bg-primary-500/85",
                values[index] === 0 && "bg-primary-200",
              )}
              style={{ height: `${heights[index]}%` }}
            />
            <span className="text-[10px] text-warm-400">
              {windowChoice === "7d"
                ? shortDayLabel(point.key)
                : monthLabel(point.key)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
