import { getServerT, tMaybe } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import {
  requestEmailVerification,
  verifyEmail,
} from "@/lib/services/account";

// ربط البريد الإلكتروني بالحساب — طلب رمز ثم تأكيده. البريد لا يصبح
// «موثقاً» إلا بعد إدخال الرمز الصحيح.

export async function POST(req: NextRequest) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email : "";
  const code = typeof raw.code === "string" ? raw.code.trim() : "";

  // action=request يرسل رمزاً؛ action=verify يؤكد الرمز ويربط البريد.
  if (raw.action === "verify") {
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: t("api.codeRequired6Short") },
        { status: 400 },
      );
    }
    const result = await verifyEmail(ctx, email, code);
    if (!result.ok) {
      return NextResponse.json({ error: tMaybe(t, result.error.message) }, { status: 400 });
    }
    return NextResponse.json(result.value, { status: 200 });
  }

  const result = await requestEmailVerification(ctx, email);
  if (!result.ok) {
    return NextResponse.json({ error: tMaybe(t, result.error.message) }, { status: 400 });
  }
  return NextResponse.json(
    {
      delivered: result.value.delivered,
      fallbackCode: result.value.fallbackCode,
      destinationHint: email,
    },
    { status: 200 },
  );
}
