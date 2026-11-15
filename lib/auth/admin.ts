import { createHmac, timingSafeEqual } from "node:crypto";

// جلسة إدارية منفصلة تماماً عن جلسات العيادات — سر المنصة متغير بيئة
// (PLATFORM_ADMIN_KEY) ولا يُخزَّن في القاعدة ولا يظهر في السجلات. الكوكي
// يحمل بصمة HMAC للسر لا السر نفسه، والتحقق بإعادة الحساب بمقارنة زمن-ثابت.

export const ADMIN_COOKIE = "admin_session";
/** عمر الجلسة الإدارية — 12 ساعة تكفي جولة مراجعة */
export const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

function platformAdminKey(): string | undefined {
  const key = process.env.PLATFORM_ADMIN_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

/** هل أُعد سر المنصة؟ — بلا سر، اللوحة معطلة بلا رسالة سرية */
export function isPlatformAdminConfigured(): boolean {
  return platformAdminKey() !== undefined;
}

function adminSessionToken(key: string): string {
  return createHmac("sha256", key).update("obvious-platform-admin-v1").digest("hex");
}

export function adminCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** هل المفتاح المُدخل صحيح؟ — مقارنة زمن-ثابت كي لا يتسرّب الطول أو البادئة */
export function verifyPlatformAdminKey(candidate: string): boolean {
  const key = platformAdminKey();
  if (!key) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(key);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** كوكي الجلسة الإدارية بعد دخول ناجح — بصمة تُتحقق بإعادة الحساب */
export function adminSessionCookieValue(): string {
  const key = platformAdminKey();
  if (!key) throw new Error("PLATFORM_ADMIN_KEY غير مهيأ");
  return adminSessionToken(key);
}

/** هل حامل الطلب مدير منصة صالح؟ — يُقرأ من كوكيز الطلب أو مخزن الكوكيز */
export function isAdminSession(cookies: {
  get(name: string): { value?: string } | undefined;
}): boolean {
  const key = platformAdminKey();
  if (!key) return false;
  const cookie = cookies.get(ADMIN_COOKIE)?.value;
  if (!cookie) return false;
  const expected = adminSessionToken(key);
  const a = Buffer.from(cookie);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
