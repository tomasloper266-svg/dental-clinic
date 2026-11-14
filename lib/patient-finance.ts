import type { LedgerEntryDto } from "@/lib/services/ledger";

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
  /** رقم الفاتورة — INV-<سنة>-<تسلسل المريض> بثلاث خانات */
  number: string;
  date: string;
  totalSyp: number;
  paidSyp: number;
  remainingSyp: number;
  status: InvoiceStatus;
};

function timeOf(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * نقي — فواتير من قيود الرسوم مع تخصيص الدفعات FIFO. القيود وردة بأي ترتيب،
 * والرسوم بالتاريخ التصاعدي تُرقّم تسلسلياً. الدفعات تجاوزت الرسوم تبقى
 * رصيداً مقدماً ولا تظهر فاتورة لها.
 */
export function deriveInvoices(
  entries: ReadonlyArray<LedgerEntryDto>,
): InvoiceView[] {
  const charges = entries
    .filter((e) => e.type === "CHARGE")
    .sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));
  let credit = entries
    .filter((e) => e.type === "PAYMENT")
    .reduce((sum, e) => sum + Math.abs(e.amountSyp), 0);

  return charges.map((charge, index) => {
    const paidSyp = Math.min(credit, charge.amountSyp);
    credit -= paidSyp;
    const remainingSyp = charge.amountSyp - paidSyp;
    const status: InvoiceStatus =
      remainingSyp === 0 ? "PAID" : paidSyp > 0 ? "PARTIAL" : "UNPAID";
    return {
      number: `INV-${new Date(charge.createdAt).getFullYear()}-${String(index + 1).padStart(3, "0")}`,
      date:
        charge.createdAt instanceof Date
          ? charge.createdAt.toISOString()
          : String(charge.createdAt),
      totalSyp: charge.amountSyp,
      paidSyp,
      remainingSyp,
      status,
    };
  });
}

export type PaymentLogKind = "PAYMENT" | "MATERIAL";

export type PaymentLogRow = {
  date: string;
  /** الوصف — ملاحظة الدفعة أو اسم المادة المستهلكة */
  description: string;
  /** المبلغ بالدولار المعروض — الدفعة سالبة والاستهلاك موجب بتكلفته */
  amountSyp: number;
  kind: PaymentLogKind;
};

/** نقي — سجل الدفعات/المخزون: دفعات الدفتر + استهلاك المواد للمريض */
export function buildPaymentLog(
  entries: ReadonlyArray<LedgerEntryDto>,
  materialRows: ReadonlyArray<{
    createdAt: Date | string;
    materialName: string;
    costSyp: number;
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
        amountSyp: e.amountSyp,
        kind: "PAYMENT" as const,
      })),
    ...materialRows.map((row) => ({
      date:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      description: `مخزون: ${row.materialName}`,
      amountSyp: row.costSyp,
      kind: "MATERIAL" as const,
    })),
  ];
  return rows.sort((a, b) => timeOf(b.date) - timeOf(a.date));
}
