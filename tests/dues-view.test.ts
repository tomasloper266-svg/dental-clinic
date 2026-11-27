import { describe, expect, it } from "vitest";
import {
  buildDuesRows,
  searchDuesRows,
  sortDuesRows,
  summarizeDues,
} from "@/lib/dues-view";
import { chargeSettlementSplit } from "@/lib/finance-view";
import { summarizePatientLedger } from "@/lib/ledger-view";
import type { DuesEntryLike } from "@/lib/dues-view";

// اختبارات وحدة صفحة المستحقات وملخص ملف المريض — نقية بلا قاعدة بيانات.
// قاعدة الاختبار: المدين وحده من رصيده الجاري الموجب، ولا يُعاد تفسير
// الحساب المالي للخدمة.

const NOW = new Date("2026-11-13T12:00:00Z");

function entry(overrides: Partial<DuesEntryLike>): DuesEntryLike {
  return {
    id: "e1",
    patientId: "p1",
    type: "CHARGE",
    amountUsd: 100_000,
    createdAt: "2026-11-01T10:00:00Z",
    patientName: "باسل",
    patientPhone: null,
    ...overrides,
  };
}

describe("buildDuesRows", () => {
  it("قائمة بلا قيود تعطي صفوفاً فارغة", () => {
    expect(buildDuesRows([], NOW)).toEqual([]);
  });

  it("المريض المسدد كلياً (رصيد صفري أو سالب) لا يظهر", () => {
    const rows = buildDuesRows(
      [
        entry({ id: "e1", amountUsd: 100_000 }),
        entry({ id: "e2", type: "PAYMENT", amountUsd: -100_000 }),
        // مريض آخر دفع زيادة — رصيده سالب
        entry({
          id: "e3",
          patientId: "p2",
          patientName: "سامر",
          amountUsd: 50_000,
        }),
        entry({
          id: "e4",
          patientId: "p2",
          patientName: "سامر",
          type: "PAYMENT",
          amountUsd: -80_000,
        }),
      ],
      NOW,
    );
    expect(rows).toEqual([]);
  });

  it("المدين الوحيد يفكك الرسوم والمسدد والمستحق", () => {
    const rows = buildDuesRows(
      [
        entry({
          id: "e1",
          amountUsd: 955_000,
          createdAt: "2026-10-07T10:00:00Z",
        }),
        entry({
          id: "e2",
          type: "PAYMENT",
          amountUsd: -655_000,
          createdAt: "2026-11-13T10:00:00Z",
        }),
      ],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      patientId: "p1",
      chargesUsd: 955_000,
      paidUsd: 655_000,
      dueUsd: 300_000,
      lastPaymentAt: expect.stringContaining("2026-11-13"),
    });
    expect(rows[0].lastChargeAt).toContain("2026-10-07");
  });

  it("آخر فاتورة وآخر دفعة يلتقطان الأحدث زمنياً من عدة قيود", () => {
    const rows = buildDuesRows(
      [
        entry({
          id: "e1",
          amountUsd: 100_000,
          createdAt: "2026-09-01T10:00:00Z",
        }),
        entry({
          id: "e2",
          amountUsd: 60_000,
          createdAt: "2026-11-10T10:00:00Z",
        }),
        entry({
          id: "e3",
          type: "PAYMENT",
          amountUsd: -40_000,
          createdAt: "2026-11-12T10:00:00Z",
        }),
        entry({
          id: "e4",
          type: "PAYMENT",
          amountUsd: -10_000,
          createdAt: "2026-10-20T10:00:00Z",
        }),
      ],
      NOW,
    );
    expect(rows[0].lastChargeAt).toContain("2026-11-10");
    expect(rows[0].lastPaymentAt).toContain("2026-11-12");
  });

  it("مريض بلا دفعات يكون آخر دفعة صفراً", () => {
    const rows = buildDuesRows(
      [
        entry({
          id: "e1",
          amountUsd: 100_000,
          createdAt: "2026-11-01T10:00:00Z",
        }),
      ],
      NOW,
    );
    expect(rows[0].lastPaymentAt).toBeNull();
    expect(rows[0].lastChargeAt).toContain("2026-11-01");
  });

  it("آخر قيد غير مسدد هو آخر قيد رسوم بقي الرصيد بعده موجباً — وأيام التأخر تُحسب حتى الآن", () => {
    const rows = buildDuesRows(
      [
        entry({
          id: "e1",
          amountUsd: 100_000,
          createdAt: "2026-09-01T10:00:00Z",
        }),
        entry({
          id: "e2",
          amountUsd: 60_000,
          createdAt: "2026-11-10T10:00:00Z",
        }),
        // دفعة جزئية تبقي الرصيد موجباً
        entry({ id: "e3", type: "PAYMENT", amountUsd: -40_000 }),
      ],
      NOW,
    );
    expect(rows[0].lastUnpaidChargeAt).toContain("2026-11-10");
    expect(rows[0].overdueDays).toBe(3);
  });

  it("قيد رسوم غُطي لاحقاً بدفعة كاملة لا يُعدّ آخر قيد غير مسدد", () => {
    const rows = buildDuesRows(
      [
        entry({
          id: "e1",
          amountUsd: 100_000,
          createdAt: "2026-09-01T10:00:00Z",
        }),
        entry({ id: "e2", type: "PAYMENT", amountUsd: -100_000 }),
        entry({
          id: "e3",
          amountUsd: 50_000,
          createdAt: "2026-11-12T10:00:00Z",
        }),
      ],
      NOW,
    );
    expect(rows[0].lastUnpaidChargeAt).toContain("2026-11-12");
  });
});

describe("بحث وترتيب المستحقات", () => {
  const rows = buildDuesRows(
    [
      entry({
        id: "e1",
        patientId: "p1",
        patientName: "باسل مرعي",
        patientPhone: "0934 343 536",
        amountUsd: 300_000,
      }),
      entry({
        id: "e2",
        patientId: "p2",
        patientName: "أحمد",
        amountUsd: 500_000,
      }),
    ],
    NOW,
  );

  it("البحث بالاسم أو جزء الهاتف", () => {
    expect(searchDuesRows(rows, "مرعي")).toHaveLength(1);
    expect(searchDuesRows(rows, "343")[0].patientName).toBe("باسل مرعي");
    expect(searchDuesRows(rows, "  ")).toHaveLength(2);
  });

  it("الترتيب الافتراضي بالمبلغ تنازلياً", () => {
    expect(sortDuesRows(rows, "amount")[0].patientName).toBe("أحمد");
  });

  it("الترتيب بالاسم والترتيب بالأقدم تأخراً", () => {
    expect(sortDuesRows(rows, "name")[0].patientName).toBe("أحمد");
    const withOverdue = sortDuesRows(rows, "overdue");
    expect(withOverdue[0].overdueDays).toBeGreaterThanOrEqual(
      withOverdue[withOverdue.length - 1].overdueDays ?? -1,
    );
  });
});

describe("summarizeDues", () => {
  it("لا مدينين يعطي أصفاراً", () => {
    expect(summarizeDues([])).toEqual({
      totalDuesUsd: 0,
      debtors: 0,
      maxDueUsd: 0,
      avgDueUsd: 0,
    });
  });

  it("يجمع الإجمالي والعدد والأعلى فردياً والمتوسط", () => {
    const rows = [{ dueUsd: 300_000 }, { dueUsd: 120_000 }];
    const summary = summarizeDues(rows);
    expect(summary.totalDuesUsd).toBe(420_000);
    expect(summary.debtors).toBe(2);
    expect(summary.maxDueUsd).toBe(300_000);
    expect(summary.avgDueUsd).toBe(210_000);
  });
});

describe("chargeSettlementSplit", () => {
  it("غير مسددة كلياً — المتبقي كامل قيمة القيد", () => {
    expect(chargeSettlementSplit(500_000, 300_000)).toEqual({
      paidUsd: 0,
      remainingUsd: 300_000,
    });
  });

  it("جزئية — المسدد فرق القيمة عن الرصيد المتبقي", () => {
    expect(chargeSettlementSplit(100_000, 300_000)).toEqual({
      paidUsd: 200_000,
      remainingUsd: 100_000,
    });
  });

  it("مسددة كلياً أو برصيد دائن — المتبقي صفر", () => {
    expect(chargeSettlementSplit(0, 300_000).remainingUsd).toBe(0);
    expect(chargeSettlementSplit(-50_000, 300_000).remainingUsd).toBe(0);
  });
});

describe("summarizePatientLedger", () => {
  it("يفكك رسوم ملف المريض إلى إجمالي ومسدد ورصيد", () => {
    const summary = summarizePatientLedger(
      [
        { type: "CHARGE", amountUsd: 955_000 },
        { type: "PAYMENT", amountUsd: -655_000 },
      ],
      300_000,
    );
    expect(summary).toEqual({
      chargesUsd: 955_000,
      paidUsd: 655_000,
      balanceUsd: 300_000,
      paymentsUsd: 655_000,
      discountUsd: 0,
    });
  });

  it("رصيد دائن (سالب) يجعل المسدد كامل الرسوم", () => {
    const summary = summarizePatientLedger(
      [{ type: "CHARGE", amountUsd: 100_000 }],
      -20_000,
    );
    expect(summary.paidUsd).toBe(100_000);
  });

  it("الدفعة والدفع المنفصل — إجمالي المدفوع دفعات فقط والخصم بطاقة منفصلة", () => {
    // سيناريو tc-15: رسوم 100، دفعة 40، تسوية -3 — المسدد المختلط 43
    // لكن دفعات الدفتر 40 حصراً والخصم 3 (ليس دفعة).
    const summary = summarizePatientLedger(
      [
        { type: "CHARGE", amountUsd: 100 },
        { type: "PAYMENT", amountUsd: -40 },
        { type: "ADJUSTMENT", amountUsd: -3 },
      ],
      57,
    );
    expect(summary.paymentsUsd).toBe(40);
    expect(summary.discountUsd).toBe(3);
    // الدفعة + الخصم + المستحق = الرسوم — الترويسة تتوازن كصف الفاتورة
    expect(summary.paymentsUsd + summary.discountUsd + summary.balanceUsd).toBe(
      summary.chargesUsd,
    );
  });

  it("التسوية الموجبة ليست خصماً ولا دفعة", () => {
    const summary = summarizePatientLedger(
      [
        { type: "CHARGE", amountUsd: 100 },
        { type: "ADJUSTMENT", amountUsd: 5 },
      ],
      105,
    );
    expect(summary.paymentsUsd).toBe(0);
    expect(summary.discountUsd).toBe(0);
  });
});
