"use client";

import { useId } from "react";

// رسم أعمدة رأسي ذهبي — SVG خالص بلا مكتبات، على شكل المرجع: قيمة فوق كل
// عمود وتسمية تحته، وأعمدة بتدرج كهرماني من توكنات الهوية. ترتيب النقاط
// يميناً ويساراً يحدده المتصل (الأشهر تُمرَّر زمنياً كما في المرجع).

type BarPoint = {
  /** تسمية المحور السفلي — اسم الشهر مثلاً */
  label: string;
  /** القيمة المجمّعة للعمود */
  value: number;
  /** النص المعروض فوق العمود — منسّق مسبقاً */
  valueText: string;
  /** تلميح العنصر كاملاً */
  title: string;
};

const WIDTH = 560;
const HEIGHT = 210;
const PAD = { top: 24, right: 10, bottom: 26, left: 10 };

export default function VerticalBarsChart({
  points,
  ariaLabel,
}: {
  points: BarPoint[];
  ariaLabel: string;
}) {
  // معرّف فريد لكل نسخة — يتصيّن الرسم مرتين بالصفحة (شهري ونمو)
  const gradientId = `bars-gold-${useId().replace(/:/g, "")}`;
  const max = Math.max(1, ...points.map((p) => p.value));
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = points.length > 0 ? plotW / points.length : plotW;
  const barW = Math.min(56, slot * 0.42);
  const barX = (index: number) =>
    PAD.left + index * slot + (slot - barW) / 2;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-warning-300)" />
          <stop offset="100%" stopColor="var(--color-warning-500)" />
        </linearGradient>
      </defs>
      {points.map((point, index) => {
        const barH = point.value > 0 ? Math.max(4, (point.value / max) * plotH) : 0;
        const x = barX(index);
        const y = PAD.top + plotH - barH;
        return (
          <g key={`${point.label}-${index}`}>
            <title>{point.title}</title>
            {barH > 0 && (
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={6}
                fill={`url(#${gradientId})`}
              />
            )}
            {point.value > 0 && (
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill="var(--color-warm-700)"
              >
                {point.valueText}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-warm-500)"
            >
              {point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
