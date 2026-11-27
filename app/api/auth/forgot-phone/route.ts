import { getServerT, tMaybe } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requestPhoneRecoveryByEmail } from "@/lib/auth/recovery";

// طلب استعادة رقم الهاتف عبر البريد الإلكتروني الموثق — يُرسل رمز تحقق
// إلى البريد، والملكية تثبت عند إدخاله.
export async function POST(req: NextRequest) {
  const t = await getServerT();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const email = (body as Record<string, unknown>)?.email;
  if (typeof email !== "string") {
    return NextResponse.json(
      { error: t("api.forgotPhone.emailRequired") },
      { status: 400 },
    );
  }

  const result = await requestPhoneRecoveryByEmail(email);
  if (!result.ok) {
    return NextResponse.json({ error: tMaybe(t, result.error.message) }, { status: 400 });
  }
  return NextResponse.json(
    {
      delivered: result.delivered,
      fallbackCode: result.fallbackCode,
      destinationHint: result.destinationHint,
    },
    { status: 200 },
  );
}
