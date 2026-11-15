"use client";

import { useMemo, useState } from "react";
import {
  upperRowLeftToRight,
  lowerRowLeftToRight,
  toothNameAr,
  QUADRANT_LABEL_AR,
  type ToothCell,
} from "@/lib/odontogram/fdi";
import {
  TOOTH_STATUS_META,
  TOOTH_STATUS_KEYS,
  toothStatusMeta,
} from "@/lib/odontogram/statuses";
import {
  latestFindingByTooth,
  findingsForTooth,
} from "@/lib/odontogram/findings-view";
import { surfaceCodesOf } from "@/lib/odontogram/surfaces";
import type { FindingDto } from "@/lib/services/findings";
import { toothAnatomy } from "@/lib/odontogram/anatomy";
import ToothSvg from "@/components/odontogram/ToothSvg";
import ToothRecordForm from "@/components/odontogram/ToothRecordForm";
import { Drawer } from "@/components/ui/Drawer";
import { cn } from "@/components/ui/cn";

// لوحة الأودوغرام التفاعلية — السن يُنقر لفتح لوحة حالته وسجله الكامل.
// المشاهدات إلحاقية: كل حفظ يضيف قيداً جديداً بتاريخه ولا يستبدل السابق.
// نموذج التسجيل مشترك (ToothRecordForm) مع لوحة المخطط الوطني.
// الهوية البصرية: السن السليم بلا تلوين، والحالات اللافتة وحدها تحمل لوناً
// وأيقونة نصية — التمييز لا يعتمد على اللون وحده.

type Props = {
  patientId: string;
  initialFindings: FindingDto[];
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
  selectedTooth,
  onSelectTooth,
}: Props) {
  const [findings, setFindings] = useState<FindingDto[]>(initialFindings);

  const latest = useMemo(() => latestFindingByTooth(findings), [findings]);

  function appendFinding(finding: FindingDto) {
    // الإلحاق فقط — السجل السابق يبقى محفوظاً في القائمة والتاريخ.
    setFindings((prev) => [...prev, finding]);
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
            return (
              <ToothSvg
                key={cell.fdi}
                tooth={anatomy as NonNullable<ReturnType<typeof toothAnatomy>>}
                meta={meta}
                affectedSurfaces={surfaceCodesOf(current?.surface)}
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

  return (
    <section>
      <div className="rounded-panel border-warm-200 bg-surface-raised border p-4 sm:p-5">
        <h2 className="text-ink-900 text-base font-semibold">مخطط الأسنان</h2>
        <p className="text-warm-500 mt-1 text-xs">
          رسم تشريحي بالترقيم FDI الدائم (11–48) — أرباع المريض كما يواجهها
          الطبيب: قواطع وأنياب وضواحك وأضراس بأشكالها، التيجان تواجه خط الإطباق.
          انقر سناً لعرض حالته وسجله وتسجيل مشاهدة جديدة.
        </p>

        <div className="mt-4 space-y-1">
          <QuadrantLabel>
            {QUADRANT_LABEL_AR[1]} / {QUADRANT_LABEL_AR[2]}
          </QuadrantLabel>
          {renderRow(upperRowLeftToRight())}
          <div
            className="border-warm-300 my-2 border-t border-dashed"
            aria-hidden
          />
          {renderRow(lowerRowLeftToRight())}
          <QuadrantLabel>
            {QUADRANT_LABEL_AR[4]} / {QUADRANT_LABEL_AR[3]}
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
                <span className="font-bold">{meta.icon}</span>
                {meta.labelAr}
              </span>
            );
          })}
        </div>
      </div>

      {/* لوحة تفاصيل السن — جانبية للحفاظ على الأودوغرام مرئياً بجانبها.
          key={selected} يعيد تركيب النموذج عند كل سن — نفس تهيئة الحالة السابقة
          (الحالة من آخر قيد، والأسطح والملاحظة فارغة). */}
      <Drawer
        open={selectedTooth !== null}
        onClose={() => onSelectTooth(null)}
        title={
          selectedTooth !== null
            ? `السن ${selectedTooth} — ${toothNameAr(selectedTooth)}`
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
            kindHeading="نوع القيد الجديد"
          />
        )}
      </Drawer>
    </section>
  );
}
