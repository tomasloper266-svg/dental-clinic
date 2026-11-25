import { NextRequest, NextResponse } from "next/server";
import { parseNewPassword, resetPasswordByRecoveryCode } from "@/lib/auth/recovery";

// تعيين كلمة سر جديدة بحيازة رمز الاسترداد الاحتياطي — حيازته تثبت الملكية.
// يحدّث الهاش ويفسخ كل جلسات الدخول القديمة على كل الأجهزة.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const recoveryCode = typeof raw.recoveryCode === "string" ? raw.recoveryCode : "";
  if (!recoveryCode.trim()) {
    return NextResponse.json(
      { error: "Enter the backup recovery code" },
      { status: 400 },
    );
  }
  const newPassword = parseNewPassword(body);
  if (typeof newPassword !== "string") {
    return NextResponse.json({ error: newPassword.message }, { status: 400 });
  }

  const verdict = await resetPasswordByRecoveryCode({ recoveryCode, newPassword });
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.error.message }, { status: 400 });
  }
  return NextResponse.json(
    { ok: true, message: "Your password has been updated — sign in with the new password" },
    { status: 200 },
  );
}
