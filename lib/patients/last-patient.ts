/**
 * «آخر مريض مُدار» — ذاكرة محلية تُستخدم في توجيه منتقي المريض
 * في /chart و/plans إلى المريض الذي كان الطبيب يعمل عليه آخر مرة.
 * الدوال نقية بحقن التخزين — قابلة للاختبار بلا jsdom حقيقي.
 */

export const LAST_PATIENT_KEY = "dental-clinic:last-patient-id";

/** أصغر واجهة تخزين تحتاجها الدوال — تطابق Storage في المتصفح */
export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** آخر معرّف محفوظ — null إن لم يوجد أو كان مخزناً فارغاً */
export function readLastPatientId(storage: KeyValueStorage): string | null {
  const value = storage.getItem(LAST_PATIENT_KEY);
  return value && value.length > 0 ? value : null;
}

/** حفظ/تحديث آخر مريض مُدار */
export function saveLastPatientId(
  storage: KeyValueStorage,
  patientId: string,
): void {
  storage.setItem(LAST_PATIENT_KEY, patientId);
}

/** حذف الذاكرة — مثلاً عند الخروج من الحساب */
export function clearLastPatientId(storage: KeyValueStorage): void {
  storage.removeItem(LAST_PATIENT_KEY);
}

/**
 * المريض المبدئي للمنتقي: آخر مريض محفوظ **بشرط بقائه في قائمة العيادة
 * الحالية** — وإلا null (قائمة محايدة) ولا يُوجَّه المستخدم لمعرّف غريب.
 * دالة نقية — القرار نفسه الذي يطبّقه المكوّن عند التركيب.
 */
export function pickLastKnownPatient(
  storage: KeyValueStorage,
  patients: readonly { id: string }[],
): string | null {
  const last = readLastPatientId(storage);
  if (!last) return null;
  return patients.some((patient) => patient.id === last) ? last : null;
}
