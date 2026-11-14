import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import {
  listInstructionSends,
  parseSendInstruction,
  recordInstructionSend,
} from "@/lib/services/instructions";

type Params = { params: Promise<{ patientId: string }> };

// سجل تعليمات المريض — قراءة تاريخ ما أُرسل، وتسجيل إرسال جديد.
// الإرسال نفسه يتم من جهاز الطبيب عبر واتساب أو نسخ نصي؛ هنا يُسجَّل القيد
// الإلحاقي (ما أُرسل، بأي قناة، ومتى، ومن الذي أرسله).

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req);
  if (ctx === "LOCKED") {
    return NextResponse.json(
      { error: "التطبيق مقفل — أدخل الرمز الرقمي للفتح" },
      { status: 423 },
    );
  }
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { patientId } = await params;
  const sends = await listInstructionSends(ctx, patientId);
  return NextResponse.json({ sends }, { status: 200 });
}

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req);
  if (ctx === "LOCKED") {
    return NextResponse.json(
      { error: "التطبيق مقفل — أدخل الرمز الرقمي للفتح" },
      { status: 423 },
    );
  }
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { patientId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parseSendInstruction(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const send = await recordInstructionSend(ctx, patientId, parsed.value);
  if (!send) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }
  return NextResponse.json({ send }, { status: 201 });
}
