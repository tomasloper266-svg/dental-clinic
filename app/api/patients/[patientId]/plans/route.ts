import { getServerT, tMaybe } from "@/lib/i18n";
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
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { patientId } = await params;
  const patient = await getPatient(ctx, patientId);
  if (!patient) {
    return NextResponse.json({ error: t("api.patientNotFound") }, { status: 404 });
  }

  const plans = await listPlans(ctx, patientId);
  return NextResponse.json({ plans }, { status: 200 });
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

  const parsed = parseCreatePlan(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const plan = await createPlan(ctx, patientId, parsed.value);
    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    console.error("[plans:create] failed:", err);
    return NextResponse.json({ error: t("api.planCreateFailed") }, { status: 500 });
  }
}
