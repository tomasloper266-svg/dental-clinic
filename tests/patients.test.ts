import { describe, it, expect } from "vitest";
import {
  parseCreatePatient,
  parseUpdatePatient,
} from "@/lib/services/patients";
import { composeMedicalNotes, parseMedicalNotes } from "@/lib/medical-notes";

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

describe("parseUpdatePatient", () => {
  it("يقبل تحديثاً جزئياً بحقول صحيحة فقط", () => {
    const r = parseUpdatePatient({ phone: "0999", address: "دمشق" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ phone: "0999", address: "دمشق" });
    }
  });

  it("يقبل جسماً فارغاً — لا تحديث", () => {
    const r = parseUpdatePatient({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({});
  });

  it("يرفض اسماً قصيراً إن ورد", () => {
    expect(parseUpdatePatient({ name: "أ" }).ok).toBe(false);
  });

  it("يرفض سنة ميلاد غير صحيحة إن وردت", () => {
    expect(parseUpdatePatient({ birthYear: 1850 }).ok).toBe(false);
    expect(parseUpdatePatient({ birthYear: 1990.5 }).ok).toBe(false);
  });

  it("يرفض الأنواع الخاطئة للحقول النصية", () => {
    expect(parseUpdatePatient({ phone: 123 }).ok).toBe(false);
    expect(parseUpdatePatient({ address: true }).ok).toBe(false);
    expect(parseUpdatePatient({ medicalNotes: null }).ok).toBe(false);
  });

  it("يزيل الفراغات المحيطة", () => {
    const r = parseUpdatePatient({ name: "  أحمد  ", phone: " 0999 " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("أحمد");
      expect(r.value.phone).toBe("0999");
    }
  });

  it("يرفض جسماً غير كائن", () => {
    expect(parseUpdatePatient("نص").ok).toBe(false);
  });
});

describe("الملاحظات الطبية — تركيب وتحليل", () => {
  it("ذهاب وإياب كامل بلا فقد للحقول الثلاثة", () => {
    const composed = composeMedicalNotes({
      allergies: "بنسلين",
      conditions: "سكري، ضغط",
      medications: "إنسولين",
      other: "",
    });
    const parsed = parseMedicalNotes(composed);
    expect(parsed.allergies).toBe("بنسلين");
    expect(parsed.conditions).toBe("سكري، ضغط");
    expect(parsed.medications).toBe("إنسولين");
  });

  it("قيم متعددة الأسطر تبقى كما هي بعد الذهاب والإياب", () => {
    const composed = composeMedicalNotes({
      allergies: "بنسلين\nلاتكس",
      conditions: "",
      medications: "",
      other: "",
    });
    const parsed = parseMedicalNotes(composed);
    expect(parsed.allergies).toBe("بنسلين\nلاتكس");
  });

  it("الأسطر الحرمة خارج الأقسام تُحفظ في other ولا تُفقد", () => {
    const parsed = parseMedicalNotes("ملاحظة حرة من الطبيب");
    expect(parsed.other).toBe("ملاحظة حرة من الطبيب");
    const recomposed = composeMedicalNotes({
      allergies: "",
      conditions: "",
      medications: "",
      other: parsed.other,
    });
    expect(recomposed).toBe("ملاحظة حرة من الطبيب");
  });

  it("نص فارغ أو مفقود يعيد حقولاً فارغة", () => {
    const empty = { allergies: "", conditions: "", medications: "", other: "" };
    expect(parseMedicalNotes(null)).toEqual(empty);
    expect(parseMedicalNotes("")).toEqual(empty);
  });

  it("التركيب يحذف الأقسام الفارغة", () => {
    const composed = composeMedicalNotes({
      allergies: "",
      conditions: "سكري",
      medications: "",
      other: "",
    });
    expect(composed).toBe("أمراض: سكري");
  });
});
