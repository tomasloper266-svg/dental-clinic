import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { getPatient } from "@/lib/services/patients";
import {
  createReading,
  listReadings,
  parseCreateReading,
} from "@/lib/services/periodontal";

type Params = { params: Promise<{ patientId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { patientId } = await params;
  // التحقق من انتماء المريض للعيادة يتم عبر clinicScope — مريض عيادة أخرى يظهر كغير موجود.
  const patient = await getPatient(ctx, patientId);
  if (!patient) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }

  const readings = await listReadings(ctx, patientId);
  return NextResponse.json({ readings }, { status: 200 });
}

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

  const parsed = parseCreateReading(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const reading = await createReading(ctx, patientId, parsed.value);
    return NextResponse.json({ reading }, { status: 201 });
  } catch (err) {
    console.error("[periodontal:create] failed:", err);
    return NextResponse.json({ error: "تعذر تسجيل قياس الدواعم" }, { status: 500 });
  }
}
