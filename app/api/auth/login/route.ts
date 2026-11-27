import { getRequestT } from "@/lib/i18n";
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
  const t = await getRequestT(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  // الحقل المعروض Username — نقبل أيضاً phone للتوافق مع العملاء الأقدم.
  const body2 = (body ?? {}) as Record<string, unknown>;
  const identifier =
    typeof body2.username === "string" && body2.username.trim()
      ? body2.username
      : typeof body2.phone === "string"
        ? body2.phone
        : undefined;
  const password = body2.password;
  if (typeof identifier !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: t("api.login.required") },
      { status: 400 },
    );
  }

  // تحديد المحاولات — المعرّف المغلق مؤقتاً يُرد بـ429 حتى قبل فحص كلمة السر
  const trimmedIdentifier = identifier.trim();
  const lockRemainingSec = loginLockRemainingSec(trimmedIdentifier);
  if (lockRemainingSec > 0) {
    return NextResponse.json(
      {
        error: t("api.lockedRetryMinutes", { minutes: Math.ceil(lockRemainingSec / 60) }),
      },
      { status: 429 },
    );
  }

  const user = await authenticate(trimmedIdentifier, password);
  if (!user) {
    recordLoginFailure(trimmedIdentifier);
    return NextResponse.json(
      { error: t("api.login.invalidCredentials") },
      { status: 401 },
    );
  }
  clearLoginAttempts(trimmedIdentifier);

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
