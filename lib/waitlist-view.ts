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

/** ترتيب حالات قائمة الانتظار في حبوب التصفية. */
export const WAITLIST_STATUS_ORDER = ["WAITING", "OFFERED", "BOOKED"] as const;

/** قيمة حبوب تصفية الحالة — all تعرض الجميع. */
export type WaitlistStatusFilter = WaitlistStatus | "all";

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

/**
 * نقي — تصفية المرضى المنتظرين بنص حر (الاسم أو الملاحظة) وحالة واحدة،
 * لشريط أدوات البحث/التصفية في لوحة قائمة الانتظار.
 */
export function filterWaitlistEntries<T extends { patientName: string; note?: string | null; status: WaitlistStatus }>(
  entries: readonly T[],
  query: string,
  status: WaitlistStatus | "all",
): T[] {
  const q = query.trim();
  return entries.filter((entry) => {
    if (status !== "all" && entry.status !== status) return false;
    if (!q) return true;
    return entry.patientName.includes(q) || (entry.note ?? "").includes(q);
  });
}

/** نقي — المرضى المنتظرون الذين تناسب مدة الفجوة الحجز الافتراضي لهم. */
export function suggestEntriesForGap<T extends { status: WaitlistStatus; priority: number }>(
  entries: T[],
): T[] {
  return entries
    .filter((e) => e.status === "WAITING")
    .sort((a, b) => b.priority - a.priority);
}
