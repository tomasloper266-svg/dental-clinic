import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/login";
import {
  SESSION_COOKIE,
  createSession,
  purgeExpiredSessions,
  sessionCookieOptions,
} from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const { phone, password } = (body ?? {}) as {
    phone?: unknown;
    password?: unknown;
  };
  if (typeof phone !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "أدخل رقم الهاتف وكلمة السر" },
      { status: 400 },
    );
  }

  const user = await authenticate(phone.trim(), password);
  if (!user) {
    return NextResponse.json(
      { error: "رقم الهاتف أو كلمة السر غير صحيحة" },
      { status: 401 },
    );
  }

  const { token, expiresAt } = await createSession(user.userId);
  // تنظيف كسول للجلسات المنتهية — بلا مهمة مجدولة.
  purgeExpiredSessions().catch((err) =>
    console.error("[login] session purge failed:", err),
  );

  const res = NextResponse.json(
    { name: user.name, role: user.role, clinicId: user.clinicId },
    { status: 200 },
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
}
