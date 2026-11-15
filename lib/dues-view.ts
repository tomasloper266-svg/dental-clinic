import type { LedgerEntryType } from "@/lib/services/ledger";
import { runningBalancesByPatient } from "@/lib/finance-view";

// بيانات عرض صفحة المستحقات — نقية بلا I/O. كل الأرقام تُشتق من قيود الدفتر
// الحالية (listClinicLedgerEntries) بلا أي حساب جديد في الخدمة، ولا يُخزَّن
// شيء. نوع الاستيراد من الخدمة type-only فلا كود خادم في حزمة المتصفح.

export type DuesEntryLike = {
  id: string;
  patientId: string;
  type: LedgerEntryType;
  amountUsd: number;
  createdAt: string | Date;
  patientName: string;
  patientPhone: string | null;
};

export type DuesRowView = {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  /** إجمالي قيود الرسوم (CHARGE) للمريض — عمود «إجمالي الفواتير» */
  chargesUsd: number;
  /** المسدد من الرسوم = الرسوم − الرصيد المستحق */
  paidUsd: number;
  /** الرصيد الجاري الموجب — عمود «الرصيد المستحق» */
  dueUsd: number;
  /** آخر قيد رسوم بقي رصيد المريض بعده موجباً — أساس مدة التأخر */
  lastUnpaidChargeAt: string | null;
  /** أيام التأخر منذ آخر قيد غير مسدد — null إن لم يوجد قيد كهذا */
  overdueDays: number | null;
  /** آخر قيد رسوم (فاتورة) للمريض تاريخاً — سطر «آخر فاتورة» في الجدول */
  lastChargeAt: string | null;
  /** آخر قيد دفعة للمريض تاريخاً — عمود «آخر دفعة» */
  lastPaymentAt: string | null;
};

const DAY_MS = 86_400_000;

function entryTime(createdAt: string | Date): number {
  return new Date(createdAt).getTime();
}

/** نقي — النص الأحدث زمنياً من قيدَين، لأسطر «آخر فاتورة» و«آخر دفعة» */
function latest(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return entryTime(b) > entryTime(a) ? b : a;
}

/**
 * نقي — صفوف المدينين: مريض لكل رصيد جاري موجب حصراً (نفس معادلة
 * outstandingDuesUsd)، مع تفكيك الرسوم/المسدد وآخر قيد رسوم غير مسدد
 * ومدة تأخره بالأيام حتى `now`.
 */
export function buildDuesRows(
  entries: ReadonlyArray<DuesEntryLike>,
  now: Date,
): DuesRowView[] {
  const balanceAfter = runningBalancesByPatient(entries);

  type PatientBuild = {
    name: string;
    phone: string | null;
    balanceUsd: number;
    chargesUsd: number;
    lastUnpaidChargeAt: string | null;
    lastChargeAt: string | null;
    lastPaymentAt: string | null;
  };
  const patients = new Map<string, PatientBuild>();

  for (const entry of entries) {
    const current = patients.get(entry.patientId) ?? {
      name: entry.patientName,
      phone: entry.patientPhone,
      balanceUsd: 0,
      chargesUsd: 0,
      lastUnpaidChargeAt: null,
      lastChargeAt: null,
      lastPaymentAt: null,
    };
    current.balanceUsd += entry.amountUsd;
    if (entry.type === "CHARGE") {
      current.chargesUsd += entry.amountUsd;
      current.lastChargeAt = latest(current.lastChargeAt, String(entry.createdAt));
      if ((balanceAfter.get(entry.id) ?? 0) > 0) {
        current.lastUnpaidChargeAt = latest(
          current.lastUnpaidChargeAt,
          String(entry.createdAt),
        );
      }
    } else if (entry.type === "PAYMENT") {
      current.lastPaymentAt = latest(current.lastPaymentAt, String(entry.createdAt));
    }
    patients.set(entry.patientId, current);
  }

  const rows: DuesRowView[] = [];
  for (const [patientId, p] of patients) {
    if (p.balanceUsd <= 0) continue;
    rows.push({
      patientId,
      patientName: p.name,
      patientPhone: p.phone,
      chargesUsd: p.chargesUsd,
      paidUsd: p.chargesUsd - p.balanceUsd,
      dueUsd: p.balanceUsd,
      lastUnpaidChargeAt: p.lastUnpaidChargeAt,
      lastChargeAt: p.lastChargeAt,
      lastPaymentAt: p.lastPaymentAt,
      overdueDays:
        p.lastUnpaidChargeAt === null
          ? null
          : Math.max(
              0,
              Math.floor((now.getTime() - entryTime(p.lastUnpaidChargeAt)) / DAY_MS),
            ),
    });
  }
  return rows;
}

export type DuesSortKey = "amount" | "name" | "overdue";

/** نقي — ترتيب صفوف المستحقات: المبلغ تنازلياً افتراضياً، أو الاسم، أو الأقدم تأخراً */
export function sortDuesRows(
  rows: readonly DuesRowView[],
  key: DuesSortKey,
): DuesRowView[] {
  const sorted = [...rows];
  if (key === "amount") {
    sorted.sort((a, b) => b.dueUsd - a.dueUsd);
  } else if (key === "overdue") {
    sorted.sort(
      (a, b) => (b.overdueDays ?? -1) - (a.overdueDays ?? -1),
    );
  } else {
    sorted.sort((a, b) => a.patientName.localeCompare(b.patientName, "ar"));
  }
  return sorted;
}

/** نقي — بحث زبوني باسم المريض أو هاتفه فوق صفوف المستحقات */
export function searchDuesRows(
  rows: readonly DuesRowView[],
  query: string,
): DuesRowView[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter(
    (row) =>
      row.patientName.toLowerCase().includes(needle) ||
      (row.patientPhone ?? "").includes(needle),
  );
}

export type DuesSummary = {
  totalDuesUsd: number;
  debtors: number;
  /** أعلى رصيد فردي — صفر إن لا مدينين */
  maxDueUsd: number;
  /** متوسط الرصيد مقيّداً لعدد المدينين — صفر إن لا مدينين */
  avgDueUsd: number;
};

/** نقي — بطاقات الإحصاء الأربع أعلى صفحة المستحقات */
export function summarizeDues(
  rows: ReadonlyArray<{ dueUsd: number }>,
): DuesSummary {
  if (rows.length === 0) {
    return { totalDuesUsd: 0, debtors: 0, maxDueUsd: 0, avgDueUsd: 0 };
  }
  let totalDuesUsd = 0;
  let maxDueUsd = 0;
  for (const row of rows) {
    totalDuesUsd += row.dueUsd;
    if (row.dueUsd > maxDueUsd) maxDueUsd = row.dueUsd;
  }
  return {
    totalDuesUsd,
    debtors: rows.length,
    maxDueUsd,
    avgDueUsd: Math.round(totalDuesUsd / rows.length),
  };
}
