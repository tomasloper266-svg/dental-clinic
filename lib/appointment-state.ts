// آلة حالات الموعد — النسخة النقية بلا I/O. آمنة للاستيراد من مكوّنات
// العميل: لا تسحب قاعدة البيانات إلى حزمة المتصفح. منطق الخادم
// (changeAppointmentStatus) في lib/services/appointment-state.ts.

export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "IN_TREATMENT"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "IN_TREATMENT",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

// الانتقالات المسموحة فقط: محجوز→مؤكد→قيد العلاج→مكتمل،
// ومن محجوز/مؤكد→ملغى أو لم يحضر. الحالات النهائية بلا مخارج.
export const ALLOWED_TRANSITIONS: Record<
  AppointmentStatus,
  AppointmentStatus[]
> = {
  SCHEDULED: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_TREATMENT", "CANCELLED", "NO_SHOW"],
  IN_TREATMENT: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

// نقي — يُختبر لكل زوج من الحالات.
export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
