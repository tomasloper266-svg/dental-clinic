import { describe, expect, it } from "vitest";
import {
  deriveInvoices,
  deriveInvoicesDetailed,
} from "@/lib/patient-finance";
import { deriveClinicInvoices, summarizeInvoices } from "@/lib/invoices-view";
import { summarizeLedger } from "@/lib/finance-view";
import { buildDuesRows } from "@/lib/dues-view";
import type { LedgerEntryDto } from "@/lib/services/ledger";
import type { LedgerEntryType } from "@/lib/services/ledger";

// اتساق المسدد والمتبقي مع التصحيحات — فاتورة واحدة عليها دفعة وتصحيح سالب
// (خصم) يجب أن يظهر لها نفس المتبقي في كل المستهلكين: تبويب ملف المريض
// (deriveInvoices)، قائمة وتفاصيل الفواتير (deriveInvoicesDetailed و
// summarizeInvoices)، رصيد الدفتر القانوني (summarizeLedger)، وصفوف
// المستحقات (buildDuesRows).

function entry(
  id: string,
  type: LedgerEntryType,
  amountUsd: number,
  minutes: number,
): LedgerEntryDto {
  const base = new Date("2026-11-10T08:00:00.000Z").getTime();
  return {
    id,
    patientId: "p1",
    type,
    amountUsd,
    note: null,
    treatmentItemId: null,
    invoiceSeq: type === "CHARGE" ? 1 : null,
    doctorId: null,
    appliedChargeId: null,
    createdAt: new Date(base + minutes * 60_000),
    items: [],
  };
}

/** فاتورة 10,000 عليها دفعة 4,000 وتصحيح سالب 2,000 — المتبقي 4,000 */
const LEDGER: LedgerEntryDto[] = [
  entry("charge", "CHARGE", 10_000, 0),
  entry("payment", "PAYMENT", -4_000, 30),
  entry("adjustment", "ADJUSTMENT", -2_000, 60),
];

describe("اتساق المسدد والمتبقي مع التصحيح", () => {
  it("deriveInvoices وderiveInvoicesDetailed يتوافقان على المسدد والمتبقي", () => {
    const simple = deriveInvoices(LEDGER);
    const detailed = deriveInvoicesDetailed(LEDGER);
    expect(simple).toHaveLength(1);
    expect(detailed).toHaveLength(1);
    expect(simple[0].paidUsd).toBe(4_000);
    expect(simple[0].remainingUsd).toBe(4_000);
    expect(detailed[0].paidUsd).toBe(simple[0].paidUsd);
    expect(detailed[0].remainingUsd).toBe(simple[0].remainingUsd);
    // الخصم يظهر منفصلاً في العرض التفصيلي والمتبقي يخصمه مع الدفعات
    expect(detailed[0].discountUsd).toBe(2_000);
    expect(detailed[0].totalUsd).toBe(simple[0].totalUsd);
  });

  it("حالة السداد تعكس الخصم والدفعة معاً كما في الدفتر", () => {
    const [invoice] = deriveInvoicesDetailed(LEDGER);
    // 4,000 دفعة + 2,000 خصم على فاتورة 10,000 — جزئية
    expect(invoice.status).toBe("PARTIAL");
    expect(invoice.paidUsd + invoice.discountUsd + invoice.remainingUsd).toBe(
      invoice.totalUsd,
    );
  });

  it("رصيد الدفتر القانوني يساوي المتبقي في كل العروض", () => {
    const canonical = summarizeLedger(LEDGER);
    const [invoice] = deriveInvoices(LEDGER);
    expect(canonical.balanceUsd).toBe(4_000);
    expect(invoice.remainingUsd).toBe(canonical.balanceUsd);
  });

  it("مجاميع صفحة الفواتير تجمع نفس المتبقي", () => {
    const rows = deriveClinicInvoices(
      LEDGER.map((e) => ({ ...e, patientName: "مريض", patientPhone: null })),
    );
    const summary = summarizeInvoices(rows);
    expect(summary.remainingUsd).toBe(4_000);
    expect(summary.totalUsd).toBe(10_000);
  });

  it("صف المستحقات يعطي نفس الرصيد والمسدد الكلي = دفعات + خصم", () => {
    const rows = buildDuesRows(
      LEDGER.map((e) => ({
        ...e,
        patientName: "مريض",
        patientPhone: null,
      })),
      new Date("2026-11-14T00:00:00.000Z"),
    );
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.dueUsd).toBe(4_000);
    // المسدد من الرسوم = الدفعة 4,000 + الخصم 2,000
    expect(row.paidUsd).toBe(6_000);
    expect(row.paidUsd + row.dueUsd).toBe(row.chargesUsd);
  });

  it("تصحيح موجب ليس خصماً — يبقى رصيداً على الدفتر خارج تخصيص الفاتورة", () => {
    const withPositiveAdjustment: LedgerEntryDto[] = [
      entry("charge", "CHARGE", 10_000, 0),
      entry("payment", "PAYMENT", -4_000, 30),
      entry("adjustment+", "ADJUSTMENT", 2_000, 60),
    ];
    const [invoice] = deriveInvoicesDetailed(withPositiveAdjustment);
    const canonical = summarizeLedger(withPositiveAdjustment);
    // الفاتورة: متبقيها = القيد ناقص الدفعة حصراً — التصحيح الموجب بلا خصم
    expect(invoice.discountUsd).toBe(0);
    expect(invoice.remainingUsd).toBe(6_000);
    // رصيد الدفتر يعكس التصحيح الموجب كلياً (تصحيح رصيد خارج الفاتورة)
    expect(canonical.balanceUsd).toBe(8_000);
  });
});

describe("انحدار عرض صف الفاتورة مع تسوية سالبة (tc-15)", () => {
  // سيناريو سجل art_yHnC9AAM بند 14: فاتورة 100 عليها تسوية −3 — عمود
  // الخصم يجب أن يظهر كي يتوازن الصف: الإجمالي = المدفوع + الخصم + المتبقي.
  const tc15: LedgerEntryDto[] = [
    entry("charge", "CHARGE", 100, 0),
    entry("adjustment", "ADJUSTMENT", -3, 30),
  ];

  it("تسوية −3 بلا دفعات: 100 = خصم 3 + مدفوع 0 + متبقي 97 والحالة جزئية", () => {
    const [invoice] = deriveInvoicesDetailed(tc15);
    expect(invoice.totalUsd).toBe(100);
    expect(invoice.discountUsd).toBe(3);
    expect(invoice.paidUsd).toBe(0);
    expect(invoice.remainingUsd).toBe(97);
    // المعادلة التي يعرضها صف الجدول — يجب أن تجمع للإجمالي
    expect(invoice.paidUsd + invoice.discountUsd + invoice.remainingUsd).toBe(
      invoice.totalUsd,
    );
    // (ج) مقصود في الكود — لا يُلمس: جزئية مع صفر مدفوعات
    expect(invoice.status).toBe("PARTIAL");
  });

  it("تسوية −3 مع دفعة جزئية 40: 100 = مدفوع 40 + خصم 3 + متبقي 57", () => {
    const withPayment: LedgerEntryDto[] = [
      entry("charge", "CHARGE", 100, 0),
      entry("payment", "PAYMENT", -40, 20),
      entry("adjustment", "ADJUSTMENT", -3, 30),
    ];
    const [invoice] = deriveInvoicesDetailed(withPayment);
    expect(invoice.paidUsd).toBe(40);
    expect(invoice.discountUsd).toBe(3);
    expect(invoice.remainingUsd).toBe(57);
    expect(invoice.paidUsd + invoice.discountUsd + invoice.remainingUsd).toBe(
      invoice.totalUsd,
    );
    expect(invoice.status).toBe("PARTIAL");
  });

  it("فاتورة بلا خصم — عمود الخصم صفر والصف متوازن", () => {
    const noDiscount: LedgerEntryDto[] = [
      entry("charge", "CHARGE", 100, 0),
      entry("payment", "PAYMENT", -40, 20),
    ];
    const [invoice] = deriveInvoicesDetailed(noDiscount);
    expect(invoice.discountUsd).toBe(0);
    expect(invoice.paidUsd + invoice.discountUsd + invoice.remainingUsd).toBe(
      invoice.totalUsd,
    );
  });
});
