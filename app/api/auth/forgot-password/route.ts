import { tMaybe, getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { parseIdentifier, requestPasswordReset } from "@/lib/auth/recovery";

// طلب رمز استعادة كلمة المرور — عبر هاتف أو بريد إلكتروني موثق.
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

  const result = await requestPasswordReset(identifier);
  if (!result.ok) {
    return NextResponse.json({ error: tMaybe(t, result.error.message) }, { status: 400 });
  }

  return NextResponse.json(
    {
      delivered: result.delivered,
      // مسار الإظهار الآمن البديل — يُعرض في الواجهة بتحذير صريح حين لا
      // تُربط قناة SMS/بريد بعد (انظر lib/notifications/delivery.ts).
      fallbackCode: result.fallbackCode,
      destinationHint: result.destinationHint,
    },
    { status: 200 },
  );
}
