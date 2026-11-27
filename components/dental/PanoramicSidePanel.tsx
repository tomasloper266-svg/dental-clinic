"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import {
  findingsForTooth,
} from "@/lib/odontogram/findings-view";
import { toothQuadrant, toothName, quadrantLabel } from "@/lib/odontogram/fdi";
import { findingKindLabel, toothStatusMeta, toothStatusLabel } from "@/lib/odontogram/statuses";
import { formatDateCell } from "@/lib/dates";
import { formatUsd } from "@/lib/currency";
import type { FindingDto } from "@/lib/services/findings";
import type { PlanItemDto, PlanItemStatus } from "@/lib/services/treatment-plan";
import { STATUS_META } from "@/components/odontogram/TreatmentPlanSection";

// لوح العرض البانورامي الجانبي — بطاقتان للعرض فقط: السن المختار (الاسم والربع
// والحالة وآخر قيود السجل) وخلاصة خطة العلاج إن وُجدت بنود. لا كتابة هنا —
// التسجيل يبقى في ToothRecordPanel داخل الـDrawer المشترك.

type Props = {
  selectedTooth: number | null;
  findings: FindingDto[];
  latest: Map<number, FindingDto>;
  /** بنود خطة العلاج القائمة — غيابها أو فراغها يعني بطاقة «لا خطة بعد» */
  planItems?: PlanItemDto[];
};

/** بطاقة السن المختار — تختفي الحالة إن كان سليمًا بلا قيود */
function SelectedToothCard({
  selectedTooth,
  findings,
  latest,
}: {
  selectedTooth: number;
  findings: FindingDto[];
  latest: Map<number, FindingDto>;
}) {
  const { t, locale } = useI18n();
  const name = toothName(locale, selectedTooth) ?? "";
  const quadrant = toothQuadrant(selectedTooth);
  const current = latest.get(selectedTooth);
  const currentMeta = current ? toothStatusMeta(current.status) : null;
  // السجل المختصر — آخر ثلاث قيود بالأحدث أولاً (findingsForTooth تصاعدي أصلاً)
  const briefHistory = findingsForTooth(findings, selectedTooth)
    .slice(-3)
    .reverse();

  return (
    <div className="border-warm-200 bg-surface-raised rounded-panel border p-3">
      <h3 className="text-ink-900 text-sm font-semibold">
        {t("common.tooth")} <span className="numeric text-primary-600">{selectedTooth}</span> —{" "}
        {name}
      </h3>
      <p className="text-warm-500 mt-0.5 text-xs">
        {quadrant ? t("dental.quadrantPrefix", { quadrant: quadrantLabel(locale, quadrant) }) : ""}
      </p>
      <p className="mt-2 text-xs">
        <span className="text-warm-500">{t("appointments.currentStatus")} </span>
        {currentMeta ? (
          <span className="text-ink-900 font-medium">{toothStatusLabel(locale, currentMeta.value)}</span>
        ) : (
          <span className="text-warm-500">{t("dental.healthyNoRecords")}</span>
        )}
      </p>

      {briefHistory.length > 0 && (
        <div className="border-warm-200 mt-3 border-t pt-2">
          <p className="text-warm-500 mb-1 text-[11px] font-medium">
            {t("dental.latestRecord")}
          </p>
          <ul className="space-y-1">
            {briefHistory.map((finding) => (
              <li
                key={finding.id}
                className="text-warm-600 flex items-center justify-between gap-2 text-[11px]"
              >
                <span>
                  {findingKindLabel(finding.kind)} —{" "}
                  {toothStatusLabel(locale, finding.status)}
                </span>
                <span className="numeric shrink-0">
                  {formatDateCell(finding.recordedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** خلاصة خطة العلاج — عدّ البنود بحالتها وإجمالي التكلفة التقديرية */
function PlanSummaryCard({ planItems }: { planItems: PlanItemDto[] }) {
  const { t } = useI18n();
  if (planItems.length === 0) {
    return (
      <div className="border-warm-200 bg-surface-raised rounded-panel border p-3">
        <h3 className="text-ink-900 text-sm font-semibold">{t("plans.thePlan")}</h3>
        <p className="text-warm-500 mt-1 text-xs">
          {t("plans.noItemsForPatient")}
        </p>
      </div>
    );
  }

  const byStatus = { PROPOSED: 0, ACCEPTED: 0, DONE: 0 } as Record<
    PlanItemStatus,
    number
  >;
  let totalUsd = 0;
  for (const item of planItems) {
    byStatus[item.status] += 1;
    totalUsd += item.priceUsd;
  }

  return (
    <div className="border-warm-200 bg-surface-raised rounded-panel border p-3">
      <h3 className="text-ink-900 text-sm font-semibold">{t("plans.summary")}</h3>
      <ul className="mt-2 space-y-1">
        {(Object.keys(byStatus) as PlanItemStatus[]).map((status) => (
          <li
            key={status}
            className="text-warm-600 flex items-center justify-between text-[11px]"
          >
            <span>{t(STATUS_META[status].labelKey)}</span>
            <span className="numeric">{byStatus[status]}</span>
          </li>
        ))}
      </ul>
      <p className="border-warm-200 mt-2 flex items-center justify-between border-t pt-2 text-xs">
        <span className="text-warm-500">{t("invoices.itemsTotalPrefix")}{planItems.length})</span>
        <span className="numeric text-ink-900 font-semibold">
          {formatUsd(totalUsd)}
        </span>
      </p>
    </div>
  );
}

export default function PanoramicSidePanel({
  selectedTooth,
  findings,
  latest,
  planItems,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {selectedTooth !== null ? (
        <SelectedToothCard
          selectedTooth={selectedTooth}
          findings={findings}
          latest={latest}
        />
      ) : (
        <div className="border-warm-300 rounded-panel border border-dashed p-3">
          <p className="text-warm-500 text-xs">
            {t("dental.panoramicClickHint")}
          </p>
        </div>
      )}
      <PlanSummaryCard planItems={planItems ?? []} />
    </div>
  );
}
