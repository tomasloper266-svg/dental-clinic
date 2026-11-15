import { describe, expect, it } from "vitest";
import {
  LEDGER_TYPE_META,
  LEDGER_SETTLEMENT_META,
  buildLedgerRows,
  filterBySettlement,
  formatEntryDate,
  runningBalances,
  runningBalancesByPatient,
  searchLedgerRows,
  settlementOfCharge,
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
      runningBalances([{ amountUsd: 500_000 }, { amountUsd: -200_000 }, { amountUsd: 100_000 }]),
    ).toEqual([500_000, 300_000, 400_000]);
  });

  it("الرصيد الأخير يساوي معادلة الرصيد (Σ القيود)", () => {
    const entries = [{ amountUsd: 300_000 }, { amountUsd: -300_000 }, { amountUsd: 75_000 }];
    const balances = runningBalances(entries);
    expect(balances[balances.length - 1]).toBe(75_000);
  });
});

describe("ملخص الدفتر", () => {
  it("يفصل الرسوم والدفعات بقيمها المطلقة والرصيد من القيود كما هي", () => {
    const summary = summarizeLedger([
      { type: "CHARGE", amountUsd: 500_000, createdAt: "2026-01-01" },
      { type: "PAYMENT", amountUsd: -200_000, createdAt: "2026-01-02" },
      { type: "ADJUSTMENT", amountUsd: -50_000, createdAt: "2026-01-03" },
      { type: "REFUND", amountUsd: 25_000, createdAt: "2026-01-04" },
    ]);
    expect(summary.chargesUsd).toBe(500_000);
    expect(summary.paymentsUsd).toBe(200_000);
    expect(summary.adjustmentsNetUsd).toBe(-50_000);
    expect(summary.refundsUsd).toBe(25_000);
    expect(summary.balanceUsd).toBe(500_000 - 200_000 - 50_000 + 25_000);
  });

  it("دفتر فارغ يعطي أصفاراً", () => {
    expect(summarizeLedger([]).balanceUsd).toBe(0);
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


// ─── حالة السداد وصفوف العرض (الهيكل المرجعي) ───────────────────────────────

describe("settlementOfCharge", () => {
  it("رصيد مسدَّد كلياً بعد القيد يعني تغطية كاملة", () => {
    expect(settlementOfCharge(0, 300_000)).toBe("settled");
    expect(settlementOfCharge(-50_000, 300_000)).toBe("settled");
  });

  it("رصيد أقل من قيمة القيد يعني تغطية جزئية", () => {
    expect(settlementOfCharge(100_000, 300_000)).toBe("partial");
  });

  it("رصيد يساوي القيد أو أكثر يعني غير مسدد", () => {
    expect(settlementOfCharge(300_000, 300_000)).toBe("unsettled");
    expect(settlementOfCharge(450_000, 300_000)).toBe("unsettled");
  });
});

describe("runningBalancesByPatient", () => {
  it("يحسب الرصيد لكل مريض على حدة بترتيبه الزمني", () => {
    const after = runningBalancesByPatient([
      { id: "e1", patientId: "p1", amountUsd: 300_000, createdAt: "2026-01-01" },
      { id: "e2", patientId: "p2", amountUsd: 100_000, createdAt: "2026-01-02" },
      { id: "e3", patientId: "p1", amountUsd: -200_000, createdAt: "2026-01-03" },
    ]);
    expect(after.get("e1")).toBe(300_000);
    expect(after.get("e2")).toBe(100_000);
    expect(after.get("e3")).toBe(100_000); // رصيد p1 وحده — لا يختلط بمريض آخر
  });
});

describe("buildLedgerRows و filterBySettlement", () => {
  const entries = [
    { id: "e1", patientId: "p1", patientName: "أحمد", patientPhone: null, type: "CHARGE" as const, amountUsd: 300_000, note: null, createdAt: "2026-01-01" },
    { id: "e2", patientId: "p1", patientName: "أحمد", patientPhone: null, type: "PAYMENT" as const, amountUsd: -200_000, note: null, createdAt: "2026-01-02" },
  ];

  it("الرسوم المُصدرة تُصنَّف من رصيد المريض بعدها، والدفعات مسددة بحكمها", () => {
    const rows = buildLedgerRows(entries);
    // الأحدث أولاً: الدفعة ثم الرسوم
    expect(rows[0].settlement).toBe("settled");
    // بعد الرسوم بقي 300 ألف — غير مسددة وقتئذٍ (الدفعة جاءت بعدها)
    expect(rows[1].settlement).toBe("unsettled");
    expect(rows[1].patientBalanceAfter).toBe(300_000);
  });

  it("التصفية تعيد الكل كما هو وترشّح بحالة السداد", () => {
    const rows = buildLedgerRows(entries);
    expect(filterBySettlement(rows, "ALL")).toHaveLength(2);
    expect(
      filterBySettlement(rows, "settled").map((r) => r.entry.id),
    ).toEqual(["e2"]);
    expect(filterBySettlement(rows, "unsettled").map((r) => r.entry.id)).toEqual(["e1"]);
    // التصحيح والاسترداد بلا حالة سداد — لا يظهرون إلا تحت الكل
  });

  it("البحث يطابق اسم المريض أو البيان", () => {
    const rows = buildLedgerRows(entries);
    expect(searchLedgerRows(rows, "أحمد")).toHaveLength(2);
    expect(searchLedgerRows(rows, "لا يوجد")).toHaveLength(0);
  });

  it("لكل حالة سداد تسمية عربية ونبرة موحّدة", () => {
    expect(LEDGER_SETTLEMENT_META.settled).toEqual({ label: "مسدد", tone: "success" });
    expect(LEDGER_SETTLEMENT_META.partial.label).toBe("جزئي");
    expect(LEDGER_SETTLEMENT_META.unsettled.tone).toBe("danger");
  });
});
