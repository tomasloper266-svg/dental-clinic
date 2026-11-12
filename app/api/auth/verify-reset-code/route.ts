import { NextRequest, NextResponse } from "next/server";
import { parseIdentifier, verifyPasswordResetCode } from "@/lib/auth/recovery";

// خطوة تحقق وسيطة — تؤكد صحة الرمز قبل عرض نموذج كلمة السر الجديدة،
// مع رسائل صريحة للانتهاء أو الخطأ. الاستهلاك النهائي في /reset-password.
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
  const code =
    typeof (body as Record<string, unknown>).code === "string"
      ? ((body as Record<string, unknown>).code as string).trim()
      : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "أدخل رمز التحقق المكوّن من 6 أرقام" },
      { status: 400 },
    );
  }

  const verdict = await verifyPasswordResetCode({ identifier, code });
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
