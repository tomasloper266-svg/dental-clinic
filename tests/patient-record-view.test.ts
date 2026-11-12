import { describe, expect, it } from "vitest";
import type { LedgerEntryDto } from "@/lib/services/ledger";
import type { PlanItemDto } from "@/lib/services/treatment-plan";
import {
  LEDGER_ENTRY_TYPE_META,
  ledgerEntriesWithPlan,
} from "@/lib/ledger-view";

// اختبارات دوال عرض دفتر المريض في الملف المتكامل — نقية وبلا قاعدة بيانات.

function entry(overrides: Partial<LedgerEntryDto>): LedgerEntryDto {
  return {
    id: "e1",
    patientId: "p1",
    type: "CHARGE",
    amountSyp: 100_000,
    note: null,
    treatmentItemId: null,
    createdAt: new Date("2026-01-01T10:00:00Z"),
    ...overrides,
  };
}

function planItem(overrides: Partial<PlanItemDto>): PlanItemDto {
  return {
    id: "t1",
    toothFdi: 24,
    procedure: "حشو",
    priceSyp: 150_000,
    status: "DONE",
    priority: 1,
    ...overrides,
  };
}

describe("LEDGER_ENTRY_TYPE_META", () => {
  it("يغطي الأنواع الأربعة كلها بتسمية عربية وصنف شارة", () => {
    expect(Object.keys(LEDGER_ENTRY_TYPE_META).sort()).toEqual(
      ["ADJUSTMENT", "CHARGE", "PAYMENT", "REFUND"].sort(),
    );
    for (const meta of Object.values(LEDGER_ENTRY_TYPE_META)) {
      expect(meta.labelAr.length).toBeGreaterThan(0);
      expect(meta.chipClass).toContain("border-");
    }
  });
});

describe("ledgerEntriesWithPlan", () => {
  it("يربط القيد ببند الخطة عبر treatmentItemId", () => {
    const linked = ledgerEntriesWithPlan(
      [entry({ treatmentItemId: "t1" })],
      [planItem()],
    );
    expect(linked).toHaveLength(1);
    expect(linked[0].planItem).toEqual({
      id: "t1",
      toothFdi: 24,
      procedure: "حشو",
    });
  });

  it("القيد الحري بلا بند يبقى بلا رابط — ولا يُسقط", () => {
    const rows = ledgerEntriesWithPlan([entry()], [planItem()]);
    expect(rows[0].planItem).toBeNull();
  });

  it("قيد يشير إلى بند غير موجود يبقى بلا رابط ولا يُخمَّن", () => {
    const rows = ledgerEntriesWithPlan(
      [entry({ treatmentItemId: "missing" })],
      [planItem()],
    );
    expect(rows[0].planItem).toBeNull();
  });

  it("يرتب الأحدث أولًا بغضّ ترتيب الإدخال", () => {
    const rows = ledgerEntriesWithPlan(
      [
        entry({ id: "old", createdAt: new Date("2026-01-01T08:00:00Z") }),
        entry({ id: "new", createdAt: new Date("2026-01-02T08:00:00Z") }),
      ],
      [],
    );
    expect(rows.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("لا يعدّل مصفوفات الإدخال", () => {
    const entries = [
      entry({ id: "a", createdAt: new Date("2026-02-01T08:00:00Z") }),
      entry({ id: "b", createdAt: new Date("2026-01-01T08:00:00Z") }),
    ];
    const plan = [planItem()];
    ledgerEntriesWithPlan(entries, plan);
    expect(entries.map((e) => e.id)).toEqual(["a", "b"]);
    expect(plan).toHaveLength(1);
  });

  it("يربط عدة قيود ببنود مختلفة دفعة واحدة", () => {
    const rows = ledgerEntriesWithPlan(
      [
        entry({ id: "e1", treatmentItemId: "t1" }),
        entry({ id: "e2", treatmentItemId: "t2", type: "PAYMENT" }),
      ],
      [
        planItem(),
        planItem({ id: "t2", toothFdi: 36, procedure: "خلع" }),
      ],
    );
    expect(rows[0].planItem?.toothFdi).toBe(24);
    expect(rows[1].planItem?.toothFdi).toBe(36);
    expect(rows[1].planItem?.procedure).toBe("خلع");
  });
});
