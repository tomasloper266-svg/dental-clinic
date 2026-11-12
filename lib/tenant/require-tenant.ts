import type { NextRequest } from "next/server";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import type { TenantContext } from "@/lib/tenant/context";

// نقطة الدخول الوحيدة لـ route handlers: يقرأ الجلسة من الكوكي ويعيد
// سياق العيادة — أو null لطلب غير مصادق (يرد عليه الـ handler بـ 401).
export async function requireTenant(
  req: NextRequest,
): Promise<TenantContext | null> {
  const session = await getSessionUser(req.cookies.get(SESSION_COOKIE)?.value);
  return session ? tenantContextFromSession(session) : null;
}
