"use client";

import type { ToothAnatomy } from "@/lib/odontogram/anatomy";
import {
  TOOTH_CHART_FILL,
  isChartFaded,
  type ToothStatusKey,
} from "@/lib/odontogram/statuses";
import {
  CROWN_PAINT,
  CrownSurfaceOverlay,
} from "@/components/odontogram/CrownPaint";
import { toothDisplayNameAr } from "@/lib/odontogram/fdi";
import { cn } from "@/components/ui/cn";

// خلية سن واحدة في المخطط الوطني — رقم السن واسمه التشريحي حول رسم SVG،
// والحالة تُلوِّن التعبئة واسم السن معاً (كما في المرجع: 17 حمراء لتسوس،
// 36 زرقاء لحشوة). الفك العلوي: الرقم أعلى والاسم أسفل؛ السفلي بالعكس.
// عند مشاهدة بأسطح محددة تُلوَّن الأسطح المصابة حصراً بنظام CROWN_PAINT
// (لون + نقش — لا لون وحده) وتظل بقية التاج عاجية.

type Props = {
  tooth: ToothAnatomy;
  status: ToothStatusKey | null;
  /** أكواد الأسطح المصابة في آخر مشاهدة (مثال O+M) — فارغ يعني تلوين التاج كاملاً. */
  affectedSurfaces?: readonly string[];
  selected: boolean;
  onSelect: (fdi: number) => void;
};

export default function ChartTooth({
  tooth,
  status,
  affectedSurfaces,
  selected,
  onSelect,
}: Props) {
  const fill =
    status && status !== "HEALTHY" && status !== "WATCH"
      ? TOOTH_CHART_FILL[status]
      : undefined;
  const faded = status ? isChartFaded(status) : false;
  const name = toothDisplayNameAr(tooth.fdi);
  const numberNode = (
    <span className="numeric text-warm-700 text-xs leading-none font-bold">
      {tooth.fdi}
    </span>
  );
  const nameNode = name ? (
    <span
      className="max-w-14 text-center text-[10px] leading-tight"
      style={fill ? { color: fill } : undefined}
    >
      {name}
    </span>
  ) : null;

  // التلوين الجزئي بنظام CROWN_PAINT — لون الحالة ونقشها على الأسطح المصابة حصراً.
  const paint = status ? CROWN_PAINT[status] : null;
  const overlay =
    paint && affectedSurfaces && affectedSurfaces.length > 0 ? (
      <CrownSurfaceOverlay
        anatomy={tooth}
        codes={affectedSurfaces}
        paint={paint}
        idPrefix={`chart-tooth-${tooth.fdi}`}
      />
    ) : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(tooth.fdi)}
      aria-pressed={selected}
      aria-label={`سن ${tooth.fdi}${name ? ` — ${name}` : ""}${
        status && status !== "HEALTHY" ? " — له حالة مسجلة" : ""
      }`}
      className={cn(
        "rounded-field flex shrink-0 flex-col items-center gap-1 p-1 transition-colors",
        "hover:bg-surface-hover focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
        selected && "bg-primary-50 ring-primary-600 ring-2 ring-offset-1",
      )}
    >
      {tooth.row === "upper" ? (
        <>
          {numberNode}
          <Glyph />
          {nameNode}
        </>
      ) : (
        <>
          {nameNode}
          <Glyph />
          {numberNode}
        </>
      )}
    </button>
  );

  function Glyph() {
    return (
      <svg viewBox="0 0 40 60" className="h-12 w-8" aria-hidden>
        <g
          transform={tooth.row === "upper" ? "rotate(180 20 30)" : undefined}
          className={cn(faded && "opacity-50")}
        >
          <path
            d={tooth.rootPath}
            fill="var(--color-tooth-enamel)"
            stroke="var(--color-tooth-line-soft)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d={tooth.crownPath}
            fill={
              overlay
                ? "var(--color-tooth-enamel)"
                : (fill ?? "var(--color-tooth-enamel)")
            }
            stroke={faded ? "var(--color-warning-500)" : "var(--color-tooth-line)"}
            strokeWidth={fill ? "1.6" : "1.2"}
            strokeLinejoin="round"
            strokeDasharray={faded ? "3 2.5" : undefined}
          />
          {overlay}
        </g>
      </svg>
    );
  }
}
