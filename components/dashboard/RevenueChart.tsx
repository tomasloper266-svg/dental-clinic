"use client";

import { useState } from "react";
import { useMoney } from "@/components/ui/CurrencyContext";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/components/ui/cn";
import { FilterPills } from "@/components/ui/Toolbar";
import { formatDate } from "@/lib/i18n/format";
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

/** تسمية اليوم القصيرة حسب اللغة — العربية على صيغة المرجع نفسها */
function xLabelDay(dateKey: string, locale: "ar" | "en"): string {
  return locale === "ar"
    ? shortDayLabel(dateKey)
    : formatDate(dateKey + "T00:00:00Z", "en", { weekday: "short" });
}

/** تسمية الشهر القصيرة حسب اللغة — العربية عبر monthLabel المرجعية */
function xLabelMonth(dateKey: string, locale: "ar" | "en"): string {
  return locale === "ar"
    ? monthLabel(dateKey)
    : formatDate(dateKey + "T00:00:00Z", "en", { month: "short" });
}

/** خيارات نافذة الرسم و مقياسه — تُترجم عند الرسم حسب اللغة */
const WINDOW_OPTIONS = [
  { value: "7d", labelKey: "chart.last7Days" },
  { value: "6m", labelKey: "chart.last6Months" },
] as const;

const SCALE_OPTIONS = [
  { value: "charges", labelKey: "chart.charges" },
  { value: "collected", labelKey: "chart.collected" },
] as const;

type WindowChoice = (typeof WINDOW_OPTIONS)[number]["value"];
type ScaleChoice = (typeof SCALE_OPTIONS)[number]["value"];

/**
 * نقي — ارتفاع كل عمود بالنسبة المئوية من أعلى قيمة، بأرضية صغيرة
 * لتبقى الأعمدة الصفرية مرئية كخط أساس.
 */
export function barHeights(values: ReadonlyArray<number>): number[] {
  const max = Math.max(...values, 0);
  return values.map((value) =>
    max > 0 ? Math.max((value / max) * 100, 4) : 4,
  );
}

/** قيمة العمود حسب المقياس المختار — لا خلط بين التعريفين أبداً */
export function pointValue(
  point: RevenueDualPoint,
  scale: ScaleChoice,
): number {
  return scale === "charges" ? point.chargesUsd : point.collectedUsd;
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
  const { t, locale } = useI18n();
  const [windowChoice, setWindowChoice] = useState<WindowChoice>("7d");
  const [scaleChoice, setScaleChoice] = useState<ScaleChoice>("charges");

  const points = windowChoice === "7d" ? daily : monthly;
  const values = points.map((point) => pointValue(point, scaleChoice));
  const heights = barHeights(values);
  const scaleLabel = t(
    scaleChoice === "charges" ? "chart.charges" : "chart.collected",
  );
  const windowLabel = t(
    windowChoice === "7d" ? "chart.last7Days" : "chart.last6Months",
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPills
          ariaLabel={t("chart.windowAria")}
          value={windowChoice}
          onChange={setWindowChoice}
          options={WINDOW_OPTIONS.map(({ value, labelKey }) => ({
            value,
            label: t(labelKey),
          }))}
        />
        <FilterPills
          ariaLabel={t("chart.scaleAria")}
          value={scaleChoice}
          onChange={setScaleChoice}
          options={SCALE_OPTIONS.map(({ value, labelKey }) => ({
            value,
            label: t(labelKey),
          }))}
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
            <span className="numeric text-warm-500 text-[10px]">
              {values[index] > 0 ? money(values[index]) : ""}
            </span>
            <div
              className={cn(
                "bg-primary-500/85 w-full max-w-9 rounded-t-md",
                values[index] === 0 && "bg-primary-200",
              )}
              style={{ height: `${heights[index]}%` }}
            />
            <span className="text-warm-400 text-[10px]">
              {windowChoice === "7d"
                ? xLabelDay(point.key, locale)
                : xLabelMonth(point.key, locale)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
