"use client";

import { useMemo, useState } from "react";
import { toothAnatomy, type ToothAnatomy } from "@/lib/odontogram/anatomy";
import {
  TOOTH_CHART_LEGEND,
  toothStatusMeta,
} from "@/lib/odontogram/statuses";
import {
  latestFindingByTooth,
  findingsForTooth,
} from "@/lib/odontogram/findings-view";
import type { FindingDto } from "@/lib/services/findings";
import ChartTooth from "./ChartTooth";
import ToothRecordPanel, { toothPanelTitle } from "./ToothRecordPanel";
import { ToothIcon } from "@/components/shell/icons/ToothIcon";
import { Drawer } from "@/components/ui/Drawer";

// بطاقة المخطط الوطني — الفكّان كاملان بترقيم FDI، يمين المريض يميناً كما
// يواجهه الطبيب، مع خط سطح الإطباق بين الفكين ووسام الحالات أسفل البطاقة.
// النقر على أي سن يفتح لوحة تسجيل الحالة (نفس مسار findings في ملف المريض).

type Props = {
  patientId: string;
  initialFindings: FindingDto[];
  onFindingsChanged?: () => void;
};

// رباع فم واحد مرتباً من القاطع المركزي إلى ضرس العقل — محسوبة مرة واحدة
function quadrantTeeth(quadrant: number): ToothAnatomy[] {
  const teeth: ToothAnatomy[] = [];
  for (let position = 1; position <= 8; position += 1) {
    const anatomy = toothAnatomy(quadrant * 10 + position);
    if (anatomy) teeth.push(anatomy);
  }
  return teeth;
}

/** فاصل منتصف الوجه — خط عمودي ذهبي بمعين في وسطه */
function MidDivider() {
  return (
    <div
      className="flex flex-col items-center justify-center self-stretch px-1"
      aria-hidden
    >
      <span className="border-warning-500 grow border-s border-dashed" />
      <span className="bg-warning-500 my-1 h-2 w-2 rotate-45" />
      <span className="border-warning-500 grow border-s border-dashed" />
    </div>
  );
}

export default function DentalChart({
  patientId,
  initialFindings,
  onFindingsChanged,
}: Props) {
  const [findings, setFindings] = useState<FindingDto[]>(initialFindings);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);

  const latest = useMemo(() => latestFindingByTooth(findings), [findings]);

  // رباعات المريض — الترتيب البصري من اليمين: الربع الأيمن (18→11) أولاً في
  // حاوية RTL، ثم الربع الأيسر (21→28) بجوار خط المنتصف.
  const arches = useMemo(
    () => ({
      upperRight: quadrantTeeth(1),
      upperLeft: quadrantTeeth(2),
      lowerRight: quadrantTeeth(4),
      lowerLeft: quadrantTeeth(3),
    }),
    [],
  );

  function handleSaved(finding: FindingDto) {
    setFindings((prev) => [...prev, finding]);
    onFindingsChanged?.();
  }

  const selectedHistory =
    selectedTooth !== null ? findingsForTooth(findings, selectedTooth) : [];

  function renderArch(
    quadrant: ToothAnatomy[],
    label?: string,
    labelPosition: "above" | "below" = "above",
  ) {
    const labelNode = label ? (
      <p className="text-warm-400 py-1 text-center text-[11px] font-medium">
        {label}
      </p>
    ) : null;
    return (
      <div className="flex flex-col items-center">
        {labelPosition === "above" && labelNode}
        <div className="flex items-end gap-0.5">
          {quadrant.map((anatomy) => {
            const current = latest.get(anatomy.fdi);
            const meta = current ? toothStatusMeta(current.status) : null;
            return (
              <ChartTooth
                key={anatomy.fdi}
                tooth={anatomy}
                status={meta?.value ?? null}
                selected={selectedTooth === anatomy.fdi}
                onSelect={setSelectedTooth}
              />
            );
          })}
        </div>
        {labelPosition === "below" && labelNode}
      </div>
    );
  }

  return (
    <section className="rounded-panel border-warm-200 bg-surface-raised border p-4 sm:p-5">
      <header className="flex items-center gap-2">
        <ToothIcon className="text-warning-500 h-5 w-5" aria-hidden />
        <h2 className="text-ink-900 text-base font-semibold">
          مخطط الأسنان الوطني — انقر على أي سن لتسجيل حالة أو إجراء
        </h2>
      </header>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="mx-auto w-max min-w-full">
          {/* الفك العلوي — يمين المريض يميناً في الحاوية RTL */}
          <div className="flex items-start justify-center gap-6">
            {renderArch(arches.upperRight, "يمين المريض")}
            <MidDivider />
            {renderArch(arches.upperLeft, "يسار المريض")}
          </div>

          {/* خط سطح الإطباق بين الفكين */}
          <div className="my-2 flex items-center" aria-hidden>
            <span className="text-warm-400 shrink-0 ps-2 text-[10px]">
              سطح الإطباق
            </span>
            <span className="border-warm-300 grow border-t border-dashed" />
          </div>

          {/* الفك السفلي — الاسم أعلى السن والرقم أسفله، ووسام الربع أسفل الأرقام */}
          <div className="flex items-start justify-center gap-6">
            {renderArch(arches.lowerRight, "يمين المريض", "below")}
            <MidDivider />
            {renderArch(arches.lowerLeft, "يسار المريض", "below")}
          </div>
        </div>
      </div>

      {/* وسام الحالات — نقاط ملونة كما في المرجع */}
      <div className="border-warm-200 mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t pt-3">
        {TOOTH_CHART_LEGEND.map((item) => (
          <span
            key={item.labelAr}
            className="text-warm-600 inline-flex items-center gap-1.5 text-[11px]"
          >
            {item.fill ? (
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.fill }}
                aria-hidden
              />
            ) : (
              <span
                className="border-warm-400 inline-block h-2.5 w-2.5 rounded-full border border-dashed"
                aria-hidden
              />
            )}
            {item.labelAr}
          </span>
        ))}
      </div>

      <Drawer
        open={selectedTooth !== null}
        onClose={() => setSelectedTooth(null)}
        title={selectedTooth !== null ? toothPanelTitle(selectedTooth) : ""}
        className="max-w-md"
      >
        {selectedTooth !== null && (
          <ToothRecordPanel
            patientId={patientId}
            fdi={selectedTooth}
            history={selectedHistory}
            onSaved={handleSaved}
          />
        )}
      </Drawer>
    </section>
  );
}
