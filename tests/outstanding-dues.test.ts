import { describe, expect, it } from "vitest";
import { outstandingDuesUsd } from "@/lib/finance-view";

// المستحقات غير المسددة — مجمع أرصدة المرضى الموجبة حصراً، فزائد دفع
// مريض لا يُحاسَب على عجز مريض آخر.

describe("outstandingDuesUsd", () => {
  it("يجمع أرصدة المرضى المدينين فقط", () => {
    const dues = outstandingDuesUsd([
      { patientId: "p1", amountUsd: 300 },
      { patientId: "p2", amountUsd: 210 },
      { patientId: "p3", amountUsd: -60 },
    ]);
    expect(dues).toBe(510);
  });

  it("لا يحاسِب زائد الدفع على عجز مريض آخر", () => {
    const dues = outstandingDuesUsd([
      { patientId: "p1", amountUsd: 200 },
      { patientId: "p1", amountUsd: -500 },
      { patientId: "p2", amountUsd: 100 },
      { patientId: "p2", amountUsd: -150 },
    ]);
    expect(dues).toBe(0);
  });

  it("يعيد صفراً بلا قيود", () => {
    expect(outstandingDuesUsd([])).toBe(0);
  });
});
