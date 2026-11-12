import type { LedgerEntryType } from "@/lib/services/ledger";
import type { BadgeTone } from "@/components/ui/Badge";

// بيانات عرض الدفتر المالي — نقية بلا I/O. نوع الاستيراد من الخدمة فقط
// (type-only) فلا يُسحب أي كود خادم إلى حزمة المتصفح، مثل بقية بيانات العرض.

export type LedgerEntryLike = {
  type: LedgerEntryType;
  amountSyp: number;
  createdAt: string | Date;
};

/** تسمية ونبرة كل نوع قيد — المصدر الوحيد لألوان الدفتر عبر كل العروض */
export const LEDGER_TYPE_META: Record<
  LedgerEntryType,
  { label: string; tone: BadgeTone }
> = {
  CHARGE: { label: "رسوم علاج", tone: "info" },
  PAYMENT: { label: "دفعة", tone: "success" },
  ADJUSTMENT: { label: "تصحيح", tone: "warning" },
  REFUND: { label: "استرداد", tone: "danger" },
};

/** لون نص المبلغ الموقّع حسب النوع — دفعات خضراء واستردادات حمراء */
export const LEDGER_AMOUNT_CLASSES: Record<LedgerEntryType, string> = {
  CHARGE: "text-ink-800",
  PAYMENT: "text-primary-700",
  ADJUSTMENT: "text-warning-700",
  REFUND: "text-danger-700",
};

const ENTRY_DATE_FMT = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** تاريخ ووقت القيد — صيغة عربية موحّدة بأرقام لاتينية للدفتر */
export function formatEntryDate(date: string | Date): string {
  return ENTRY_DATE_FMT.format(new Date(date));
}

/**
 * نقي — الرصيد الجاري التراكمي لكل قيد بترتيبها المعطى (الأقدم أولاً).
 * الرصيد يُحسب من القيود دائماً ولا يُخزَّن — نفس معادلة الرصيد في الخدمة.
 */
export function runningBalances(
  entries: ReadonlyArray<{ amountSyp: number }>,
): number[] {
  const balances: number[] = [];
  let running = 0;
  for (const entry of entries) {
    running += entry.amountSyp;
    balances.push(running);
  }
  return balances;
}

export type LedgerSummary = {
  chargesSyp: number;
  paymentsSyp: number;
  refundsSyp: number;
  adjustmentsNetSyp: number;
  /** الرصيد الكلي = Σ القيود الموقّعة — نفس معادلة الخدمة */
  balanceSyp: number;
};

/** نقي — ملخص دفتر من القيود كما هي، بلا أي إعادة تفسير للحساب المالي */
export function summarizeLedger(
  entries: ReadonlyArray<LedgerEntryLike>,
): LedgerSummary {
  let chargesSyp = 0;
  let paymentsSyp = 0;
  let refundsSyp = 0;
  let adjustmentsNetSyp = 0;
  let balanceSyp = 0;
  for (const entry of entries) {
    balanceSyp += entry.amountSyp;
    if (entry.type === "CHARGE") {
      chargesSyp += entry.amountSyp;
    } else if (entry.type === "PAYMENT") {
      paymentsSyp += Math.abs(entry.amountSyp);
    } else if (entry.type === "REFUND") {
      refundsSyp += entry.amountSyp;
    } else {
      adjustmentsNetSyp += entry.amountSyp;
    }
  }
  return {
    chargesSyp,
    paymentsSyp,
    refundsSyp,
    adjustmentsNetSyp,
    balanceSyp,
  };
}

/** نقي — ترتيب القيود تصاعدياً زمنياً للرصيد الجاري (الأحدث تُجلب من الخدمة أولاً) */
export function sortEntriesAsc<T extends { createdAt: string | Date }>(
  entries: T[],
): T[] {
  return [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}
