import { getServerT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { UNLOCK_COOKIE, unlockCookieValue } from "@/lib/auth/app-lock";
import { verifyLockPin } from "@/lib/services/account";

// قفل التطبيق — التحقق من الرمز الرقمي وإصدار كوكي فتح القفل، وإلغاؤه
// عند القفل اليدوي. كوكي الفتح كوكي جلسة متصفح بلا تاريخ انتهاء مكتوب،
// والجلسة نفسها لا تُمس — الفتح هويّة متصفح فقط لا تصريح إضافي.

export async function POST(req: NextRequest) {
  const t = await getServerT();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }
  const raw = body as { pin?: unknown };
  if (typeof raw.pin !== "string") {
    return NextResponse.json({ error: t("api.lock.pinRequired") }, { status: 400 });
  }

  const ctx = tenantContextFromSession(session);
  const unlocked = await verifyLockPin(ctx, raw.pin);
  if (!unlocked) {
    return NextResponse.json({ error: t("api.lock.wrongPin") }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(UNLOCK_COOKIE, unlockCookieValue(token ?? ""), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const t = await getServerT();
  const session = await getSessionUser(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.delete(UNLOCK_COOKIE);
  return res;
}
