import type { AppointmentStatus } from "@/lib/services/appointments";
import {
  badgeDotToneClasses,
  badgeToneClasses,
  type BadgeTone,
} from "@/components/ui/Badge";
import { formatDate, formatTime as i18nFormatTime } from "@/lib/i18n/format";
import type { Locale, TranslationKey } from "@/lib/i18n/core";

// بيانات عرض حالات الموعد — تسمية عربية افتراضية + مفتاح قاموس للترجمة حسب
// اللغة عند الرسم + ألوان tokens موحّدة عبر النظام كله
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
  /** التسمية العربية الافتراضية — لما يبقى الرسم عربياً دون مزود سياق */
  label: string;
  /** مفتاح القاموس — يُترجم عند الرسم حسب اللغة */
  labelKey: TranslationKey;
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
          labelKey: `status.${status}` as TranslationKey,
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

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  // ساعات كاملة بلا فترة ص/م — «09:00» و«13:00» بنمط المرجع.
  hourCycle: "h23",
};

export function formatTime(date: Date | string, locale: Locale = "ar"): string {
  return i18nFormatTime(date, locale, TIME_OPTS);
}

/** نطاق وقت الموعد «10:30 – 11:00» — من بدايته ومدته بالدقائق. */
export function timeRangeLabel(
  startsAt: Date | string,
  durationMin: number,
  locale: Locale = "ar",
): string {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMin * 60_000);
  return `${formatTime(start, locale)} – ${formatTime(end, locale)}`;
}

const DAY_OPTS: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
};

export function formatDayLabel(
  date: Date | string,
  locale: Locale = "ar",
): string {
  return formatDate(date, locale, DAY_OPTS);
}
