import { describe, it, expect } from "vitest";
import { parseCreatePatient } from "@/lib/services/patients";

describe("parseCreatePatient", () => {
  it("يقبل بيانات صحيحة", () => {
    const r = parseCreatePatient({
      name: "أحمد",
      birthYear: 1990,
      phone: "0999",
    });
    expect(r.ok).toBe(true);
  });

  it("يرفض اسماً قصيراً جداً", () => {
    const r = parseCreatePatient({ name: "أ" });
    expect(r.ok).toBe(false);
  });

  it("يرفض سنة ميلاد خارجة عن النطاق", () => {
    const r = parseCreatePatient({ name: "أحمد", birthYear: 1800 });
    expect(r.ok).toBe(false);
  });

  it("يتعامل مع جسم غير كائن", () => {
    expect(parseCreatePatient(42).ok).toBe(false);
  });
});
