import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { changePassword } from "@/lib/services/account";
import { SESSION_COOKIE } from "@/lib/auth/session";

// تغيير كلمة السر وهو مسجّل الدخول — يتطلب كلمة السر الحالية، ويبطل
// جلسات الأجهزة الأخرى مع إبقاء الجلسة الحالية.

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req);
  if (ctx === "LOCKED") {
    return NextResponse.json(
      { error: "التطبيق مقفل — أدخل الرمز الرقمي للفتح" },
      { status: 423 },
    );
  }
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const currentPassword =
    typeof raw.currentPassword === "string" ? raw.currentPassword : "";
  const newPassword =
    typeof raw.newPassword === "string" ? raw.newPassword : "";

  const result = await changePassword(ctx, {
    // التوكن القادم من الكوكي يحدد الجلسة الحالية التي تبقى حيّة.
    currentToken: req.cookies.get(SESSION_COOKIE)?.value,
    currentPassword,
    newPassword,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 200 });
}
