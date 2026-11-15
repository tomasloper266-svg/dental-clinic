import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { UNLOCK_COOKIE, isUnlocked } from "@/lib/auth/app-lock";
import { getSubscriptionState } from "@/lib/billing/state";
import { tenantContextFromSession } from "@/lib/tenant/context";
import type { TenantContext } from "@/lib/tenant/context";

// نقطة الدخول الوحيدة لـ route handlers: يقرأ الجلسة من الكوكي ويعيد
// سياق العيادة — أو null لطلب غير مصادق (يرد عليه الـ handler بـ 401).
//
// قفل التطبيق حماية حقيقية لا زينة: حساب مفعّل القفل وتصفح مقفل يعيد
// "LOCKED" لكل واجهات البيانات — الجلسة الصالحة وحدها لا تخدم شيئاً
// قبل إدخال الرمز الرقمي. مسار /api/auth/* و/api/lock لا يمران من هنا
// (دخول وفتح القفل حصراً).
//
// بوابة الاشتراك هنا أيضاً: عيادة منتهية التجربة/الاشتراك تعيد "EXPIRED"
// — قرار المنع من تواريخ القاعدة على السيرفر حصراً، والاستجابة 402.
export type TenantGuard = TenantContext | "LOCKED" | "EXPIRED" | null;

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

  // الاشتراك يُفحص بعد القفل — كلاهما مانع كامل، والترتيب لا يسرّب شيئاً
  const state = await getSubscriptionState(session.clinicId);
  if (!state || state.status === "EXPIRED") return "EXPIRED";

  return tenantContextFromSession(session);
}

export type TenantGate =
  | { ok: true; ctx: TenantContext }
  | { ok: false; response: NextResponse };

/** خريطة الحارس إلى استجابة HTTP — استبدال كتل الفحص المكررة في كل handler */
export function tenantGateFromGuard(guard: TenantGuard): TenantGate {
  if (guard === null) {
    return {
      ok: false,
      response: NextResponse.json({ error: "غير مصرح" }, { status: 401 }),
    };
  }
  if (guard === "LOCKED") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "التطبيق مقفل — أدخل الرمز الرقمي للفتح" },
        { status: 423 },
      ),
    };
  }
  if (guard === "EXPIRED") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "انتهى اشتراك العيادة — جدّد الاشتراك من صفحة الاشتراك للمتابعة (بياناتك محفوظة)",
        },
        { status: 402 },
      ),
    };
  }
  return { ok: true, ctx: guard };
}

/** البوابة الكاملة لكل handler: مصادقة + قفل + اشتراك في استدعاء واحد */
export async function requireGate(req: NextRequest): Promise<TenantGate> {
  return tenantGateFromGuard(await requireTenant(req));
}
