import { describe, it, expect } from "vitest";
import {
  buildChargeWithItemsBody,
  buildPaymentBody,
  invoiceItemDescription,
} from "@/lib/invoices-view";

// اختبارات وحدة بناء جسم الطلب ببنود مهيكلة — نقية بلا I/O ولا قاعدة بيانات.
// قاعدة الفجوة 2: مبلغ القيد يجب أن يساوي مجموع بنوده حصراً.

describe("buildChargeWithItemsBody", () => {
  it("يبنى قيداً واحداً بمبلغ يساوي مجموع البنود", () => {
    const body = buildChargeWithItemsBody({
      items: [
        { description: "تبييض ليزر", category: "تبييض ليزر", amountSyp: 60_000 },
        { description: "حشو عصبي", category: "حشو عصبي", amountSyp: 40_000 },
      ],
    });
    expect(body.type).toBe("CHARGE");
    expect(body.amountSyp).toBe(100_000);
    expect(body.items).toHaveLength(2);
  });

  it("يحفظ وصف البند وتصنيفه وترتيب الإدخال كما هو", () => {
    const body = buildChargeWithItemsBody({
      items: [
        { description: "تنظيف عميق (السن 16)", category: "تنظيف عميق", amountSyp: 25_000 },
        { description: "حشو", amountSyp: 15_000 },
      ],
    });
    expect(body.items[0]).toEqual({
      description: "تنظيف عميق (السن 16)",
      category: "تنظيف عميق",
      amountSyp: 25_000,
    });
    expect(body.items[1]).toEqual({ description: "حشو", amountSyp: 15_000 });
  });

  it("يمرر الملاحظة وتاريخ القيد الاختياريين كما هما", () => {
    const body = buildChargeWithItemsBody({
      items: [{ description: "إجراء", amountSyp: 10 }],
      note: "فاتورة — 1 بنود",
      createdAt: "2026-11-14T12:00:00.000Z",
    });
    expect(body.note).toBe("فاتورة — 1 بنود");
    expect(body.createdAt).toBe("2026-11-14T12:00:00.000Z");
  });

  it("يرفض القائمة الفارغة — بند واحد على الأقل إلزامي", () => {
    expect(() => buildChargeWithItemsBody({ items: [] })).toThrow(
      "أدخل بنداً واحداً على الأقل (الإجراء والمبلغ)",
    );
  });
});

describe("invoiceItemDescription", () => {
  it("يلحق السن بالإجراء عندما يوجد", () => {
    expect(invoiceItemDescription("تنظيف عميق", "16")).toBe(
      "تنظيف عميق (السن 16)",
    );
  });

  it("يكفي بالإجراء عندما لا سن أو نص فراغ", () => {
    expect(invoiceItemDescription("تبييض ليزر")).toBe("تبييض ليزر");
    expect(invoiceItemDescription("تبييض ليزر", "  ")).toBe("تبييض ليزر");
  });
});

describe("buildPaymentBody", () => {
  it("يرسل appliedChargeId المختار في الجسم فعلياً — لا ملاحظة حصراً", () => {
    const body = buildPaymentBody({
      amountSyp: -40_000,
      note: "دفعة نقدا — سداد الفاتورة INV-2026-036",
      createdAt: "2026-11-14T12:00:00.000Z",
      appliedChargeId: "charge_1",
    });
    expect(body.type).toBe("PAYMENT");
    expect(body.appliedChargeId).toBe("charge_1");
    expect(body.note).toBe("دفعة نقدا — سداد الفاتورة INV-2026-036");
    expect(body.createdAt).toBe("2026-11-14T12:00:00.000Z");
  });

  it("يحذف appliedChargeId حين تكون الدفعة على الحساب (بدون فوترة)", () => {
    const body = buildPaymentBody({
      amountSyp: -10_000,
      note: "دفعة نقدا — على الحساب (بدون فوترة)",
      appliedChargeId: undefined,
    });
    expect("appliedChargeId" in body).toBe(false);
    expect("createdAt" in body).toBe(false);
  });
});
