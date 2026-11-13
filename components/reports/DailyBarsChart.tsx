"use client";

import { formatShortSyp, seriesMax } from "@/lib/reports-view";
import { formatDualFromSyp } from "@/lib/currency";

// رسم بياني يومي (تحصيل مقابل مصاريف) — SVG خالص بلا أي مكتبة خارجية:
// الحجم صغير والتحكم الكامل بالاتجاه RTL (الأقدم إلى اليمين والأحدث
// إلى اليسار كما يُقرأ بالعربية) وبألوان الـ tokens.

type SeriesPoint = { date: string; collectedSyp: number; expensesSyp: number };

const WIDTH = 560;
const HEIGHT = 170;
const PAD = { top: 10, right: 8, bottom: 22, left: 48 };

const dayLabelFmt = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  day: "numeric",
  month: "short",
});
const tooltipFmt = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  weekday: "short",
  day: "numeric",
  month: "long",
});

export default function DailyBarsChart({
  series,
  usdRate,
}: {
  series: SeriesPoint[];
  usdRate: number;
}) {
  const max = seriesMax(series);
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = series.length > 0 ? plotW / series.length : plotW;
  const barW = Math.min(14, slot / 3);
  // الزمن يجري من اليمين إلى اليسار: أقدم يوم عند اليمين.
  const slotX = (index: number) =>
    WIDTH - PAD.right - (index + 1) * slot + (slot - barW * 2 - 2) / 2;
  const barH = (value: number) =>
    value > 0 ? Math.max(2, (value / max) * plotH) : 0;

  const gridValues = [max, max / 2, 0];
  // تسمية يوم واحدة كل بضعة أيام حتى لا تتزاحم المحور — التباعد يُحتسب
  // من أحدث يوم حتى تُوسم نهاية السلسلة دائماً دون تسميتين متجاورتين.
  const labelEvery = Math.ceil(series.length / 7);

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-warm-600">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-sm bg-primary-500"
          />
          التحصيل
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-sm bg-warm-300"
          />
          المصاريف
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="رسم بياني يومي للتحصيل والمصاريف — الأحدث إلى اليسار"
      >
        {gridValues.map((value) => {
          const y = PAD.top + plotH - (value / max) * plotH;
          return (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--color-warm-200)"
                strokeWidth={value === 0 ? 1 : 0.5}
                strokeDasharray={value === 0 ? undefined : "3 3"}
              />
              <text
                x={PAD.left - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={9}
                fill="var(--color-warm-500)"
              >
                {formatShortSyp(value)}
              </text>
            </g>
          );
        })}

        {series.map((point, index) => {
          const x = slotX(index);
          const collectedH = barH(point.collectedSyp);
          const expensesH = barH(point.expensesSyp);
          const showLabel =
            (series.length - 1 - index) % labelEvery === 0;
          return (
            <g key={point.date}>
              <title>
                {`${tooltipFmt.format(new Date(`${point.date}T00:00:00Z`))} — ` +
                  `تحصيل: ${formatDualFromSyp(point.collectedSyp, usdRate)}، ` +
                  `مصاريف: ${formatDualFromSyp(point.expensesSyp, usdRate)}`}
              </title>
              {collectedH > 0 && (
                <rect
                  x={x + barW + 2}
                  y={PAD.top + plotH - collectedH}
                  width={barW}
                  height={collectedH}
                  rx={2}
                  fill="var(--color-primary-500)"
                />
              )}
              {expensesH > 0 && (
                <rect
                  x={x}
                  y={PAD.top + plotH - expensesH}
                  width={barW}
                  height={expensesH}
                  rx={2}
                  fill="var(--color-warm-300)"
                />
              )}
              {showLabel && (
                <text
                  x={x + barW + 1}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--color-warm-500)"
                >
                  {dayLabelFmt.format(new Date(`${point.date}T00:00:00Z`))}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
