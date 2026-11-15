import type { LedgerEntryDto } from "@/lib/services/ledger";
// المعادلة القانونية الوحيدة للرصيد — تُعرَّف مرة واحدة في finance-view.
import { summarizeLedger as summarizeLedgerCanonical } from "@/lib/finance-view";

// دوال عرض مالية نقية لتبويب «الحساب والسجل المالي» في ملف المريض.
// لا فواتير مخزّنة في المخطط — كل قيد رسوم (CHARGE) يُعرض كفاتورة، وتُخصم
// الدفعات عليها ترتيباً زمنياً (الأقدم أولاً) لتُظهر المدفوع والمتبقي وحالة
// الدفع. نقية بالكامل — تُختبر بلا قاعدة بيانات.

export type InvoiceStatus = "PAID" | "PARTIAL" | "UNPAID";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  PAID: "مسددة",
  PARTIAL: "جزئية",
  UNPAID: "غير مسددة",
};

export const INVOICE_STATUS_CHIP: Record<InvoiceStatus, string> = {
  PAID: "border-primary-200 bg-primary-50 text-primary-800",
  PARTIAL: "border-warning-300 bg-warning-50 text-warning-700",
  UNPAID: "border-danger-300 bg-danger-50 text-danger-700",
};

export type InvoiceView = {
  /** رقم الفاتورة — INV-<سنة>-<تسلسل العيادة> بثلاث خانات */
  number: string;
  date: string;
  totalUsd: number;
  paidUsd: number;
  remainingUsd: number;
  status: InvoiceStatus;
};

function timeOf(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * نقي — رقم الفاتورة من تسلسل الرسوم على مستوى العيادة (invoiceSeq عند
 * الإنشاء) كي لا يتكرر الرقم بين مريضين. القيود القديمة بلا تسلسل تُرقَّم
 * بموضعها ضمن قيود المريض كالسابق.
 */
function invoiceNumber(
  charge: Pick<LedgerEntryDto, "invoiceSeq" | "createdAt">,
  fallbackIndex: number,
): string {
  const seq = charge.invoiceSeq ?? fallbackIndex + 1;
  return `INV-${new Date(charge.createdAt).getFullYear()}-${String(seq).padStart(3, "0")}`;
}

/**
 * نقي — فواتير من قيود الرسوم. الاشتقاق القانوني الوحيد هو deriveInvoicesDetailed
 * (الدفعات والتسويات السالبة كلها تُخصم بالتسلسل الزمني) — هذه النسخة تُنزع حقول
 * الخصم وسجل الدفعات فقط كي يبقى المسدد والمتبقي متطابقين في كل مكان يعرض
 * فاتورة: تبويب ملف المريض وقائمة الفواتير وتفاصيلها وصفوف المستحقات.
 */
export function deriveInvoices(
  entries: ReadonlyArray<LedgerEntryDto>,
): InvoiceView[] {
  return deriveInvoicesDetailed(entries).map((invoice) => ({
    number: invoice.number,
    date: invoice.date,
    totalUsd: invoice.totalUsd,
    paidUsd: invoice.paidUsd,
    remainingUsd: invoice.remainingUsd,
    status: invoice.status,
  }));
}

export type PaymentLogKind = "PAYMENT" | "MATERIAL";

export type DetailedInvoiceView = InvoiceView & {
  /** إجمالي الخصومات المخصصة لهذه الفاتورة — تسويات سالبة بقيد الدفتر */
  discountUsd: number;
  /** الدفعات المسجلة المخصصة لهذه الفاتورة بالتسلسل */
  payments: Array<{ date: string; note: string; amountUsd: number }>;
};

/**
 * نقي — الاشتقاق القانوني الوحيد للفاتورة: تخصيص الدفعات والخصومات (تسويات
 * سالبة) على الرسوم بالتسلسل الزمني — الدفعات والخصم كلاهما يخفض المتبقي،
 * لكنهما يُعرضان منفصلين. deriveInvoices يبني عليها بإزاحة حقول العرض فقط.
 */
export function deriveInvoicesDetailed(
  entries: ReadonlyArray<LedgerEntryDto>,
): DetailedInvoiceView[] {
  const charges = entries
    .filter((e) => e.type === "CHARGE")
    .sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));

  // رصيد التخفيض: الدفعات بقيمها المطلقة والتسويات السالبة (خصم) — بالترتيب الزمني
  type Credit = {
    amount: number;
    isDiscount: boolean;
    time: number;
    date: string;
    note: string;
  };
  const dateOf = (value: LedgerEntryDto["createdAt"]) =>
    value instanceof Date ? value.toISOString() : String(value);
  const credits: Credit[] = [
    ...entries
      .filter((e) => e.type === "PAYMENT")
      .map((e) => ({
        amount: Math.abs(e.amountUsd),
        isDiscount: false,
        time: timeOf(e.createdAt),
        date: dateOf(e.createdAt),
        note: e.note ?? "",
      })),
    ...entries
      .filter((e) => e.type === "ADJUSTMENT" && e.amountUsd < 0)
      .map((e) => ({
        amount: Math.abs(e.amountUsd),
        isDiscount: true,
        time: timeOf(e.createdAt),
        date: dateOf(e.createdAt),
        note: e.note ?? "",
      })),
  ].sort((a, b) => a.time - b.time);

  let cursor = 0;
  return charges.map((charge, index) => {
    let paidUsd = 0;
    let discountUsd = 0;
    let remaining = charge.amountUsd;
    const payments: DetailedInvoiceView["payments"] = [];
    while (cursor < credits.length && remaining > 0) {
      const take = Math.min(credits[cursor].amount, remaining);
      if (credits[cursor].isDiscount) discountUsd += take;
      else {
        paidUsd += take;
        payments.push({
          date: credits[cursor].date,
          note: credits[cursor].note,
          amountUsd: take,
        });
      }
      credits[cursor].amount -= take;
      remaining -= take;
      if (credits[cursor].amount === 0) cursor += 1;
    }
    const status: InvoiceStatus =
      remaining === 0 ? "PAID" : paidUsd + discountUsd > 0 ? "PARTIAL" : "UNPAID";
    return {
      number: invoiceNumber(charge, index),
      date:
        charge.createdAt instanceof Date
          ? charge.createdAt.toISOString()
          : String(charge.createdAt),
      totalUsd: charge.amountUsd,
      paidUsd,
      discountUsd,
      remainingUsd: remaining,
      status,
      payments,
    };
  });
}

export type PaymentLogRow = {
  date: string;
  /** الوصف — ملاحظة الدفعة أو اسم المادة المستهلكة */
  description: string;
  /** المبلغ بالدولار المعروض — الدفعة سالبة والاستهلاك موجب بتكلفته */
  amountUsd: number;
  kind: PaymentLogKind;
};

export type LedgerSummary = {
  /** مجموع قيود الرسوم — الإجمالي في بطاقة الملخص المالي */
  chargesUsd: number;
  /** مجموع الدفعات بقيمها المطلقة */
  paidUsd: number;
  /** الرصيد — رسوم ناقص دفعات وتسويات (خصم) */
  balanceUsd: number;
};

/** نقي — ملخص الدفتر المالي: رسوم ودفعات ورصيد بلا فواتير.
 * الرصيد يُحسب بالمعادلة القانونية الوحيدة (Σ المبالغ الموقّعة — نفس معادلة
 * computeBalance في الخدمة وfinance-view) حتى يطابق بطاقة المريض لوحة الفواتير
 * بعد أي استرداد — لا معادلة ثانية للرصيد في المشروع. */
export function summarizeLedger(
  entries: ReadonlyArray<LedgerEntryDto>,
): LedgerSummary {
  const canonical = summarizeLedgerCanonical(entries);
  return {
    chargesUsd: canonical.chargesUsd,
    paidUsd: canonical.paymentsUsd,
    balanceUsd: canonical.balanceUsd,
  };
}

/** نقي — سجل الدفعات/المخزون: دفعات الدفتر + استهلاك المواد للمريض */
export function buildPaymentLog(
  entries: ReadonlyArray<LedgerEntryDto>,
  materialRows: ReadonlyArray<{
    createdAt: Date | string;
    materialName: string;
    costUsd: number;
  }>,
): PaymentLogRow[] {
  const rows: PaymentLogRow[] = [
    ...entries
      .filter((e) => e.type === "PAYMENT")
      .map((e) => ({
        date:
          e.createdAt instanceof Date
            ? e.createdAt.toISOString()
            : String(e.createdAt),
        description: e.note ?? "دفعة مسددة",
        amountUsd: e.amountUsd,
        kind: "PAYMENT" as const,
      })),
    ...materialRows.map((row) => ({
      date:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      description: `مخزون: ${row.materialName}`,
      amountUsd: row.costUsd,
      kind: "MATERIAL" as const,
    })),
  ];
  return rows.sort((a, b) => timeOf(b.date) - timeOf(a.date));
}
