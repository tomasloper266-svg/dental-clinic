import { describe, it, expect } from "vitest";
import {
  PATIENT_FILTERS,
  ageFromBirthYear,
  countFlags,
  filterPatients,
  patientNotesFlags,
} from "@/lib/patients-view";
import type { PatientDto } from "@/lib/services/patients";

function patient(overrides: Partial<PatientDto>): PatientDto {
  return {
    id: "p1",
    name: "أحمد",
    birthYear: null,
    phone: null,
    address: null,
    medicalNotes: null,
    ...overrides,
  };
}

describe("patientNotesFlags", () => {
  it("يرصد الأقسام الثلاثة من النص المركّب", () => {
    const flags = patientNotesFlags(
      "حساسية: بنسلين\nأمراض: سكري\nأدوية: إنسولين",
    );
    expect(flags).toEqual({
      allergies: true,
      conditions: true,
      medications: true,
    });
  });

  it("يعيد كل الأعلام خاطئة لنص فارغ", () => {
    expect(patientNotesFlags(null)).toEqual({
      allergies: false,
      conditions: false,
      medications: false,
    });
  });

  it("يتجاهل الأسطر الحرّة — لا علم بغير أقسام معلّمة", () => {
    expect(patientNotesFlags("ملاحظة حرّة")).toEqual({
      allergies: false,
      conditions: false,
      medications: false,
    });
  });
});

describe("filterPatients", () => {
  const list: PatientDto[] = [
    patient({ id: "a", name: "أحمد", medicalNotes: "حساسية: بنسلين" }),
    patient({ id: "b", name: "سارة", medicalNotes: "أمراض: سكري" }),
    patient({ id: "c", name: "خالد" }),
  ];

  it("ALL يعيد كل القائمة بنفس الترتيب", () => {
    expect(filterPatients(list, "ALL").map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("يرشّح أصحاب الحساسية فقط", () => {
    expect(filterPatients(list, "allergies").map((p) => p.id)).toEqual(["a"]);
  });

  it("يرشّح أصحاب الأمراض المزمنة فقط", () => {
    expect(filterPatients(list, "conditions").map((p) => p.id)).toEqual(["b"]);
  });

  it("لا يغيّر القائمة الأصلية", () => {
    filterPatients(list, "allergies");
    expect(list).toHaveLength(3);
  });
});

describe("countFlags و ageFromBirthYear", () => {
  it("يعدّ كل علم مرة واحدة عبر القائمة", () => {
    const list: PatientDto[] = [
      patient({ medicalNotes: "حساسية: لاتكس" }),
      patient({ medicalNotes: "حساسية: بنسلين\nأدوية: وارفارين" }),
      patient({}),
    ];
    expect(countFlags(list)).toEqual({
      allergies: 2,
      conditions: 0,
      medications: 1,
    });
  });

  it("يحسب العمر من سنة الميلاد ويعيد null لغيابه", () => {
    const year = new Date().getFullYear();
    expect(ageFromBirthYear(year - 30)).toBe(30);
    expect(ageFromBirthYear(null)).toBeNull();
  });
});

describe("PATIENT_FILTERS", () => {
  it("يبدأ بفلتر الكل", () => {
    expect(PATIENT_FILTERS[0]).toEqual({ key: "ALL", label: "الكل" });
  });
});
