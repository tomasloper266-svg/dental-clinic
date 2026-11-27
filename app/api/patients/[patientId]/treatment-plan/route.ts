import { tMaybe, getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { getPatient } from "@/lib/services/patients";
import {
  createPlanItem,
  listPlan,
  parseCreatePlanItem,
} from "@/lib/services/treatment-plan";

type Params = { params: Promise<{ patientId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const t = await getRequestT(req);
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { patientId } = await params;
  const patient = await getPatient(ctx, patientId);
  if (!patient) {
    return NextResponse.json({ error: t("api.patientNotFound") }, { status: 404 });
  }

  const items = await listPlan(ctx, patientId);
  return NextResponse.json({ items }, { status: 200 });
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

  const parsed = parseCreatePlanItem(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const item = await createPlanItem(ctx, patientId, parsed.value);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    console.error("[treatment-plan:create] failed:", err);
    return NextResponse.json({ error: t("api.planItemAddFailed") }, { status: 500 });
  }
}
