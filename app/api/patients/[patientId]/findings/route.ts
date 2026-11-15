import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { getPatient } from "@/lib/services/patients";
import {
  createFinding,
  listFindings,
  parseCreateFinding,
} from "@/lib/services/findings";

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

  const findings = await listFindings(ctx, patientId);
  return NextResponse.json({ findings }, { status: 200 });
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

  const parsed = parseCreateFinding(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const finding = await createFinding(ctx, patientId, parsed.value);
    return NextResponse.json({ finding }, { status: 201 });
  } catch (err) {
    console.error("[findings:create] failed:", err);
    return NextResponse.json({ error: "تعذر تسجيل المشاهدة" }, { status: 500 });
  }
}
