import { NextRequest, NextResponse } from "next/server";
import { recoverPhoneByRecoveryCode } from "@/lib/auth/recovery";

// استعادة رقم الهاتف برمز الاسترداد الاحتياطي — يُنشأ عند التسجيل
// ويُعرض مرة واحدة، وحيازته تثبت الملكية.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const recoveryCode = (body as Record<string, unknown>)?.recoveryCode;
  if (typeof recoveryCode !== "string") {
    return NextResponse.json(
      { error: "أدخل رمز الاسترداد الاحتياطي" },
      { status: 400 },
    );
  }

  const result = await recoverPhoneByRecoveryCode({ recoveryCode });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  return NextResponse.json(
    { account: result.account },
    { status: 200 },
  );
}
