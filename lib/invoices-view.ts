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
  totalUsd: number;
  /** مجموع المتبقي عليها */
  remainingUsd: number;
};

/** نقي — مجاميع بطاقات الإحصاء الثلاث من الصفوف بعد الفلاتر */
export function summarizeInvoices(
  rows: ReadonlyArray<Pick<DetailedInvoiceView, "totalUsd" | "remainingUsd">>,
): InvoiceSummary {
  let totalUsd = 0;
  let remainingUsd = 0;
  for (const row of rows) {
    totalUsd += row.totalUsd;
    remainingUsd += row.remainingUsd;
  }
  return { count: rows.length, totalUsd, remainingUsd };
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

/** بند فاتورة مهيكل بالصيغة التي يفهمها مسار الدفتر — الوصف إلزامي والتصنيف نص حر */
export type InvoiceItemPayload = {
  description: string;
  category?: string;
  amountUsd: number;
};

/**
 * نقي — جسم طلب قيد رسوم واحد ببنود مهيكلة (فجوة 2 في الواجهة): مبلغ القيد هو
 * مجموع البنود حصراً، فتأخذ الفاتورة متعددة البنود رقماً واحداً من تسلسل
 * العيادة وتُصنَّف بنودها في تجميع الإيراد حسب نوع العلاج.
 */
export function buildChargeWithItemsBody({
  items,
  note,
  createdAt,
}: {
  items: ReadonlyArray<InvoiceItemPayload>;
  note?: string;
  createdAt?: string;
}): {
  type: "CHARGE";
  amountUsd: number;
  note?: string;
  createdAt?: string;
  items: InvoiceItemPayload[];
} {
  if (items.length === 0) {
    throw new Error("أدخل بنداً واحداً على الأقل (الإجراء والمبلغ)");
  }
  return {
    type: "CHARGE",
    amountUsd: items.reduce((sum, item) => sum + item.amountUsd, 0),
    ...(note !== undefined ? { note } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    items: items.map((item) => ({
      description: item.description,
      ...(item.category !== undefined ? { category: item.category } : {}),
      amountUsd: item.amountUsd,
    })),
  };
}

/** نقي — وصف بند فاتورة يدوية كما كان يُكتب بالملاحظة: الإجراء مع السن إن وُجد */
export function invoiceItemDescription(
  procedure: string,
  tooth?: string,
): string {
  const trimmedTooth = tooth?.trim();
  return trimmedTooth
    ? `${procedure.trim()} (السن ${trimmedTooth})`
    : procedure.trim();
}

/**
 * نقي — جسم طلب الدفعة: appliedChargeId المختار من قائمة «على الفاتورة» يُرسل
 * في الجسم فعلياً (وليس في الملاحظة حصراً) — ترشيح عرض حصراً لا يدخل في معادلة
 * الرصيد إطلاقاً (التخصيص الزمني FIFO يبقى هو المعتمد محاسبياً).
 */
export function buildPaymentBody({
  amountUsd,
  note,
  createdAt,
  appliedChargeId,
}: {
  amountUsd: number;
  note: string;
  createdAt?: string;
  appliedChargeId?: string;
}): {
  type: "PAYMENT";
  amountUsd: number;
  note: string;
  createdAt?: string;
  appliedChargeId?: string;
} {
  return {
    type: "PAYMENT",
    amountUsd,
    note,
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(appliedChargeId ? { appliedChargeId } : {}),
  };
}

