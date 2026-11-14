import { createHash } from "node:crypto";

// كوكي فتح القفل — كوكي جلسة منفصل يُنشأ عند إدخال الرمز الرقمي الصحيح
// ويموت مع جلسة المتصفح. قيمته مشتقة من توكين الجلسة نفسه، فتسجيل الخروج
// أو انتهاء الجلسة يلغيها تلقائياً بلا أي تخزين إضافي في القاعدة.

export const UNLOCK_COOKIE = "app-unlock";

/** قيمة كوكي الفتح — مشتقة من توكين الجلسة حصراً */
export function unlockCookieValue(sessionToken: string): string {
  return createHash("sha256").update(`lock:${sessionToken}`).digest("hex");
}

/** هل جلسة المتصفح مفتوحة القفل؟ — يقرأها غلاف الصفحات وصفحة القفل */
export function isUnlocked(
  sessionToken: string | undefined,
  unlockCookie: string | undefined,
): boolean {
  if (!sessionToken || !unlockCookie) return false;
  return unlockCookie === unlockCookieValue(sessionToken);
}
