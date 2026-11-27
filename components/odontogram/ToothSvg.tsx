"use client";
import { toothName } from "@/lib/odontogram/fdi";
import { useI18n } from "@/components/i18n/I18nProvider";

import type { ReactElement } from "react";
import type { ToothAnatomy } from "@/lib/odontogram/anatomy";
import { type ToothStatusMeta, toothStatusLabel } from "@/lib/odontogram/statuses";
import {
  POCKET_SCALE_COLORS,
  pocketScaleLevel,
} from "@/lib/odontogram/periodontal-view";
import {
  CROWN_PAINT,
  CrownPatternDefs,
  CrownSurfaceOverlay,
} from "@/components/odontogram/CrownPaint";
import { cn } from "@/components/ui/cn";

// رسم سن تشريحي واحد كزر SVG. التمييز مزدوج: لون + نقش على التاج
// (خطوط مائلة للحشوة، تعبئة للتسوس، خيوط للغرسة…) — لا اللون وحده.
// عند مشاهدة مسجلة بأسطح محددة تُلوَّن الأسطح المصابة حصراً داخل التاج
// (تلوين سطح جزئي بنظام CROWN_PAINT نفسه)، وما عداها يبقى عاجياً.
// الجذور تبقى عاجية دائماً، والصف العلوي يُدار 180° ليواجه التيجان خط الإطباق.

type Props = {
  tooth: ToothAnatomy;
  // الحالة الحالية للسن من latestFindingByTooth — null يعني سليماً غير ملوّن.
  meta: ToothStatusMeta | null;
  /** أكواد الأسطح المصابة في آخر مشاهدة (مثال O+M) — فارغ يعني تلوين التاج كاملاً. */
  affectedSurfaces?: readonly string[];
  /** حالة دواعم آخر قياس — عمق الجيب يلوّن حد التاج بمقياس المقياس، والنزيف نقشاً. */
  periodontal?: { pocketDepthMm: number | null; bleeding: boolean } | null;
  selected: boolean;
  onSelect: (fdi: number) => void;
};

export default function ToothSvg({
  tooth,
  meta,
  affectedSurfaces,
  periodontal,
  selected,
  onSelect,
}: Props): ReactElement {
  const { t, locale } = useI18n();
  const status = meta?.value ?? null;
  const paint = status ? CROWN_PAINT[status] : null;
  const patternId = paint?.pattern
    ? `tooth-${paint.pattern}-${tooth.fdi}`
    : null;
  const flipped = tooth.row === "upper";

  // الدواعم: حد التاج بلون مقياس عمق الجيب، والنزيف نقش نقاط حمراء فوقه —
  // تمييز مزدوج (لون + نقش) لا يعتمد على اللون وحده.
  const perioLevel = pocketScaleLevel(periodontal?.pocketDepthMm);
  const perioStroke = perioLevel ? POCKET_SCALE_COLORS[perioLevel] : null;
  const bleeding = periodontal?.bleeding === true;
  const bleedPatternId = bleeding ? `perio-bleed-${tooth.fdi}` : null;

  // التلوين الجزئي حينما تكون للأسطح مناطق مرسومة — وإلا يعود التاج للتلوين الكامل
  const hasBands =
    paint !== null &&
    affectedSurfaces !== undefined &&
    affectedSurfaces.length > 0;
  const partial =
    hasBands && affectedSurfaces !== undefined ? (
      <CrownSurfaceOverlay
        anatomy={tooth}
        codes={affectedSurfaces}
        paint={paint as NonNullable<typeof paint>}
        idPrefix={`tooth-svg-${tooth.fdi}`}
      />
    ) : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(tooth.fdi)}
      aria-pressed={selected}
      aria-label={`${t("dental.toothAria", { fdi: tooth.fdi })} — ${toothName(locale, tooth.fdi) ?? ""}${meta ? ` — ${toothStatusLabel(locale, meta.value)}` : ""}${perioLevel ? ` — ${t("periodontal.pocketDepthAriaSuffix", { depth: periodontal?.pocketDepthMm ?? "" })}` : ""}${bleeding ? t("periodontal.bleedingSuffix") : ""}`}
      className={cn(
        "rounded-field flex shrink-0 flex-col items-center p-0.5 transition-colors",
        "hover:bg-surface-hover focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
        selected && "bg-primary-50 ring-primary-600 ring-2 ring-offset-1",
      )}
    >
      <svg viewBox="0 0 40 60" className="h-12 w-8" aria-hidden>
        {(patternId || bleedPatternId) && (
          <defs>
            {patternId && paint?.pattern && (
              <CrownPatternDefs kind={paint.pattern} id={patternId} />
            )}
            {/* نقش النزيف عند الجس — نقاط حمراء قصيرة فوق التاج لا لون صريح */}
            {bleedPatternId && (
              <pattern
                id={bleedPatternId}
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx="1.2"
                  cy="1.2"
                  r="0.8"
                  fill="var(--color-danger-500)"
                />
                <circle
                  cx="3.2"
                  cy="3.2"
                  r="0.8"
                  fill="var(--color-danger-500)"
                />
              </pattern>
            )}
          </defs>
        )}
        <g
          transform={flipped ? "rotate(180 20 30)" : undefined}
          className={cn(paint?.faded && "opacity-50")}
        >
          {/* الجذور — عاجية دائماً */}
          <path
            d={tooth.rootPath}
            fill="var(--color-tooth-enamel)"
            stroke="var(--color-tooth-line-soft)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* التاج — يُلوّن بالحالة كاملاً، أو بالأسطح المصابة حصراً */}
          <path
            d={tooth.crownPath}
            fill={
              partial
                ? "var(--color-tooth-enamel)"
                : paint
                  ? paint.fill
                  : "var(--color-tooth-enamel)"
            }
            stroke={
              perioStroke
                ? perioStroke
                : paint?.dashed
                  ? "var(--color-warning-500)"
                  : "var(--color-tooth-line)"
            }
            strokeWidth={
              perioStroke ? "2" : status && status !== "HEALTHY" ? "1.6" : "1.2"
            }
            strokeLinejoin="round"
            strokeDasharray={paint?.dashed ? "3 2.5" : undefined}
          />
          {partial}
          {bleedPatternId && (
            <path
              d={tooth.crownPath}
              fill={`url(#${bleedPatternId})`}
              stroke="none"
            />
          )}
          {!partial && paint?.pattern && patternId && (
            <path
              d={tooth.crownPath}
              fill={`url(#${patternId})`}
              stroke="none"
            />
          )}
          {paint?.innerRing && (
            <path
              d={tooth.crownPath}
              fill="none"
              stroke="var(--color-warning-700)"
              strokeWidth="1"
              transform="translate(20 18) scale(0.8) translate(-20 -18)"
            />
          )}
          {paint?.faded && (
            <path
              d="M8 10 L32 50 M32 10 L8 50"
              stroke="var(--color-tooth-line)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </g>
      </svg>
      {/* الحرف الدلالي ورقم FDI خارج الرسم — يبقى مقروءاً مع دوران الصف العلوي */}
      <span
        className={cn(
          "text-warm-600 text-[10px] leading-none font-bold",
          !meta || meta.value === "HEALTHY" ? "opacity-0" : "",
        )}
        aria-hidden
      >
        {meta?.icon}
      </span>
      <span className="numeric text-warm-400 text-[9px] leading-none">
        {tooth.fdi}
      </span>
    </button>
  );
}
