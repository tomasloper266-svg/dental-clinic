import { getServerT, tMaybe } from "@/lib/i18n";
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
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { patientId } = await params;
  // التحقق من انتماء المريض للعيادة يتم عبر clinicScope — مريض عيادة أخرى يظهر كغير موجود.
  const patient = await getPatient(ctx, patientId);
  if (!patient) {
    return NextResponse.json({ error: t("api.patientNotFound") }, { status: 404 });
  }

  const findings = await listFindings(ctx, patientId);
  return NextResponse.json({ findings }, { status: 200 });
}

export async function POST(req: NextRequest, { params }: Params) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { patientId } = await params;
  const patient = await getPatient(ctx, patientId);
  if (!patient) {
    return NextResponse.json({ error: t("api.patientNotFound") }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const parsed = parseCreateFinding(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const finding = await createFinding(ctx, patientId, parsed.value);
    return NextResponse.json({ finding }, { status: 201 });
  } catch (err) {
    console.error("[findings:create] failed:", err);
    return NextResponse.json({ error: t("api.findingSaveFailed") }, { status: 500 });
  }
}
