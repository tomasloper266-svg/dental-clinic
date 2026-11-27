"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { toothAnatomy } from "@/lib/odontogram/anatomy";
import { type ToothCell, toothDisplayName, toothName, quadrantLabel } from "@/lib/odontogram/fdi";
import { TOOTH_CHART_FILL, isChartFaded, toothStatusMeta, type ToothStatusKey, toothStatusLabel } from "@/lib/odontogram/statuses";
import type { FindingDto } from "@/lib/services/findings";
import { cn } from "@/components/ui/cn";

// العرض الجدولي — أربعة صفوف بترتيب الرباعات (18→11، 21→28، 48→41، 31→38)
// وكل خلية: أيقونة تاج من التشريح نفسه، رقم FDI بخط Space Grotesk، الاسم،
// وشارة الحالة اللونية من TOOTH_CHART_FILL. النقر يفتح لوحة التسجيل نفسها.

type Props = {
  latest: Map<number, FindingDto>;
  selectedTooth: number | null;
  onSelect: (fdi: number) => void;
};

// صفوف الرباعات بترتيب العرض — كل ربع بأسنانه من الطرف القاطعي أو ضرس العقل
// حسب جهة القراءة (يمين المريض يُقرأ من ضرس العقل نحو المنتصف).
const QUADRANT_ROWS: { quadrant: 1 | 2 | 3 | 4; order: "midline-first" | "midline-last" }[] = [
  { quadrant: 1, order: "midline-last" },
  { quadrant: 2, order: "midline-first" },
  { quadrant: 4, order: "midline-last" },
  { quadrant: 3, order: "midline-first" },
];

function quadrantRowTeeth(
  quadrant: 1 | 2 | 3 | 4,
  order: "midline-first" | "midline-last",
): ToothCell[] {
  const teeth: ToothCell[] = [];
  for (let position = 1; position <= 8; position += 1) {
    const anatomy = toothAnatomy(quadrant * 10 + position);
    if (anatomy) teeth.push(anatomy);
  }
  return order === "midline-first" ? teeth : teeth.reverse();
}

/** شارة حالة السن — نقطة بلون التعبئة (أو متقطعة للمقلوع) مع التسمية. */
function StatusBadge({ status }: { status: ToothStatusKey }) {
  const { locale } = useI18n();
  const meta = toothStatusMeta(status);
  const fill = TOOTH_CHART_FILL[status];
  const faded = isChartFaded(status);
  if (!meta) return null;
  return (
    <span className="text-warm-600 inline-flex items-center gap-1 text-[10px]">
      {fill && !faded ? (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: fill }}
          aria-hidden
        />
      ) : (
        <span
          className="border-warm-400 inline-block h-2 w-2 rounded-full border border-dashed"
          aria-hidden
        />
      )}
      {toothStatusLabel(locale, meta.value)}
    </span>
  );
}

export default function QuadrantTable({
  latest,
  selectedTooth,
  onSelect,
}: Props) {
  const { t, locale } = useI18n();
  return (
    <div className="space-y-3">
      {QUADRANT_ROWS.map(({ quadrant, order }) => {
        const teeth = quadrantRowTeeth(quadrant, order);
        return (
          <div
            key={quadrant}
            className="border-warm-200 rounded-panel border p-2 sm:p-3"
          >
            <p className="text-warm-500 mb-1.5 text-[11px] font-medium">
              {t("dental.quadrant")} {quadrantLabel(locale, quadrant)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {teeth.map((tooth) => {
                const current = latest.get(tooth.fdi);
                const status = current
                  ? toothStatusMeta(current.status)?.value ?? null
                  : null;
                const crown = toothAnatomy(tooth.fdi);
                const fill =
                  status && status !== "HEALTHY" && status !== "WATCH"
                    ? TOOTH_CHART_FILL[status]
                    : undefined;
                return (
                  <button
                    key={tooth.fdi}
                    type="button"
                    onClick={() => onSelect(tooth.fdi)}
                    aria-pressed={selectedTooth === tooth.fdi}
                    aria-label={`${t("dental.toothAria", { fdi: tooth.fdi })} — ${toothName(locale, tooth.fdi) ?? ""}${
                      status && status !== "HEALTHY" ? t("dental.hasRecordedStatus") : ""
                    }`}
                    className={cn(
                      "border-warm-200 bg-surface-raised rounded-field flex w-[74px] flex-col items-center gap-0.5 border p-1.5 transition-colors",
                      "hover:bg-surface-hover focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
                      selectedTooth === tooth.fdi &&
                        "border-primary-600 ring-primary-600 ring-2",
                    )}
                  >
                    <svg
                      viewBox="2 2 36 33"
                      className="h-7 w-8"
                      aria-hidden
                    >
                      <path
                        d={crown?.crownPath}
                        fill={fill ?? "var(--color-tooth-enamel)"}
                        stroke={
                          status && isChartFaded(status)
                            ? "var(--color-warning-500)"
                            : "var(--color-tooth-line)"
                        }
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="numeric text-warm-700 text-xs leading-none font-bold">
                      {tooth.fdi}
                    </span>
                    <span className="text-warm-600 text-center text-[10px] leading-tight">
                      {toothDisplayName(locale, tooth.fdi)}
                    </span>
                    {status ? (
                      <StatusBadge status={status} />
                    ) : (
                      <span className="text-warm-400 text-[10px]">{t("dental.healthy")}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
