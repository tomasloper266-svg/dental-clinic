import { describe, expect, it } from "vitest";
import {
  composePaymentNote,
  deriveClinicInvoices,
  filterInvoicesByStatus,
  formatUsdSpaced,
  INVOICE_FILTER_LABELS,
  searchInvoices,
  summarizeInvoices,
  type ClinicInvoiceRow,
} from "@/lib/invoices-view";
import type { ClinicLedgerEntryDto } from "@/lib/services/ledger";

// عينة قيود — مريضان: أحمد (فاتورتان إحداهما مسددة) ورياض (فاتورة جزئية)
function entry(
  overrides: Partial<ClinicLedgerEntryDto> & {
    id: string;
    type: "CHARGE" | "PAYMENT" | "ADJUSTMENT" | "REFUND";
    amountUsd: number;
    patientId: string;
  },
): ClinicLedgerEntryDto {
  return {
    patientName: overrides.patientId === "p1" ? "أحمد الخطيب" : "رياض الأكرم",
    patientPhone: null,
    note: null,
    treatmentItemId: null,
    invoiceSeq: null,
    doctorId: null,
    appliedChargeId: null,
    createdAt: new Date("2026-11-14T10:00:00Z"),
    items: [],
    ...overrides,
  };
}

const SAMPLE: ClinicLedgerEntryDto[] = [
  entry({
    id: "c1",
    type: "CHARGE",
    amountUsd: 525000,
    patientId: "p1",
    createdAt: new Date("2026-11-10T09:00:00Z"),
  }),
  entry({
    id: "c2",
    type: "CHARGE",
    amountUsd: 70000,
    patientId: "p1",
    createdAt: new Date("2026-11-12T09:00:00Z"),
  }),
  entry({
    id: "m1",
    type: "PAYMENT",
    amountUsd: -70000,
    patientId: "p1",
    createdAt: new Date("2026-11-13T09:00:00Z"),
  }),
  entry({
    id: "c3",
    type: "CHARGE",
    amountUsd: 525000,
    patientId: "p2",
    createdAt: new Date("2026-11-11T09:00:00Z"),
  }),
  entry({
    id: "m2",
    type: "PAYMENT",
    amountUsd: -262500,
    patientId: "p2",
    createdAt: new Date("2026-11-13T12:00:00Z"),
  }),
];

function invoiceNumbers(rows: ClinicInvoiceRow[]): string[] {
  return rows.map((row) => row.number);
}

describe("deriveClinicInvoices", () => {
  it("يُرجع كل الفواتير مرتبة بالتاريخ تنازلياً (الأحدث أولاً)", () => {
    const rows = deriveClinicInvoices(SAMPLE);
    expect(rows).toHaveLength(3);
    // p1 c2 (2026-11-12) ثم p2 c3 (2026-11-11) ثم p1 c1 (2026-11-10)
    expect(invoiceNumbers(rows)[0]).toContain("-002");
  });

  it("يمنح كل مريض تسلسلاً مستقلاً يبدأ من 001", () => {
    const rows = deriveClinicInvoices(SAMPLE);
    const p1 = rows.filter((row) => row.patientId === "p1");
    expect(p1.map((row) => row.number)).toEqual([
      "INV-2026-002",
      "INV-2026-001",
    ]);
    const p2 = rows.filter((row) => row.patientId === "p2");
    expect(p2[0].number).toBe("INV-2026-001");
  });

  it("يشتق حالات السداد وفق توزيع الدفعات زمنياً (FIFO)", () => {
    const rows = deriveClinicInvoices(SAMPLE);
    const byCharge = (chargeId: string) =>
      rows.find((row) => row.chargeId === chargeId)!;
    // الدفعة الأولى (70000) تخصص لأقدم فاتورة c1 فتصبح جزئية،
    // وc2 تبقى غير مسددة، وc3 جزئية بدفعتها الخاصة
    expect(byCharge("c1").status).toBe("PARTIAL");
    expect(byCharge("c2").status).toBe("UNPAID");
    expect(byCharge("c3").status).toBe("PARTIAL");
  });

  it("يربط كل صف باسم مريضه ومعرّف قيد الرسوم", () => {
    const rows = deriveClinicInvoices(SAMPLE);
    const byCharge = (chargeId: string) =>
      rows.find((row) => row.chargeId === chargeId)!;
    expect(byCharge("c3").patientName).toBe("رياض الأكرم");
    expect(byCharge("c1").patientId).toBe("p1");
  });
});

describe("filterInvoicesByStatus", () => {
  it("ALL يُرجع الكل، وغيره يُرجع الحالة المطلوبة فقط", () => {
    const rows = deriveClinicInvoices(SAMPLE);
    expect(filterInvoicesByStatus(rows, "ALL")).toHaveLength(3);
    const unpaid = filterInvoicesByStatus(rows, "UNPAID");
    expect(unpaid).toHaveLength(1);
    expect(unpaid[0].status).toBe("UNPAID");
    expect(filterInvoicesByStatus(rows, "PARTIAL")).toHaveLength(2);
    expect(filterInvoicesByStatus(rows, "PAID")).toHaveLength(0);
  });
});

describe("searchInvoices", () => {
  it("يطابق رقم الفاتورة أو اسم المريض بتجاهل الحالة والفراغات", () => {
    const rows = deriveClinicInvoices(SAMPLE);
    expect(searchInvoices(rows, "inv-2026-002")).toHaveLength(1);
    expect(searchInvoices(rows, "أحمد")).toHaveLength(2);
    expect(searchInvoices(rows, "  رياض ")).toHaveLength(1);
    expect(searchInvoices(rows, "غير موجود")).toHaveLength(0);
    expect(searchInvoices(rows, "")).toHaveLength(3);
  });
});

describe("summarizeInvoices", () => {
  it("يجمع العدد والإجمالي والمتبقي من الصفوف المعطاة", () => {
    const rows = deriveClinicInvoices(SAMPLE);
    const summary = summarizeInvoices(rows);
    expect(summary.count).toBe(3);
    expect(summary.totalUsd).toBe(1120000);
    // المسدد 70000 + 262500 = 332500 → المتبقي 787500
    expect(summary.remainingUsd).toBe(1120000 - 332500);
  });
});

describe("formatUsdSpaced", () => {
  it("يضيف مسافة بعد الرمز على شكل المرجع", () => {
    expect(formatUsdSpaced(35)).toBe("$ 35");
    expect(formatUsdSpaced(4850)).toBe("$ 4,850");
  });
});

describe("composePaymentNote", () => {
  it("يلحق طريقة الدفع بالملاحظة، ويتحمل غياب الملاحظة", () => {
    expect(composePaymentNote("نقدا", "")).toBe("دفعة نقدا");
    expect(composePaymentNote("شيك", " شيك رقم 112 ")).toBe(
      "دفعة شيك — شيك رقم 112",
    );
  });
});

describe("INVOICE_FILTER_LABELS", () => {
  it("تطابق نصوص المرجع حرفياً", () => {
    expect(INVOICE_FILTER_LABELS.ALL).toBe("الكل");
    expect(INVOICE_FILTER_LABELS.UNPAID).toBe("غير مسددة");
    expect(INVOICE_FILTER_LABELS.PARTIAL).toBe("جزئية");
    expect(INVOICE_FILTER_LABELS.PAID).toBe("مسددة");
  });
});
