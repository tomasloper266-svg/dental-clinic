import { describe, expect, it } from "vitest";
import {
  computeBalance,
  parseCreateLedgerEntry,
  validateEntrySign,
  validateLedgerEntryItems,
} from "@/lib/services/ledger";

// اختبارات وحدة الدفتر المالي — معادلة الرصيد نقية وبلا قاعدة بيانات.

describe("معادلة الرصيد", () => {
  it("دفتر فارغ يعطي رصيداً صفراً", () => {
    expect(computeBalance([])).toBe(0);
  });

  it("دفتر مختلط (رسوم ودفعات وتصحيح واسترداد) يعطي الرصيد الصحيح", () => {
    const balance = computeBalance([
      { amountUsd: 500_000 }, // رسوم حشو
      { amountUsd: -200_000 }, // دفعة
      { amountUsd: 300_000 }, // رسوم خلع
      { amountUsd: -50_000 }, // تصحيح خصم
      { amountUsd: 25_000 }, // تصحيح إضافة
      { amountUsd: 100_000 }, // استرداد
      { amountUsd: -175_000 }, // دفعة
    ]);
    expect(balance).toBe(
      500_000 - 200_000 + 300_000 - 50_000 + 25_000 + 100_000 - 175_000,
    );
  });

  it("دفتر مدفوع بالكامل يعطي رصيداً صفراً", () => {
    const balance = computeBalance([
      { amountUsd: 400_000 },
      { amountUsd: -150_000 },
      { amountUsd: -250_000 },
    ]);
    expect(balance).toBe(0);
  });

  it("المبلغ الموجب وحده يبقى كما هو", () => {
    expect(computeBalance([{ amountUsd: 75_000 }])).toBe(75_000);
  });
});

describe("التحقق من إشارة المبلغ حسب النوع", () => {
  it("يقبل رسوماً موجبة ودفعة سالبة واسترداداً موجباً", () => {
    expect(validateEntrySign("CHARGE", 100_000)).toBeNull();
    expect(validateEntrySign("PAYMENT", -100_000)).toBeNull();
    expect(validateEntrySign("REFUND", 100_000)).toBeNull();
  });

  it("يقبل التصحيح بالاتجاهين", () => {
    expect(validateEntrySign("ADJUSTMENT", -30_000)).toBeNull();
    expect(validateEntrySign("ADJUSTMENT", 30_000)).toBeNull();
  });

  it("يرفض دفعة موجبة ورسماً سالباً", () => {
    expect(validateEntrySign("PAYMENT", 100_000)).not.toBeNull();
    expect(validateEntrySign("CHARGE", -100_000)).not.toBeNull();
    expect(validateEntrySign("REFUND", -100_000)).not.toBeNull();
  });

  it("يرفض الصفر وما فوق منزلتين — والكسر المسموح يقبل", () => {
    expect(validateEntrySign("CHARGE", 0)).not.toBeNull();
    expect(validateEntrySign("PAYMENT", -1.5)).toBeNull();
    expect(validateEntrySign("PAYMENT", -1.505)).not.toBeNull();
  });
});

describe("تحقق جسم طلب إنشاء قيد", () => {
  const valid = {
    type: "PAYMENT",
    amountUsd: -100_000,
  };

  it("يقبل طلباً صحيحاً", () => {
    const parsed = parseCreateLedgerEntry(valid);
    expect(parsed.ok).toBe(true);
  });

  it("يرفض نوعاً غير معروف", () => {
    expect(parseCreateLedgerEntry({ ...valid, type: "GIFT" }).ok).toBe(false);
  });

  it("يرفض مبلغاً مخالفاً لإشارة النوع", () => {
    expect(parseCreateLedgerEntry({ ...valid, amountUsd: 100_000 }).ok).toBe(
      false,
    );
  });

  it("يرفض غير الكائنات", () => {
    expect(parseCreateLedgerEntry("قيد").ok).toBe(false);
    expect(parseCreateLedgerEntry(null).ok).toBe(false);
  });

  it("يقبل تاريخ قيد صالحاً — لتسديدات وفواتير بتاريخ سابق", () => {
    const parsed = parseCreateLedgerEntry({
      ...valid,
      createdAt: "2026-11-13T09:00:00.000Z",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.createdAt?.getTime()).toBe(
        new Date("2026-11-13T09:00:00.000Z").getTime(),
      );
    }
  });

  it("يرفض تاريخاً غير صالح أو مستقبلياً", () => {
    expect(
      parseCreateLedgerEntry({ ...valid, createdAt: "ليس تاريخاً" }).ok,
    ).toBe(false);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(parseCreateLedgerEntry({ ...valid, createdAt: future }).ok).toBe(
      false,
    );
  });

  it("يترك غياب التاريخ بلا قيمة — يأخذ الآن من المخطط", () => {
    const parsed = parseCreateLedgerEntry(valid);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.createdAt).toBeUndefined();
  });

  it("يقبل الإسناد الصريح للطبيب وترشيح الدفعة", () => {
    const parsed = parseCreateLedgerEntry({
      ...valid,
      doctorId: "staff_1",
      appliedChargeId: "entry_1",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.doctorId).toBe("staff_1");
      expect(parsed.value.appliedChargeId).toBe("entry_1");
    }
  });

  it("يقبل بنود فاتورة مجموعها يساوي المبلغ", () => {
    const parsed = parseCreateLedgerEntry({
      type: "CHARGE",
      amountUsd: 150_000,
      items: [
        { description: "حشو", category: "ترميم", amountUsd: 100_000, sort: 0 },
        { description: "تنظيف", amountUsd: 50_000, sort: 1 },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.items).toHaveLength(2);
      expect(parsed.value.items?.[0].sort).toBe(0);
    }
  });

  it("يرفض بنوداً لا تجمع مبلغ القيد (فجوة 2 — تحقق صارم)", () => {
    const parsed = parseCreateLedgerEntry({
      type: "CHARGE",
      amountUsd: 150_000,
      items: [
        { description: "حشو", amountUsd: 100_000 },
        { description: "تنظيف", amountUsd: 40_000 },
      ],
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain("مجموع البنود");
    }
  });

  it("يرفض البنود على قيد غير رسوم", () => {
    expect(
      parseCreateLedgerEntry({
        ...valid,
        items: [{ description: "حشو", amountUsd: 100_000 }],
      }).ok,
    ).toBe(false);
  });
});

describe("تحقق بنود الفاتورة — مجموع البنود = مبلغ القيد", () => {
  it("قائمة فارغة مقبولة — القيد اليدوي المفرد بلا بنود", () => {
    expect(validateLedgerEntryItems([], 100_000)).toBeNull();
  });

  it("مجموع البنود يساوي المبلغ يُقبل", () => {
    expect(
      validateLedgerEntryItems(
        [
          { description: "حشو", amountUsd: 70_000 },
          { description: "صيانة", amountUsd: 30_000 },
        ],
        100_000,
      ),
    ).toBeNull();
  });

  it("مجموع مخالف يُرفض", () => {
    expect(
      validateLedgerEntryItems(
        [{ description: "حشو", amountUsd: 50_000 }],
        100_000,
      ),
    ).not.toBeNull();
  });

  it("وصف فارغ أو مبلغ غير صحيح يُرفض", () => {
    expect(
      validateLedgerEntryItems([{ description: "  ", amountUsd: 100 }], 100),
    ).not.toBeNull();
    expect(
      validateLedgerEntryItems(
        [{ description: "حشو", amountUsd: 10.505 }],
        10.505,
      ),
    ).not.toBeNull();
  });
});
