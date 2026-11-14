import type { AppointmentStatus } from "@/lib/services/appointments";
import {
  badgeDotToneClasses,
  badgeToneClasses,
  type BadgeTone,
} from "@/components/ui/Badge";

// بيانات عرض حالات الموعد — تسمية عربية + ألوان tokens موحّدة عبر النظام كله
// (لوحة المواعيد، خط الزمن، ملف المريض، التذكيرات). كل حالة تحمل تسمية نصية
// صريحة حتى لا يعتمد التمييز على اللون وحده.

/** نبرة كل حالة — المصدر الوحيد لترتيب الألوان الدلالية في كل العروض */
const STATUS_TONES: Record<AppointmentStatus, BadgeTone> = {
  SCHEDULED: "info",
  CONFIRMED: "success",
  IN_TREATMENT: "warning",
  COMPLETED: "neutral",
  CANCELLED: "danger",
  NO_SHOW: "plum",
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "مجدول",
  CONFIRMED: "مؤكد",
  IN_TREATMENT: "قيد العلاج",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
  NO_SHOW: "لم يحضر",
};

/** أصناف بلوك التقويم لكل نبرة — خلفية هادئة وحدّ ولون نص قابل للقراءة */
const BLOCK_CLASSES: Record<BadgeTone, string> = {
  neutral: "border-warm-200 bg-surface-sunken text-warm-600",
  success: "border-primary-200 bg-primary-50 text-primary-800",
  warning: "border-warning-300 bg-warning-50 text-warning-900",
  danger: "border-danger-300 bg-danger-50 text-danger-700",
  info: "border-ink-200 bg-ink-50 text-ink-800",
  plum: "border-plum-200 bg-plum-50 text-plum-700",
};

export type StatusVisual = {
  label: string;
  tone: BadgeTone;
  /** أصناف الشارة الدائرية — نفس أصناف Badge */
  chip: string;
  /** نقطة/شريط لوني صلب — للنقاط المصغرة في التقويم والسطور */
  dot: string;
  /** أصناف بلوك التقويم — خلفية وحدّ ونص */
  block: string;
};

export const STATUS_META: Record<AppointmentStatus, StatusVisual> =
  Object.fromEntries(
    (Object.keys(STATUS_TONES) as AppointmentStatus[]).map((status) => {
      const tone = STATUS_TONES[status];
      return [
        status,
        {
          label: STATUS_LABELS[status],
          tone,
          chip: badgeToneClasses[tone],
          dot: badgeDotToneClasses[tone],
          block: BLOCK_CLASSES[tone],
        },
      ];
    }),
  ) as Record<AppointmentStatus, StatusVisual>;

// تسميات عربية للحالات تُستخدم في قوائم الانتقالات ورسائل الخطأ.
export const STATUS_LABEL = (status: AppointmentStatus): string =>
  STATUS_META[status].label;

const TIME_FMT = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  hour: "2-digit",
  minute: "2-digit",
  // ساعات كاملة بلا فترة ص/م — «09:00» و«13:00» بنمط المرجع.
  hourCycle: "h23",
});

const DATE_FMT = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function formatTime(date: Date | string): string {
  return TIME_FMT.format(new Date(date));
}

/** نطاق وقت الموعد «10:30 – 11:00» — من بدايته ومدته بالدقائق. */
export function timeRangeLabel(
  startsAt: Date | string,
  durationMin: number,
): string {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMin * 60_000);
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDayLabel(date: Date | string): string {
  return DATE_FMT.format(new Date(date));
}
