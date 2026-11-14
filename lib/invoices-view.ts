import type { BadgeTone } from "@/components/ui/Badge";
import { formatUsd } from "@/lib/currency";
import {
  INVOICE_STATUS_LABELS,
  deriveInvoicesDetailed,
  type DetailedInvoiceView,
  type InvoiceStatus,
} from "@/lib/patient-finance";
import type { ClinicLedgerEntryDto } from "@/lib/services/ledger";

// بيانات عرض صفحة «الفواتير والمدفوعات» — نقية بلا I/O. الفاتورة هنا مشتقة
// من قيود الدفتر (كل قيد رسوم فاتورة)، ومجمّعة لكل مريض كي يبقى ترقيمها
// INV-<سنة>-<تسلسل> متطابقاً مع ملف المريض ومخطط الأسنان.

export type InvoiceFilter = "ALL" | InvoiceStatus;

/** ترتيب الحبوب في شريط الأدوات — الكل ثم غير المسددة فالجزئية فالمسددة */
export const INVOICE_FILTER_ORDER: readonly InvoiceFilter[] = [
  "ALL",
  "UNPAID",
  "PARTIAL",
  "PAID",
];

export const INVOICE_FILTER_LABELS: Record<InvoiceFilter, string> = {
  ALL: "الكل",
  UNPAID: INVOICE_STATUS_LABELS.UNPAID,
  PARTIAL: INVOICE_STATUS_LABELS.PARTIAL,
  PAID: INVOICE_STATUS_LABELS.PAID,
};

/** نبرة شارة حالة الفاتورة — مسددة خضراء وجزئية ذهبية وغير مسددة حمراء */
export const INVOICE_STATUS_TONE: Record<InvoiceStatus, BadgeTone> = {
  PAID: "success",
  PARTIAL: "warning",
  UNPAID: "danger",
};

export type ClinicInvoiceRow = DetailedInvoiceView & {
  /** قيد الرسوم صاحب الفاتورة — للحذف ولفتح التفاصيل */
  chargeId: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
};

function timeOf(value: string | Date): number {
  return new Date(value).getTime();
}

/**
 * نقي — فواتير العيادة كلها مجمّعة لكل مريض (لثبات الترقيم) ثم مرتّبة
 * بالتاريخ تنازلياً كأحدث الفواتير أولاً في الجدول.
 */
export function deriveClinicInvoices(
  entries: ReadonlyArray<ClinicLedgerEntryDto>,
): ClinicInvoiceRow[] {
  const byPatient = new Map<string, ClinicLedgerEntryDto[]>();
  for (const entry of entries) {
    const list = byPatient.get(entry.patientId) ?? [];
    list.push(entry);
    byPatient.set(entry.patientId, list);
  }

  const rows: ClinicInvoiceRow[] = [];
  for (const [patientId, patientEntries] of byPatient) {
    const invoices = deriveInvoicesDetailed(patientEntries);
    // رسوم المريض تصاعدياً — رقم الفاتورة i يقابل القيد رقم i بنفس الترتيب
    const charges = patientEntries
      .filter((entry) => entry.type === "CHARGE")
      .sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));
    invoices.forEach((invoice, index) => {
      const charge = charges[index];
      if (!charge) return;
      rows.push({
        ...invoice,
        chargeId: charge.id,
        patientId,
        patientName: charge.patientName,
        patientPhone: charge.patientPhone,
      });
    });
  }

  return rows.sort((a, b) => timeOf(b.date) - timeOf(a.date));
}

/** نقي — تصفية الفواتير بحالة السداد */
export function filterInvoicesByStatus<T extends { status: InvoiceStatus }>(
  rows: ReadonlyArray<T>,
  filter: InvoiceFilter,
): T[] {
  if (filter === "ALL") return [...rows];
  return rows.filter((row) => row.status === filter);
}

/** نقي — بحث برقم الفاتورة أو اسم المريض، بتجاهل حالة الأحرف والفرق الزائد */
export function searchInvoices<T extends { number: string; patientName: string }>(
  rows: ReadonlyArray<T>,
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter(
    (row) =>
      row.number.toLowerCase().includes(needle) ||
      row.patientName.toLowerCase().includes(needle),
  );
}

export type InvoiceSummary = {
  /** عدد الفواتير بعد الفلاتر */
  count: number;
  /** مجموع الإجمالي المصدر — قبل الخصومات */
  totalSyp: number;
  /** مجموع المتبقي عليها */
  remainingSyp: number;
};

/** نقي — مجاميع بطاقات الإحصاء الثلاث من الصفوف بعد الفلاتر */
export function summarizeInvoices(
  rows: ReadonlyArray<Pick<DetailedInvoiceView, "totalSyp" | "remainingSyp">>,
): InvoiceSummary {
  let totalSyp = 0;
  let remainingSyp = 0;
  for (const row of rows) {
    totalSyp += row.totalSyp;
    remainingSyp += row.remainingSyp;
  }
  return { count: rows.length, totalSyp, remainingSyp };
}

/** مبلغ بالدولار بمسافة بعد الرمز — «$ 35» على شكل المرجع */
export function formatUsdSpaced(usd: number): string {
  return formatUsd(usd).replace("$", "$ ");
}

const PAYMENT_METHODS = ["نقدا", "شيك", "تحويل", "بطاقة"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_OPTIONS: readonly PaymentMethod[] = PAYMENT_METHODS;

/**
 * نقي — بيان الدفعة المخزن في ملاحظة قيد الدفتر: طريقة الدفع تُلحق بالملاحظة
 * كي تظهر في كل عروض الدفتر دون تغيير في المخطط.
 */
export function composePaymentNote(
  method: PaymentMethod,
  note: string,
): string {
  const trimmed = note.trim();
  return trimmed ? `دفعة ${method} — ${trimmed}` : `دفعة ${method}`;
}
