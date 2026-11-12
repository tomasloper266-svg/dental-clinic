import { NextRequest, NextResponse } from "next/server";
import { requestPhoneRecoveryByEmail } from "@/lib/auth/recovery";

// طلب استعادة رقم الهاتف عبر البريد الإلكتروني الموثق — يُرسل رمز تحقق
// إلى البريد، والملكية تثبت عند إدخاله.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const email = (body as Record<string, unknown>)?.email;
  if (typeof email !== "string") {
    return NextResponse.json(
      { error: "أدخل البريد الإلكتروني الموثق" },
      { status: 400 },
    );
  }

  const result = await requestPhoneRecoveryByEmail(email);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
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
