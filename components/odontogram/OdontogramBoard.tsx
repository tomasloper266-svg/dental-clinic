"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useMemo, useState } from "react";
import { upperRowLeftToRight, lowerRowLeftToRight, type ToothCell, toothName, quadrantLabel } from "@/lib/odontogram/fdi";
import { TOOTH_STATUS_META, TOOTH_STATUS_KEYS, toothStatusMeta, toothStatusIcon, toothStatusLabel } from "@/lib/odontogram/statuses";
import {
  latestFindingByTooth,
  findingsForTooth,
} from "@/lib/odontogram/findings-view";
import {
  latestReadingByTooth,
  POCKET_SCALE_COLORS,
  POCKET_SCALE_LABEL_AR,
  POCKET_SCALE_KEYS,
} from "@/lib/odontogram/periodontal-view";
import { surfaceCodesOf } from "@/lib/odontogram/surfaces";
import type { FindingDto } from "@/lib/services/findings";
import type { PeriodontalReadingDto } from "@/lib/services/periodontal";
import { toothAnatomy } from "@/lib/odontogram/anatomy";
import ToothSvg from "@/components/odontogram/ToothSvg";
import ToothRecordForm from "@/components/odontogram/ToothRecordForm";
import PeriodontalSessionForm from "@/components/odontogram/PeriodontalSessionForm";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

// لوحة الأودوغرام التفاعلية — السن يُنقر لفتح لوحة حالته وسجله الكامل.
// المشاهدات إلحاقية: كل حفظ يضيف قيداً جديداً بتاريخه ولا يستبدل السابق.
// نموذج التسجيل مشترك (ToothRecordForm) مع لوحة المخطط الوطني.
// الهوية البصرية: السن السليم بلا تلوين، والحالات اللافتة وحدها تحمل لوناً
// وأيقونة نصية — التمييز لا يعتمد على اللون وحده.

type Props = {
  patientId: string;
  initialFindings: FindingDto[];
  /** قراءات الدواعم الأولية — بدونها تعمل اللوحة بلا تبويب دواعم ولا تلوين */
  initialReadings?: PeriodontalReadingDto[];
  // الاختيار محكوم من الأب (OdontogramWorkbench) ليشاركه قسم خطة العلاج.
  selectedTooth: number | null;
  onSelectTooth: (fdi: number | null) => void;
};

function QuadrantLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-warm-400 py-1 text-center text-[11px] font-medium">
      {children}
    </p>
  );
}

export default function OdontogramBoard({
  patientId,
  initialFindings,
  initialReadings = [],
  selectedTooth,
  onSelectTooth,
}: Props) {
  const { t, locale } = useI18n();
  const [findings, setFindings] = useState<FindingDto[]>(initialFindings);
  const [readings, setReadings] =
    useState<PeriodontalReadingDto[]>(initialReadings);
  const [sessionOpen, setSessionOpen] = useState(false);

  const latest = useMemo(() => latestFindingByTooth(findings), [findings]);
  const latestPerio = useMemo(() => latestReadingByTooth(readings), [readings]);

  function appendFinding(finding: FindingDto) {
    // الإلحاق فقط — السجل السابق يبقى محفوظاً في القائمة والتاريخ.
    setFindings((prev) => [...prev, finding]);
  }

  function appendReading(reading: PeriodontalReadingDto) {
    setReadings((prev) => [...prev, reading]);
  }

  function appendSessionReadings(newReadings: PeriodontalReadingDto[]) {
    setReadings((prev) => [...prev, ...newReadings]);
  }

  function renderRow(cells: ToothCell[]) {
    // المصفوفة مرتبة يسار→يمين بعين الطبيب (18→11 ثم 21→28) — لكن الحاوية
    // ترث dir="rtl" من الصفحة فتعكس ترتيبها البصري؛ نثبّت الاتجاه هنا فقط.
    return (
      <div dir="ltr" className="overflow-x-auto py-1">
        <div className="mx-auto flex w-max gap-0.5">
          {cells.map((cell) => {
            const current = latest.get(cell.fdi);
            const meta = current ? toothStatusMeta(current.status) : null;
            const anatomy = toothAnatomy(cell.fdi);
            const perio = latestPerio.get(cell.fdi);
            return (
              <ToothSvg
                key={cell.fdi}
                tooth={anatomy as NonNullable<ReturnType<typeof toothAnatomy>>}
                meta={meta}
                affectedSurfaces={surfaceCodesOf(current?.surface)}
                periodontal={
                  perio
                    ? {
                        pocketDepthMm: perio.pocketDepthMm,
                        bleeding: perio.bleedingOnProbing,
                      }
                    : null
                }
                selected={selectedTooth === cell.fdi}
                onSelect={onSelectTooth}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const history =
    selectedTooth !== null ? findingsForTooth(findings, selectedTooth) : [];
  const toothReadings =
    selectedTooth !== null
      ? readings.filter((r) => r.toothFdi === selectedTooth)
      : [];

  return (
    <section>
      <div className="rounded-panel border-warm-200 bg-surface-raised border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-ink-900 text-base font-semibold">
              {t("dental.chart")}
            </h2>
            <p className="text-warm-500 mt-1 text-xs">
              {t("odontogram.fdiDescription")}
            </p>
          </div>
          <Button variant="secondary" onClick={() => setSessionOpen(true)}>
            {t("periodontal.sessionMeasure")}
          </Button>
        </div>

        <div className="mt-4 space-y-1">
          <QuadrantLabel>
            {quadrantLabel(locale, 1)} / {quadrantLabel(locale, 2)}
          </QuadrantLabel>
          {renderRow(upperRowLeftToRight())}
          <div
            className="border-warm-300 my-2 border-t border-dashed"
            aria-hidden
          />
          {renderRow(lowerRowLeftToRight())}
          <QuadrantLabel>
            {quadrantLabel(locale, 4)} / {quadrantLabel(locale, 3)}
          </QuadrantLabel>
        </div>

        <div className="border-warm-200 mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1.5 border-t pt-3">
          {TOOTH_STATUS_KEYS.map((key) => {
            const meta = TOOTH_STATUS_META[key];
            return (
              <span
                key={key}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                  meta.chipClass,
                )}
              >
                <span className="font-bold">{toothStatusIcon(locale, meta.value)}</span>
                {toothStatusLabel(locale, meta.value)}
              </span>
            );
          })}
        </div>

        {/* أسطورة مقياس الدواعم — حد ملون + نقش نزيف، التمييز لا يعتمد على اللون وحده */}
        {readings.length > 0 && (
          <div className="border-warm-200 mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1.5 border-t pt-3">
            <span className="text-warm-400 text-[11px] font-semibold">
              {t("periodontal.pocketDepthLabel")}
            </span>
            {POCKET_SCALE_KEYS.map((level) => (
              <span
                key={level}
                className="text-warm-500 inline-flex items-center gap-1.5 text-[11px]"
              >
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-4 rounded-full border-2"
                  style={{ borderColor: POCKET_SCALE_COLORS[level] }}
                />
                {POCKET_SCALE_LABEL_AR[level]}
              </span>
            ))}
            <span className="text-warm-500 inline-flex items-center gap-1.5 text-[11px]">
              <span
                aria-hidden
                className="bg-danger-500 inline-block size-2.5 rounded-full"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, var(--color-danger-500) 1px, transparent 1px)",
                  backgroundSize: "3px 3px",
                  backgroundColor: "var(--color-warm-100)",
                }}
              />
              {t("periodontal.bleedingOnProbing")}
            </span>
          </div>
        )}
      </div>

      {/* لوحة تفاصيل السن — جانبية للحفاظ على الأودوغرام مرئياً بجانبها.
          key={selected} يعيد تركيب النموذج عند كل سن — نفس تهيئة الحالة السابقة
          (الحالة من آخر قيد، والأسطح والملاحظة فارغة). */}
      <Drawer
        open={selectedTooth !== null}
        onClose={() => onSelectTooth(null)}
        title={
          selectedTooth !== null
            ? `${t("dental.toothAria", { fdi: selectedTooth })} — ${toothName(locale, selectedTooth) ?? ""}`
            : ""
        }
        className="max-w-md"
      >
        {selectedTooth !== null && (
          <ToothRecordForm
            key={selectedTooth}
            patientId={patientId}
            fdi={selectedTooth}
            history={history}
            onSaved={appendFinding}
            preselectLatest
            kindHeading={t("finance.newEntryType")}
            readings={toothReadings}
            onReadingSaved={appendReading}
          />
        )}
      </Drawer>

      {/* لوحة جلسة قياس الدواعم الجماعية — موضع واحد لكل سن وتوقيت واحد */}
      <Drawer
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        title={t("periodontal.session")}
        className="max-w-lg"
      >
        <PeriodontalSessionForm
          patientId={patientId}
          readings={readings}
          onSessionSaved={appendSessionReadings}
          onDone={() => setSessionOpen(false)}
        />
      </Drawer>
    </section>
  );
}
