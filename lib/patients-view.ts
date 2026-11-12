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
