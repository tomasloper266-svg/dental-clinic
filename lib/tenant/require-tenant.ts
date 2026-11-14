import type { NextRequest } from "next/server";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { UNLOCK_COOKIE, isUnlocked } from "@/lib/auth/app-lock";
import { tenantContextFromSession } from "@/lib/tenant/context";
import type { TenantContext } from "@/lib/tenant/context";

// نقطة الدخول الوحيدة لـ route handlers: يقرأ الجلسة من الكوكي ويعيد
// سياق العيادة — أو null لطلب غير مصادق (يرد عليه الـ handler بـ 401).
//
// قفل التطبيق حماية حقيقية لا زينة: حساب مفعّل القفل وتصفح مقفل يعيد
// "LOCKED" لكل واجهات البيانات — الجلسة الصالحة وحدها لا تخدم شيئاً
// قبل إدخال الرمز الرقمي. مسار /api/auth/* و/api/lock لا يمران من هنا
// (دخول وفتح القفل حصراً).
export type TenantGuard = TenantContext | "LOCKED" | null;

export async function requireTenant(
  req: NextRequest,
): Promise<TenantGuard> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await getSessionUser(token);
  if (!session) return null;

  if (
    session.lockEnabled &&
    !isUnlocked(token, req.cookies.get(UNLOCK_COOKIE)?.value)
  ) {
    return "LOCKED";
  }

  return tenantContextFromSession(session);
}
