import { tMaybe, getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { recoverPhoneByRecoveryCode } from "@/lib/auth/recovery";

// استعادة رقم الهاتف برمز الاسترداد الاحتياطي — يُنشأ عند التسجيل
// ويُعرض مرة واحدة، وحيازته تثبت الملكية.
export async function POST(req: NextRequest) {
  const t = await getRequestT(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const recoveryCode = (body as Record<string, unknown>)?.recoveryCode;
  if (typeof recoveryCode !== "string") {
    return NextResponse.json(
      { error: t("api.recovery.codeRequired") },
      { status: 400 },
    );
  }

  const result = await recoverPhoneByRecoveryCode({ recoveryCode });
  if (!result.ok) {
    return NextResponse.json({ error: tMaybe(t, result.error.message) }, { status: 400 });
  }
  return NextResponse.json(
    { account: result.account },
    { status: 200 },
  );
}
