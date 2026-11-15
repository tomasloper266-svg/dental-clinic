import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { getPatient } from "@/lib/services/patients";
import {
  createReadingSession,
  parseCreateReading,
  type CreateReadingInput,
} from "@/lib/services/periodontal";

type Params = { params: Promise<{ patientId: string }> };

// جلسة قياس دواعم جماعية — مدخل لموضع واحد لكل سن في جلسة واحدة، وكل
// القراءات تُلحق بتوقيت قياس واحد داخل معاملة واحدة. الإدخال غير الصالح
// يرفض الجلسة كاملة (400 مع موقع الخطأ) — لا جلسة جزئية صامتة.
export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { patientId } = await params;
  const patient = await getPatient(ctx, patientId);
  if (!patient) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const readings =
    typeof body === "object" && body !== null
      ? (body as { readings?: unknown }).readings
      : undefined;
  if (!Array.isArray(readings) || readings.length === 0) {
    return NextResponse.json(
      { error: "الجلسة تحتاج قياس سن واحد على الأقل" },
      { status: 400 },
    );
  }
  if (readings.length > 32) {
    return NextResponse.json(
      { error: "الجلسة تتجاوز عدد الأسنان الدائمة" },
      { status: 400 },
    );
  }

  // أي إدخال غير صالح يرفض الجلسة كاملة مع تحديد موقعه — لا تجزئة صامتة.
  const parsed = readings.map((entry) => parseCreateReading(entry));
  for (let i = 0; i < parsed.length; i++) {
    const result = parsed[i];
    if (!result.ok) {
      return NextResponse.json(
        { error: `القياس رقم ${i + 1} في الجلسة غير صالح: ${result.error}` },
        { status: 400 },
      );
    }
  }

  try {
    const inputs: CreateReadingInput[] = parsed.flatMap((p) =>
      p.ok ? [p.value] : [],
    );
    const created = await createReadingSession(ctx, patientId, inputs);
    return NextResponse.json({ readings: created }, { status: 201 });
  } catch (err) {
    console.error("[periodontal:session] failed:", err);
    return NextResponse.json(
      { error: "تعذر حفظ جلسة قياس الدواعم" },
      { status: 500 },
    );
  }
}
