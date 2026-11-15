import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { getPatient } from "@/lib/services/patients";
import {
  createPlan,
  listPlans,
  parseCreatePlan,
} from "@/lib/services/treatment-plan";

type Params = { params: Promise<{ patientId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { patientId } = await params;
  const patient = await getPatient(ctx, patientId);
  if (!patient) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }

  const plans = await listPlans(ctx, patientId);
  return NextResponse.json({ plans }, { status: 200 });
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

  const parsed = parseCreatePlan(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const plan = await createPlan(ctx, patientId, parsed.value);
    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    console.error("[plans:create] failed:", err);
    return NextResponse.json({ error: "تعذر إنشاء الخطة" }, { status: 500 });
  }
}
