import { tMaybe, getRequestT } from "@/lib/i18n";
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
  const t = await getRequestT(req);
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { patientId } = await params;
  // التحقق من انتماء المريض للعيادة يتم عبر clinicScope — مريض عيادة أخرى يظهر كغير موجود.
  const patient = await getPatient(ctx, patientId);
  if (!patient) {
    return NextResponse.json({ error: t("api.patientNotFound") }, { status: 404 });
  }

  const readings = await listReadings(ctx, patientId);
  return NextResponse.json({ readings }, { status: 200 });
}

export async function POST(req: NextRequest, { params }: Params) {
  const t = await getRequestT(req);
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

  const parsed = parseCreateReading(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const reading = await createReading(ctx, patientId, parsed.value);
    return NextResponse.json({ reading }, { status: 201 });
  } catch (err) {
    console.error("[periodontal:create] failed:", err);
    return NextResponse.json({ error: t("api.periodontal.saveFailed") }, { status: 500 });
  }
}
