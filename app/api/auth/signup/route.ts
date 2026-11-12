import { NextRequest, NextResponse } from "next/server";
import { parseSignup } from "@/lib/auth/signup";
import { createClinicWithOwner } from "@/lib/auth/create-clinic";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parseSignup(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const created = await createClinicWithOwner(parsed.value);
    // الجلسة الأولى تُفتح فوراً — الإعداد يبدأ دون إعادة تسجيل دخول.
    const res = NextResponse.json(
      {
        clinicId: created.clinicId,
        // رمز الاسترداد يُعرض مرة واحدة فقط — لا نسخة ثانية على الخادم.
        recoveryCode: created.recoveryCode,
      },
      { status: 201 },
    );
    res.cookies.set(
      SESSION_COOKIE,
      created.session.token,
      sessionCookieOptions(created.session.expiresAt),
    );
    return res;
  } catch (err) {
    // خطأ غير متوقع (اتصال قاعدة بيانات، قيد، ...) — يُسجل ولا يُكتم.
    console.error("[signup] failed to create clinic:", err);
    return NextResponse.json(
      { error: "تعذر إنشاء العيادة، حاول مرة أخرى" },
      { status: 500 },
    );
  }
}
