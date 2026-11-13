import { describe, expect, it } from "vitest";
import { outstandingDuesSyp } from "@/lib/finance-view";

// المستحقات غير المسددة — مجمع أرصدة المرضى الموجبة حصراً، فزائد دفع
// مريض لا يُحاسَب على عجز مريض آخر.

describe("outstandingDuesSyp", () => {
  it("يجمع أرصدة المرضى المدينين فقط", () => {
    const dues = outstandingDuesSyp([
      { patientId: "p1", amountSyp: 300 },
      { patientId: "p2", amountSyp: 210 },
      { patientId: "p3", amountSyp: -60 },
    ]);
    expect(dues).toBe(510);
  });

  it("لا يحاسِب زائد الدفع على عجز مريض آخر", () => {
    const dues = outstandingDuesSyp([
      { patientId: "p1", amountSyp: 200 },
      { patientId: "p1", amountSyp: -500 },
      { patientId: "p2", amountSyp: 100 },
      { patientId: "p2", amountSyp: -150 },
    ]);
    expect(dues).toBe(0);
  });

  it("يعيد صفراً بلا قيود", () => {
    expect(outstandingDuesSyp([])).toBe(0);
  });
});
