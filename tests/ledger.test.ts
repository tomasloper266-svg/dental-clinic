import { describe, expect, it } from "vitest";
import {
  computeBalance,
  parseCreateLedgerEntry,
  validateEntrySign,
} from "@/lib/services/ledger";

// اختبارات وحدة الدفتر المالي — معادلة الرصيد نقية وبلا قاعدة بيانات.

describe("معادلة الرصيد", () => {
  it("دفتر فارغ يعطي رصيداً صفراً", () => {
    expect(computeBalance([])).toBe(0);
  });

  it("دفتر مختلط (رسوم ودفعات وتصحيح واسترداد) يعطي الرصيد الصحيح", () => {
    const balance = computeBalance([
      { amountSyp: 500_000 }, // رسوم حشو
      { amountSyp: -200_000 }, // دفعة
      { amountSyp: 300_000 }, // رسوم خلع
      { amountSyp: -50_000 }, // تصحيح خصم
      { amountSyp: 25_000 }, // تصحيح إضافة
      { amountSyp: 100_000 }, // استرداد
      { amountSyp: -175_000 }, // دفعة
    ]);
    expect(balance).toBe(500_000 - 200_000 + 300_000 - 50_000 + 25_000 + 100_000 - 175_000);
  });

  it("دفتر مدفوع بالكامل يعطي رصيداً صفراً", () => {
    const balance = computeBalance([
      { amountSyp: 400_000 },
      { amountSyp: -150_000 },
      { amountSyp: -250_000 },
    ]);
    expect(balance).toBe(0);
  });

  it("المبلغ الموجب وحده يبقى كما هو", () => {
    expect(computeBalance([{ amountSyp: 75_000 }])).toBe(75_000);
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

  it("يرفض الصفر والكسور", () => {
    expect(validateEntrySign("CHARGE", 0)).not.toBeNull();
    expect(validateEntrySign("PAYMENT", -1.5)).not.toBeNull();
  });
});

describe("تحقق جسم طلب إنشاء قيد", () => {
  const valid = {
    patientId: "p1",
    type: "PAYMENT",
    amountSyp: -100_000,
  };

  it("يقبل طلباً صحيحاً", () => {
    const parsed = parseCreateLedgerEntry(valid);
    expect(parsed.ok).toBe(true);
  });

  it("يرفض نوعاً غير معروف", () => {
    expect(
      parseCreateLedgerEntry({ ...valid, type: "GIFT" }).ok,
    ).toBe(false);
  });

  it("يرفض مبلغاً مخالفاً لإشارة النوع", () => {
    expect(
      parseCreateLedgerEntry({ ...valid, amountSyp: 100_000 }).ok,
    ).toBe(false);
  });

  it("يرفض طلباً بدون معرّف مريض", () => {
    expect(parseCreateLedgerEntry({ ...valid, patientId: "" }).ok).toBe(false);
  });

  it("يرفض غير الكائنات", () => {
    expect(parseCreateLedgerEntry("قيد").ok).toBe(false);
    expect(parseCreateLedgerEntry(null).ok).toBe(false);
  });
});
