import type { LedgerEntryType } from "@/lib/services/ledger";
import type { BadgeTone } from "@/components/ui/Badge";

// بيانات عرض الدفتر المالي — نقية بلا I/O. نوع الاستيراد من الخدمة فقط
// (type-only) فلا يُسحب أي كود خادم إلى حزمة المتصفح، مثل بقية بيانات العرض.

export type LedgerEntryLike = {
  type: LedgerEntryType;
  amountUsd: number;
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
  entries: ReadonlyArray<{ amountUsd: number }>,
): number[] {
  const balances: number[] = [];
  let running = 0;
  for (const entry of entries) {
    running += entry.amountUsd;
    balances.push(running);
  }
  return balances;
}

export type LedgerSummary = {
  chargesUsd: number;
  paymentsUsd: number;
  refundsUsd: number;
  adjustmentsNetUsd: number;
  /** الرصيد الكلي = Σ القيود الموقّعة — نفس معادلة الخدمة */
  balanceUsd: number;
};

/** نقي — ملخص دفتر من القيود كما هي، بلا أي إعادة تفسير للحساب المالي */
export function summarizeLedger(
  entries: ReadonlyArray<LedgerEntryLike>,
): LedgerSummary {
  let chargesUsd = 0;
  let paymentsUsd = 0;
  let refundsUsd = 0;
  let adjustmentsNetUsd = 0;
  let balanceUsd = 0;
  for (const entry of entries) {
    balanceUsd += entry.amountUsd;
    if (entry.type === "CHARGE") {
      chargesUsd += entry.amountUsd;
    } else if (entry.type === "PAYMENT") {
      paymentsUsd += Math.abs(entry.amountUsd);
    } else if (entry.type === "REFUND") {
      refundsUsd += entry.amountUsd;
    } else {
      adjustmentsNetUsd += entry.amountUsd;
    }
  }
  return {
    chargesUsd,
    paymentsUsd,
    refundsUsd,
    adjustmentsNetUsd,
    balanceUsd,
  };
}

/** نقي — ترتيب القيود تصاعدياً زمنياً للرصيد الجاري (الأحدث تُجلب من الخدمة أولاً) */
export function sortEntriesAsc<T extends { createdAt: string | Date }>(
  entries: ReadonlyArray<T>,
): T[] {
  return [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/**
 * نقي — المستحقات غير المسددة عبر المرضى: مجمع أرصدة المرضى الموجبة حصراً،
 * فلا يُحاسَب زائد دفع مريض على عجز مريض آخر. أساس بطاقة التنبيه المثبتة
 * في الشريط الجانبي وبطاقة إحصاء المستحقات في لوحة القيادة.
 */
export function outstandingDuesUsd(
  entries: ReadonlyArray<{ patientId: string; amountUsd: number }>,
): number {
  const perPatient = new Map<string, number>();
  for (const entry of entries) {
    perPatient.set(
      entry.patientId,
      (perPatient.get(entry.patientId) ?? 0) + entry.amountUsd,
    );
  }
  let dues = 0;
  for (const balance of perPatient.values()) {
    if (balance > 0) dues += balance;
  }
  return dues;
}

/**
 * نقي — عدد المرضى ذوي رصيد موجب (عليهم مستحقات) — شارة عنصر «المستحقات»
 * في التنقل حتى تبقى إشارة المستحقات ظاهرة حتى مع الشريط المطوي.
 */
export function patientsWithDuesCount(
  entries: ReadonlyArray<{ patientId: string; amountUsd: number }>,
): number {
  const perPatient = new Map<string, number>();
  for (const entry of entries) {
    perPatient.set(
      entry.patientId,
      (perPatient.get(entry.patientId) ?? 0) + entry.amountUsd,
    );
  }
  let count = 0;
  for (const balance of perPatient.values()) {
    if (balance > 0) count += 1;
  }
  return count;
}


// ─── حالة السداد (الهيكل المرجعي) ───────────────────────────────────────────
// تصنيف عرض فقط يُشتق نقياً من الرصيد الجاري لكل مريض — لا يخزَّن ولا يغيّر
// أي منطق مالي في الخدمة.

export type SettlementKey = "settled" | "partial" | "unsettled";

export const LEDGER_SETTLEMENT_META: Record<
  SettlementKey,
  { label: string; tone: BadgeTone }
> = {
  settled: { label: "مسدد", tone: "success" },
  partial: { label: "جزئي", tone: "warning" },
  unsettled: { label: "غير مسدد", tone: "danger" },
};

/**
 * نقي — حالة سداد قيد رسوم: الرصيد الجاري للمريض بعد هذا القيد يحدّها —
 * رصيد مسدَّد كلياً يعني تغطيتها بالدفعات المسجلة حتى ذلك الحين، ورصيد
 * أقل من قيمة القيد يعني تغطية جزئية.
 */
export function settlementOfCharge(
  balanceAfter: number,
  amountUsd: number,
): SettlementKey {
  if (balanceAfter <= 0) return "settled";
  if (balanceAfter < amountUsd) return "partial";
  return "unsettled";
}

/**
 * نقي — تقسيم قيد رسوم إلى المسدد والمتبقي من رصيد المريض بعده مباشرة:
 * المتبقي = max(الرصيد بعده، 0) والمسدد = قيمة القيد − المتبقي. أساس عمودَي
 * «المسدد/المتبقي» في جدول الفواتير بصف المرجع.
 */
export function chargeSettlementSplit(
  balanceAfter: number,
  amountUsd: number,
): { paidUsd: number; remainingUsd: number } {
  // المتبقي من هذا القيد تحديداً لا يتجاوز قيمته — الدفعات الأقدم غطت ما سبقه.
  const remainingUsd = Math.min(Math.max(balanceAfter, 0), amountUsd);
  return { paidUsd: amountUsd - remainingUsd, remainingUsd };
}

/**
 * نقي — الرصيد الجاري بعد كل قيد، محسوباً لكل مريض على حدة بترتيبها
 * الزمني التصاعدي. يعيد خريطة من معرّف القيد إلى رصيد مريضه بعده.
 */
export function runningBalancesByPatient(
  entries: ReadonlyArray<{
    id: string;
    patientId: string;
    amountUsd: number;
    createdAt: string | Date;
  }>,
): Map<string, number> {
  const byPatient = new Map<
    string,
    Array<{ id: string; amountUsd: number; createdAt: string | Date }>
  >();
  for (const entry of entries) {
    const list = byPatient.get(entry.patientId) ?? [];
    list.push({
      id: entry.id,
      amountUsd: entry.amountUsd,
      createdAt: entry.createdAt,
    });
    byPatient.set(entry.patientId, list);
  }
  const after = new Map<string, number>();
  for (const list of byPatient.values()) {
    const ordered = sortEntriesAsc(list);
    const balances = runningBalances(ordered);
    ordered.forEach((entry, index) => after.set(entry.id, balances[index]));
  }
  return after;
}

export type SettlementFilter = "ALL" | SettlementKey;

export type LedgerRowView<T> = {
  entry: T;
  /** الرصيد الجاري في الدفتر كله بعد هذا القيد */
  balance: number;
  /** رصيد مريض القيد بعده مباشرة — أساس التسديد التفضلي */
  patientBalanceAfter: number;
  /** حالة السداد — null لغير القيود المالية المباشرة (تصحيح/استرداد) */
  settlement: SettlementKey | null;
};

/**
 * نقي — بناء صفوف عرض الدفتر: رصيدان (عام ولكل مريض) وحالة سداد لكل قيد.
 * القيد الدفعة يُعدّ مسدداً بحكم تعريفه، والتصحيح والاسترداد بلا حالة سداد.
 */
export function buildLedgerRows<
  T extends {
    id: string;
    patientId: string;
    type: LedgerEntryType;
    amountUsd: number;
    createdAt: string | Date;
  },
>(entries: readonly T[]): Array<LedgerRowView<T>> {
  const asc = sortEntriesAsc(entries);
  const clinicBalances = runningBalances(asc);
  const patientBalances = runningBalancesByPatient(asc);
  return asc
    .map((entry, index) => {
      const patientBalanceAfter = patientBalances.get(entry.id) ?? 0;
      const settlement =
        entry.type === "PAYMENT"
          ? "settled"
          : entry.type === "CHARGE"
            ? settlementOfCharge(patientBalanceAfter, entry.amountUsd)
            : null;
      return {
        entry,
        balance: clinicBalances[index],
        patientBalanceAfter,
        settlement,
      };
    })
    .reverse();
}

/** نقي — تصفية صفوف الدفتر بحالة السداد — null يظهر تحت الكل حصراً */
export function filterBySettlement<T extends { settlement: SettlementKey | null }>(
  rows: readonly T[],
  filter: SettlementFilter,
): T[] {
  if (filter === "ALL") return [...rows];
  return rows.filter((row) => row.settlement === filter);
}

/** نقي — بحث زبوني باسم المريض أو البيان فوق صفوف الدفتر */
export function searchLedgerRows<T extends { entry: { patientName: string; note: string | null } }>(
  rows: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter(
    ({ entry }) =>
      entry.patientName.toLowerCase().includes(needle) ||
      (entry.note ?? "").toLowerCase().includes(needle),
  );
}
