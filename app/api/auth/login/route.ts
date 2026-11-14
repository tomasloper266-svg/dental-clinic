import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/login";
import {
  clearLoginAttempts,
  loginLockRemainingSec,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";
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

  // تحديد المحاولات — الهاتف المغلق مؤقتاً يُرد بـ429 حتى قبل فحص كلمة السر
  const trimmedPhone = phone.trim();
  const lockRemainingSec = loginLockRemainingSec(trimmedPhone);
  if (lockRemainingSec > 0) {
    return NextResponse.json(
      {
        error: `تجاوزت عدد المحاولات — أعد المحاولة بعد ${Math.ceil(lockRemainingSec / 60)} دقيقة`,
      },
      { status: 429 },
    );
  }

  const user = await authenticate(trimmedPhone, password);
  if (!user) {
    recordLoginFailure(trimmedPhone);
    return NextResponse.json(
      { error: "رقم الهاتف أو كلمة السر غير صحيحة" },
      { status: 401 },
    );
  }
  clearLoginAttempts(trimmedPhone);

  const rememberMe = (body as Record<string, unknown>).rememberMe === true;
  const { token, expiresAt } = await createSession(user.userId, rememberMe);
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
