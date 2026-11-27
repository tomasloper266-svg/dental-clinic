import { getServerT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_TTL_MS,
  adminCookieOptions,
  adminSessionCookieValue,
  verifyPlatformAdminKey,
} from "@/lib/auth/admin";

// دخول لوحة إدارة المنصة — سر مستقل عن حسابات العيادات (PLATFORM_ADMIN_KEY).
// النجاح يصدر كوكي جلسة إدارية (بصمة HMAC لا السر نفسه).
export async function POST(req: NextRequest) {
  const t = await getServerT();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const { key } = (body ?? {}) as { key?: unknown };
  if (typeof key !== "string" || !key) {
    return NextResponse.json({ error: t("api.admin.passwordRequired") }, { status: 400 });
  }

  if (!verifyPlatformAdminKey(key)) {
    return NextResponse.json({ error: t("api.admin.wrongPassword") }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(ADMIN_COOKIE, adminSessionCookieValue(), {
    ...adminCookieOptions(ADMIN_TTL_MS / 1000),
  });
  return res;
}
