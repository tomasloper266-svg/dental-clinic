import { tMaybe, getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { verifyPhoneRecovery } from "@/lib/auth/recovery";

// كشف أرقام الهواتف بعد إثبات ملكية البريد — لا يُعاد أي رقم قبل
// التحقق من الرمز.
export async function POST(req: NextRequest) {
  const t = await getRequestT(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email : "";
  const code = typeof raw.code === "string" ? raw.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: t("api.forgotPhone.emailAndCodeRequired") },
      { status: 400 },
    );
  }

  const result = await verifyPhoneRecovery({ email, code });
  if (!result.ok) {
    return NextResponse.json({ error: tMaybe(t, result.error.message) }, { status: 400 });
  }
  return NextResponse.json({ accounts: result.accounts }, { status: 200 });
}
