import { NextRequest, NextResponse } from "next/server";
import { parseIdentifier, parseNewPassword, resetPassword } from "@/lib/auth/recovery";

// تعيين كلمة السر الجديدة — يتحقق من الرمز مرة أخيرة، يستهلكه، يحدّث الهاش،
// ويبطل كل جلسات الدخول القديمة على كل الأجهزة.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const identifier = parseIdentifier(body);
  if ("code" in identifier) {
    return NextResponse.json({ error: identifier.message }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const code = typeof raw.code === "string" ? raw.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "أدخل رمز التحقق المكوّن من 6 أرقام" },
      { status: 400 },
    );
  }
  const newPassword = parseNewPassword(body);
  if (typeof newPassword !== "string") {
    return NextResponse.json({ error: newPassword.message }, { status: 400 });
  }

  const verdict = await resetPassword({ identifier, code, newPassword });
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.error.message }, { status: 400 });
  }
  return NextResponse.json(
    { ok: true, message: "تم تعيين كلمة السر الجديدة — سجّل الدخول من جديد" },
    { status: 200 },
  );
}
