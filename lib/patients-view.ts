// دوال عرض نقية لقائمة المرضى — تُختبر في وحدة منفصلة عن الشبكة وقاعدة البيانات.
// البحث (الاسم/الهاتف/الرقم الوطني/رقم الملف) يبقى من طرف الخادم عبر q،
// والفلاتر هنا تصفية زبونية فوق النتائج المرجعة بلا أي منطق عمل جديد.

import type { PatientDto } from "./services/patients";

export type PatientFilterKey = "ALL" | "MALE" | "FEMALE";

export const PATIENT_FILTERS: ReadonlyArray<{
  key: PatientFilterKey;
  label: string;
}> = [
  { key: "ALL", label: "الكل" },
  { key: "MALE", label: "ذكر" },
  { key: "FEMALE", label: "أنثى" },
] as const;

/** تسمية الجنس للعرض — null لمن بلا جنس مسجل */
export function genderLabel(
  gender: PatientDto["gender"],
): string | null {
  if (gender === "MALE") return "ذكر";
  if (gender === "FEMALE") return "أنثى";
  return null;
}

/** عمر تقريبي من سنة الميلاد — للعرض فقط (سنة حالية − سنة الميلاد). */
export function ageFromBirthYear(birthYear: number | null): number | null {
  if (birthYear === null) return null;
  return new Date().getFullYear() - birthYear;
}

/** تصفية القائمة حسب الجنس — ALL تعيد نسخة بنفس الترتيب الوارد. */
export function filterPatients(
  patients: readonly PatientDto[],
  filter: PatientFilterKey,
): PatientDto[] {
  if (filter === "ALL") return [...patients];
  return patients.filter((p) => p.gender === filter);
}

/** عدد كل جنس — لعرض العدّاد بجانب كل فلتر. */
export function countGenders(
  patients: readonly PatientDto[],
): { MALE: number; FEMALE: number } {
  const counts = { MALE: 0, FEMALE: 0 };
  for (const patient of patients) {
    if (patient.gender === "MALE") counts.MALE += 1;
    if (patient.gender === "FEMALE") counts.FEMALE += 1;
  }
  return counts;
}


// ─── صفوف جدول المرضى (الهيكل المرجعي) ─────────────────────────────────────
// كل صف يجمع المريض مع رصيده المستحق وآخر زيارة وموعده القادم — تُبنى الصفوف
// في الصفحة الخادمية من خدمات العيادة القائمة حصراً، والتصفية والترتيب هنا
// زبونية نقية فوق النتائج.

export type PatientRowView = {
  patient: PatientDto;
  /** رصيد المريض الجاري من قيود الدفتر — موجب يعني مستحقاً عليه */
  balanceUsd: number;
  /** آخر موعد فائت (بصيغة ISO) — null إن لا زيارات */
  lastVisit: string | null;
  /** أقرب موعد قادم (بصيغة ISO) — null إن لا مواعيد قادمة */
  nextVisit: string | null;
};

export type PatientVisitRecord = {
  patientId: string;
  startsAt: Date | string;
  status: string;
};

/** الحالات التي لا تُعدّ زيارة فعلية — أثر جدولي لا حضور */
const NON_VISIT_STATUSES = new Set(["CANCELLED", "NO_SHOW"]);

/**
 * نقي — بناء صفوف جدول المرضى: رصيد كل مريض من قيوده، وآخر زيارة فعلية
 * وأقرب موعد قادم من مواعيده. بلا أي I/O — تُختبر بلا قاعدة بيانات.
 */
export function buildPatientRows(
  patients: readonly PatientDto[],
  entries: ReadonlyArray<{ patientId: string; amountUsd: number }>,
  appointments: ReadonlyArray<PatientVisitRecord>,
  now: Date,
): PatientRowView[] {
  const balances = new Map<string, number>();
  for (const entry of entries) {
    balances.set(
      entry.patientId,
      (balances.get(entry.patientId) ?? 0) + entry.amountUsd,
    );
  }

  const nowMs = now.getTime();
  const lastVisitMs = new Map<string, number>();
  const nextVisitMs = new Map<string, number>();
  for (const appointment of appointments) {
    if (NON_VISIT_STATUSES.has(appointment.status)) continue;
    const time = new Date(appointment.startsAt).getTime();
    if (time <= nowMs) {
      const current = lastVisitMs.get(appointment.patientId) ?? -Infinity;
      if (time > current) lastVisitMs.set(appointment.patientId, time);
    } else {
      const current = nextVisitMs.get(appointment.patientId) ?? Infinity;
      if (time < current) nextVisitMs.set(appointment.patientId, time);
    }
  }

  return patients.map((patient) => ({
    patient,
    balanceUsd: balances.get(patient.id) ?? 0,
    lastVisit: lastVisitMs.has(patient.id)
      ? new Date(lastVisitMs.get(patient.id) as number).toISOString()
      : null,
    nextVisit: nextVisitMs.has(patient.id)
      ? new Date(nextVisitMs.get(patient.id) as number).toISOString()
      : null,
  }));
}

/** نقي — بحث زبوني بالاسم أو الهاتف أو الرقم الوطني أو رقم الملف فوق الصفوف */
export function searchPatientRows(
  rows: readonly PatientRowView[],
  query: string,
): PatientRowView[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter(
    ({ patient }) =>
      patient.name.toLowerCase().includes(needle) ||
      (patient.phone ?? "").toLowerCase().includes(needle) ||
      (patient.secondaryPhone ?? "").toLowerCase().includes(needle) ||
      (patient.nationalId ?? "").toLowerCase().includes(needle) ||
      (patient.fileNo !== null && String(patient.fileNo) === needle),
  );
}

export type PatientSortKey = "name" | "newest" | "balance";

/** نقي — ترتيب الصفوف: الاسم أبجدياً، الأحدث تسجيلاً، أو الأعلى رصيداً */
export function sortPatientRows(
  rows: readonly PatientRowView[],
  sortKey: PatientSortKey,
): PatientRowView[] {
  const sorted = [...rows];
  switch (sortKey) {
    case "name":
      return sorted.sort((a, b) =>
        a.patient.name.localeCompare(b.patient.name, "ar"),
      );
    case "newest":
      return sorted.sort(
        (a, b) =>
          new Date(b.patient.createdAt).getTime() -
          new Date(a.patient.createdAt).getTime(),
      );
    case "balance":
      return sorted.sort((a, b) => b.balanceUsd - a.balanceUsd);
  }
}
