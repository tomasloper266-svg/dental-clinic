// دوال عرض نقية لقائمة المرضى — تُختبر في وحدة منفصلة عن الشبكة وقاعدة البيانات.
// البحث (الاسم/الهاتف) يبقى من طرف الخادم عبر q، والفلاتر هنا تصفية زبونية
// فوق النتائج المرجعة بلا أي منطق عمل جديد.

import { parseMedicalNotes } from "./medical-notes";
import type { PatientDto } from "./services/patients";

export type PatientFlag = "allergies" | "conditions" | "medications";

export type PatientFilterKey = "ALL" | PatientFlag;

export const PATIENT_FILTERS: ReadonlyArray<{
  key: PatientFilterKey;
  label: string;
}> = [
  { key: "ALL", label: "الكل" },
  { key: "allergies", label: "لديه حساسية" },
  { key: "conditions", label: "أمراض مزمنة" },
  { key: "medications", label: "أدوية حالية" },
] as const;

/** أعلام الملاحظات الطبية لمريض واحد — من تركيب الملاحظات النصي فقط. */
export function patientNotesFlags(
  raw: string | null | undefined,
): Record<PatientFlag, boolean> {
  const notes = parseMedicalNotes(raw);
  return {
    allergies: Boolean(notes.allergies),
    conditions: Boolean(notes.conditions),
    medications: Boolean(notes.medications),
  };
}

/** عمر تقريبي من سنة الميلاد — للعرض فقط (سنة حالية − سنة الميلاد). */
export function ageFromBirthYear(birthYear: number | null): number | null {
  if (birthYear === null) return null;
  return new Date().getFullYear() - birthYear;
}

/** تصفية القائمة حسب الفلتر — ALL تعيد نسخة بنفس الترتيب الوارد. */
export function filterPatients(
  patients: readonly PatientDto[],
  filter: PatientFilterKey,
): PatientDto[] {
  if (filter === "ALL") return [...patients];
  return patients.filter((p) => patientNotesFlags(p.medicalNotes)[filter]);
}

/** عدد أصحاب كل علم — لعرض العدّاد بجانب كل فلتر. */
export function countFlags(
  patients: readonly PatientDto[],
): Record<PatientFlag, number> {
  const counts: Record<PatientFlag, number> = {
    allergies: 0,
    conditions: 0,
    medications: 0,
  };
  for (const patient of patients) {
    const flags = patientNotesFlags(patient.medicalNotes);
    if (flags.allergies) counts.allergies += 1;
    if (flags.conditions) counts.conditions += 1;
    if (flags.medications) counts.medications += 1;
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
  balanceSyp: number;
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
  entries: ReadonlyArray<{ patientId: string; amountSyp: number }>,
  appointments: ReadonlyArray<PatientVisitRecord>,
  now: Date,
): PatientRowView[] {
  const balances = new Map<string, number>();
  for (const entry of entries) {
    balances.set(
      entry.patientId,
      (balances.get(entry.patientId) ?? 0) + entry.amountSyp,
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
    balanceSyp: balances.get(patient.id) ?? 0,
    lastVisit: lastVisitMs.has(patient.id)
      ? new Date(lastVisitMs.get(patient.id) as number).toISOString()
      : null,
    nextVisit: nextVisitMs.has(patient.id)
      ? new Date(nextVisitMs.get(patient.id) as number).toISOString()
      : null,
  }));
}

/** نقي — بحث زبوني بالاسم أو الهاتف فوق الصفوف المحمّلة */
export function searchPatientRows(
  rows: readonly PatientRowView[],
  query: string,
): PatientRowView[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter(
    ({ patient }) =>
      patient.name.toLowerCase().includes(needle) ||
      (patient.phone ?? "").toLowerCase().includes(needle),
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
      return sorted.sort((a, b) => b.balanceSyp - a.balanceSyp);
  }
}
