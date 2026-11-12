import type { WaitlistStatus } from "@/lib/services/waitlist";
import type { BadgeTone } from "@/components/ui/Badge";

// بيانات عرض قائمة الانتظار — نقية بلا I/O. نوع الاستيراد من الخدمة
// فقط (type-only) فلا يُسحب أي كود خادم إلى حزمة المتصفح.

export const WAITLIST_STATUS_META: Record<
  WaitlistStatus,
  { label: string; tone: BadgeTone }
> = {
  WAITING: { label: "انتظار", tone: "warning" },
  OFFERED: { label: "قُدّمت له فجوة", tone: "info" },
  BOOKED: { label: "تم حجزه", tone: "success" },
};

/**
 * نقي — موضع نسبة لحظة زمنية داخل شريط النهار (0–100) لعرض الفجوات
 * وكتل الانشغال على خط يوم الطبيب.
 */
export function stripPercent(
  iso: string,
  windowStartMs: number,
  windowMs: number,
): number {
  if (windowMs <= 0) return 0;
  const pct = ((Date.parse(iso) - windowStartMs) / windowMs) * 100;
  return Math.min(100, Math.max(0, pct));
}

/** نقي — المرضى المنتظرون الذين تناسب مدة الفجوة الحجز الافتراضي لهم. */
export function suggestEntriesForGap<T extends { status: WaitlistStatus; priority: number }>(
  entries: T[],
): T[] {
  return entries
    .filter((e) => e.status === "WAITING")
    .sort((a, b) => b.priority - a.priority);
}
