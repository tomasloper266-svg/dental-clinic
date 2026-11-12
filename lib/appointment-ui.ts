import type { AppointmentStatus } from "@/lib/services/appointments";

// بيانات عرض حالات الموعد — تسمية عربية + ألوان Tailwind. كل حالة تحمل
// تسمية نصية صريحة حتى لا يعتمد التمييز على اللون وحده.

export const STATUS_META: Record<
  AppointmentStatus,
  { label: string; chip: string }
> = {
  SCHEDULED: {
    label: "محجوز",
    chip: "bg-blue-50 text-blue-800 border-blue-200",
  },
  CONFIRMED: {
    label: "مؤكد",
    chip: "bg-teal-50 text-teal-800 border-teal-200",
  },
  IN_TREATMENT: {
    label: "قيد العلاج",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
  },
  COMPLETED: {
    label: "مكتمل",
    chip: "bg-gray-50 text-gray-600 border-gray-200",
  },
  CANCELLED: {
    label: "ملغى",
    chip: "bg-red-50 text-red-700 border-red-200",
  },
  NO_SHOW: {
    label: "لم يحضر",
    chip: "bg-purple-50 text-purple-800 border-purple-200",
  },
};

// تسميات عربية للحالات تُستخدم في قوائم الانتقالات ورسائل الخطأ.
export const STATUS_LABEL = (status: AppointmentStatus): string =>
  STATUS_META[status].label;

const TIME_FMT = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_FMT = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function formatTime(date: Date | string): string {
  return TIME_FMT.format(new Date(date));
}

export function formatDayLabel(date: Date | string): string {
  return DATE_FMT.format(new Date(date));
}
