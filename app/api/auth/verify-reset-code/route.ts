import { tMaybe, getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { parseIdentifier, verifyPasswordResetCode } from "@/lib/auth/recovery";

// خطوة تحقق وسيطة — تؤكد صحة الرمز قبل عرض نموذج كلمة السر الجديدة،
// مع رسائل صريحة للانتهاء أو الخطأ. الاستهلاك النهائي في /reset-password.
export async function POST(req: NextRequest) {
  const t = await getRequestT(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const identifier = parseIdentifier(body);
  if ("code" in identifier) {
    return NextResponse.json({ error: tMaybe(t, identifier.message) }, { status: 400 });
  }
  const code =
    typeof (body as Record<string, unknown>).code === "string"
      ? ((body as Record<string, unknown>).code as string).trim()
      : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: t("api.codeRequired6") },
      { status: 400 },
    );
  }

  const verdict = await verifyPasswordResetCode({ identifier, code });
  if (!verdict.ok) {
    return NextResponse.json({ error: tMaybe(t, verdict.error.message) }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
