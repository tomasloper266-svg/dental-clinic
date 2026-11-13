import type { LedgerEntryDto, LedgerEntryType } from "@/lib/services/ledger";
import type { PlanItemDto } from "@/lib/services/treatment-plan";

// دوال عرض نقية لدفتر المريض داخل ملفه المتكامل — تسميات الأنواع وربط القيود
// ببنود الخطة عبر treatmentItemId. لا منطق عمل هنا: معادلة الرصيد والتحقق
// يبقيان في الخدمة، وهذه الطبقة للعرض فقط وتُختبر وحدوياً.

export const LEDGER_ENTRY_TYPE_META: Record<
  LedgerEntryType,
  { labelAr: string; chipClass: string }
> = {
  CHARGE: {
    labelAr: "رسوم",
    chipClass: "border-danger-300 bg-danger-50 text-danger-700",
  },
  PAYMENT: {
    labelAr: "دفعة",
    chipClass: "border-primary-200 bg-primary-50 text-primary-800",
  },
  ADJUSTMENT: {
    labelAr: "تسوية",
    chipClass: "border-ink-200 bg-ink-50 text-ink-800",
  },
  REFUND: {
    labelAr: "استرداد",
    chipClass: "border-plum-200 bg-plum-50 text-plum-700",
  },
};

export type LinkedLedgerEntry = LedgerEntryDto & {
  /** بند الخطة المرتبط بالقيد — null للقيود الحرة غير المرتبطة بعلاج */
  planItem: Pick<PlanItemDto, "id" | "toothFdi" | "procedure"> | null;
};

export type PatientLedgerSummary = {
  /** إجمالي قيود الرسوم (CHARGE) */
  chargesSyp: number;
  /** المسدد من الرسوم = الرسوم − الرصيد الجاري الموجب */
  paidSyp: number;
  balanceSyp: number;
};

/**
 * نقي — ملخص مالي مختصر لملف المريض (بطاقة إحصاء الرأس): الرسوم المجمعة،
 * والمسدد منها بعد رصيد جاري موجب، والرصيد كما ورد من الخدمة. بلا I/O.
 */
export function summarizePatientLedger(
  entries: ReadonlyArray<Pick<LedgerEntryDto, "type" | "amountSyp">>,
  balanceSyp: number,
): PatientLedgerSummary {
  let chargesSyp = 0;
  for (const entry of entries) {
    if (entry.type === "CHARGE") chargesSyp += entry.amountSyp;
  }
  const remainingSyp = Math.max(balanceSyp, 0);
  return {
    chargesSyp,
    paidSyp: chargesSyp - remainingSyp,
    balanceSyp,
  };
}

function entryTime(entry: LedgerEntryDto): number {
  return entry.createdAt instanceof Date
    ? entry.createdAt.getTime()
    : new Date(entry.createdAt).getTime();
}

/**
 * القيود مرتبطة ببنود الخطة حسب treatmentItemId ومرتبة الأحدث أولًا للعرض.
 * قيد يشير إلى بند غير موجود يبقى يُعرض بلا رابط — لا يُسقط ولا يُخمَّن.
 * نقية: لا تعدّل المصفوفات المدخلة.
 */
export function ledgerEntriesWithPlan(
  entries: readonly LedgerEntryDto[],
  planItems: readonly PlanItemDto[],
): LinkedLedgerEntry[] {
  const itemById = new Map(
    planItems.map((item) => [item.id, item] as const),
  );
  return [...entries]
    .sort((a, b) => entryTime(b) - entryTime(a))
    .map((entry) => {
      const item = entry.treatmentItemId
        ? itemById.get(entry.treatmentItemId)
        : undefined;
      return {
        ...entry,
        planItem: item
          ? {
              id: item.id,
              toothFdi: item.toothFdi,
              procedure: item.procedure,
            }
          : null,
      };
    });
}
