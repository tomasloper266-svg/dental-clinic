import { describe, expect, it } from "vitest";
import {
  LEDGER_TYPE_META,
  formatEntryDate,
  runningBalances,
  sortEntriesAsc,
  summarizeLedger,
} from "@/lib/finance-view";
import { validateEntrySign } from "@/lib/services/ledger";

// اختبارات وحدة بيانات عرض الدفتر المالي — نقية بلا قاعدة بيانات.
// قاعدة الاختبار: لا تُعيد هذه الدوال تفسير الحساب المالي — الرصيد
// مجموع القيود الموقّعة كما هي.

describe("الرصيد الجاري التراكمي", () => {
  it("دفتر فارغ يعطي قائمة فارغة", () => {
    expect(runningBalances([])).toEqual([]);
  });

  it("الرصيد بعد كل قيد يجمع القيود الموقّعة تراكمياً", () => {
    expect(
      runningBalances([{ amountSyp: 500_000 }, { amountSyp: -200_000 }, { amountSyp: 100_000 }]),
    ).toEqual([500_000, 300_000, 400_000]);
  });

  it("الرصيد الأخير يساوي معادلة الرصيد (Σ القيود)", () => {
    const entries = [{ amountSyp: 300_000 }, { amountSyp: -300_000 }, { amountSyp: 75_000 }];
    const balances = runningBalances(entries);
    expect(balances[balances.length - 1]).toBe(75_000);
  });
});

describe("ملخص الدفتر", () => {
  it("يفصل الرسوم والدفعات بقيمها المطلقة والرصيد من القيود كما هي", () => {
    const summary = summarizeLedger([
      { type: "CHARGE", amountSyp: 500_000, createdAt: "2026-01-01" },
      { type: "PAYMENT", amountSyp: -200_000, createdAt: "2026-01-02" },
      { type: "ADJUSTMENT", amountSyp: -50_000, createdAt: "2026-01-03" },
      { type: "REFUND", amountSyp: 25_000, createdAt: "2026-01-04" },
    ]);
    expect(summary.chargesSyp).toBe(500_000);
    expect(summary.paymentsSyp).toBe(200_000);
    expect(summary.adjustmentsNetSyp).toBe(-50_000);
    expect(summary.refundsSyp).toBe(25_000);
    expect(summary.balanceSyp).toBe(500_000 - 200_000 - 50_000 + 25_000);
  });

  it("دفتر فارغ يعطي أصفاراً", () => {
    expect(summarizeLedger([]).balanceSyp).toBe(0);
  });
});

describe("ترتيب القيود تصاعدياً", () => {
  it("يرتب الأقدم أولاً بلا تعديل القائمة الأصلية", () => {
    const original = [
      { id: "b", createdAt: "2026-01-02T10:00:00Z" },
      { id: "a", createdAt: "2026-01-01T10:00:00Z" },
    ];
    const sorted = sortEntriesAsc(original);
    expect(sorted.map((e) => e.id)).toEqual(["a", "b"]);
    expect(original.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("تسميات وأنواع القيود", () => {
  it("لكل نوع قيد تسمية عربية ونبرة موحّدة", () => {
    expect(LEDGER_TYPE_META.CHARGE.label).toBe("رسوم علاج");
    expect(LEDGER_TYPE_META.PAYMENT.label).toBe("دفعة");
    expect(LEDGER_TYPE_META.ADJUSTMENT.label).toBe("تصحيح");
    expect(LEDGER_TYPE_META.REFUND.label).toBe("استرداد");
  });

  it("قواعد الإشارة في الخدمة تنطبق على ما تُنشئه الواجهة", () => {
    // الدفعة تُسجَّل سالبة والرسوم موجبة — الواجهة تحوّل المقدار الموجب
    // إلى القيمة الموقّعة نفسها التي تتحقق منها الخدمة.
    expect(validateEntrySign("PAYMENT", -200_000)).toBeNull();
    expect(validateEntrySign("CHARGE", 500_000)).toBeNull();
    expect(validateEntrySign("ADJUSTMENT", -50_000)).toBeNull();
    expect(validateEntrySign("ADJUSTMENT", 50_000)).toBeNull();
  });
});

describe("تنسيق تاريخ القيد", () => {
  it("يعيد نصاً عربياً بأرقام لاتينية", () => {
    const text = formatEntryDate("2026-01-15T09:30:00Z");
    expect(text).toMatch(/2026/);
    expect(text).not.toMatch(/[٠-٩]/);
  });
});
