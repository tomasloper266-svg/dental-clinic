import { NextRequest, NextResponse } from "next/server";
import { verifyPhoneRecovery } from "@/lib/auth/recovery";

// كشف أرقام الهواتف بعد إثبات ملكية البريد — لا يُعاد أي رقم قبل
// التحقق من الرمز.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email : "";
  const code = typeof raw.code === "string" ? raw.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "أدخل البريد الموثق ورمز التحقق من 6 أرقام" },
      { status: 400 },
    );
  }

  const result = await verifyPhoneRecovery({ email, code });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  return NextResponse.json({ accounts: result.accounts }, { status: 200 });
}
