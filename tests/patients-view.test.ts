import { describe, it, expect } from "vitest";
import {
  PATIENT_FILTERS,
  ageFromBirthYear,
  buildPatientRows,
  countGenders,
  filterPatients,
  genderLabel,
  searchPatientRows,
  sortPatientRows,
  type PatientRowView,
} from "@/lib/patients-view";
import { formatDateCell } from "@/lib/dates";
import type { PatientDto } from "@/lib/services/patients";

function patient(overrides: Partial<PatientDto>): PatientDto {
  return {
    id: "p1",
    name: "أحمد",
    birthYear: null,
    phone: null,
    address: null,
    medicalNotes: null,
    gender: null,
    secondaryPhone: null,
    homePhone: null,
    email: null,
    nationalId: null,
    bloodType: null,
    allergies: null,
    chronicDiseases: null,
    emergencyContacts: null,
    fileNo: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("genderLabel", () => {
  it("يعيد الذكر والأنثى وnull لمن بلا جنس مسجل", () => {
    expect(genderLabel("MALE")).toBe("ذكر");
    expect(genderLabel("FEMALE")).toBe("أنثى");
    expect(genderLabel(null)).toBeNull();
  });
});

describe("filterPatients", () => {
  const list: PatientDto[] = [
    patient({ id: "a", name: "أحمد", gender: "MALE" }),
    patient({ id: "b", name: "سارة", gender: "FEMALE" }),
    patient({ id: "c", name: "خالد" }),
  ];

  it("ALL يعيد كل القائمة بنفس الترتيب", () => {
    expect(filterPatients(list, "ALL").map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("يرشّح الذكور فقط", () => {
    expect(filterPatients(list, "MALE").map((p) => p.id)).toEqual(["a"]);
  });

  it("يرشّح الإناث فقط", () => {
    expect(filterPatients(list, "FEMALE").map((p) => p.id)).toEqual(["b"]);
  });

  it("لا يغيّر القائمة الأصلية", () => {
    filterPatients(list, "MALE");
    expect(list).toHaveLength(3);
  });
});

describe("countGenders و ageFromBirthYear", () => {
  it("يعدّ كل جنس مرة واحدة عبر القائمة ويهمل من بلا جنس", () => {
    const list: PatientDto[] = [
      patient({ gender: "MALE" }),
      patient({ gender: "MALE" }),
      patient({ gender: "FEMALE" }),
      patient({}),
    ];
    expect(countGenders(list)).toEqual({ MALE: 2, FEMALE: 1 });
  });

  it("يحسب العمر من سنة الميلاد ويعيد null لغيابه", () => {
    const year = new Date().getFullYear();
    expect(ageFromBirthYear(year - 30)).toBe(30);
    expect(ageFromBirthYear(null)).toBeNull();
  });
});

describe("PATIENT_FILTERS", () => {
  it("تبدأ بفلتر الكل ثم الذكر ثم الأنثى", () => {
    expect(PATIENT_FILTERS.map((f) => f.key)).toEqual([
      "ALL",
      "MALE",
      "FEMALE",
    ]);
    expect(PATIENT_FILTERS.map((f) => f.label)).toEqual([
      "الكل",
      "ذكر",
      "أنثى",
    ]);
  });
});


// ─── صفوف جدول المرضى (الهيكل المرجعي) ─────────────────────────────────────

const NOW = new Date("2026-11-13T10:00:00Z");

function row(
  overrides: Partial<PatientRowView> & { id: string; name: string },
): PatientRowView {
  const { id, name, ...rest } = overrides;
  return {
    patient: patient({ id, name }),
    balanceSyp: 0,
    lastVisit: null,
    nextVisit: null,
    ...rest,
  };
}

describe("buildPatientRows", () => {
  const patients: PatientDto[] = [
    patient({ id: "a", name: "أحمد" }),
    patient({ id: "b", name: "سارة" }),
  ];

  it("يجمع رصيد كل مريض من قيوده", () => {
    const rows = buildPatientRows(
      patients,
      [
        { patientId: "a", amountSyp: 300_000 },
        { patientId: "a", amountSyp: -200_000 },
      ],
      [],
      NOW,
    );
    expect(rows.find((r) => r.patient.id === "a")?.balanceSyp).toBe(100_000);
    expect(rows.find((r) => r.patient.id === "b")?.balanceSyp).toBe(0);
  });

  it("يفصل آخر زيارة فعلية عن أقرب موعد قادم، ويتجاهل الملغى ولم يحضر", () => {
    const rows = buildPatientRows(
      [patients[0]],
      [],
      [
        { patientId: "a", startsAt: "2026-11-01T09:00:00Z", status: "COMPLETED" },
        { patientId: "a", startsAt: "2026-10-01T09:00:00Z", status: "CANCELLED" },
        { patientId: "a", startsAt: "2026-11-20T09:00:00Z", status: "SCHEDULED" },
        { patientId: "a", startsAt: "2026-11-25T09:00:00Z", status: "SCHEDULED" },
      ],
      NOW,
    );
    expect(rows[0].lastVisit).toBe("2026-11-01T09:00:00.000Z");
    expect(rows[0].nextVisit).toBe("2026-11-20T09:00:00.000Z");
  });

  it("مريض بلا سجلات يعطي أصفاراً وقيم null", () => {
    const rows = buildPatientRows([patients[0]], [], [], NOW);
    expect(rows[0]).toMatchObject({
      balanceSyp: 0,
      lastVisit: null,
      nextVisit: null,
    });
  });
});

describe("searchPatientRows و sortPatientRows", () => {
  const rows: PatientRowView[] = [
    row({ id: "a", name: "أحمد", balanceSyp: 40 }),
    row({
      id: "b",
      name: "سارة",
      balanceSyp: 300,
      patient: patient({ id: "b", name: "سارة", fileNo: 7 }),
    }),
    row({ id: "c", name: "خالد", balanceSyp: 0 }),
  ];

  it("البحث يطابق الاسم أو الهاتف أو رقم الأيوبي", () => {
    expect(searchPatientRows(rows, "أحمد").map((r) => r.patient.id)).toEqual(["a"]);
    expect(searchPatientRows(rows, "7").map((r) => r.patient.id)).toEqual(["b"]);
    expect(searchPatientRows(rows, "  ")).toHaveLength(3);
  });

  it("الترتيب بالرصيد المستحق ينازلياً والأبجدي باسم المريض", () => {
    expect(
      sortPatientRows(rows, "balance").map((r) => r.patient.id),
    ).toEqual(["b", "a", "c"]);
    expect(
      sortPatientRows(rows, "name").map((r) => r.patient.name),
    ).toEqual(["أحمد", "خالد", "سارة"]);
  });
});

describe("formatDateCell", () => {
  it("يعيد صيغة قصيرة بأرقام لاتينية", () => {
    const text = formatDateCell("2026-11-09T09:00:00Z");
    expect(text).toMatch(/2026/);
    expect(text).not.toMatch(/[٠-٩]/);
  });
});
