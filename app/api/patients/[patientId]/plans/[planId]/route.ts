import { getServerT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { getPatient } from "@/lib/services/patients";
import { deletePlan, endPlan } from "@/lib/services/treatment-plan";

type Params = { params: Promise<{ patientId: string; planId: string }> };

// إنهاء الخطة — طابع زمني على endedAt وتبقى البنود كما هي
export async function PATCH(req: NextRequest, { params }: Params) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { patientId, planId } = await params;
  const patient = await getPatient(ctx, patientId);
  if (!patient) {
    return NextResponse.json({ error: t("api.patientNotFound") }, { status: 404 });
  }

  const ended = await endPlan(ctx, patientId, planId);
  if (!ended) {
    return NextResponse.json(
      { error: t("api.planNotFoundOrEnded") },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

// حذف الخطة مع بنودها
export async function DELETE(req: NextRequest, { params }: Params) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { patientId, planId } = await params;
  const patient = await getPatient(ctx, patientId);
  if (!patient) {
    return NextResponse.json({ error: t("api.patientNotFound") }, { status: 404 });
  }

  const deleted = await deletePlan(ctx, patientId, planId);
  if (!deleted) {
    return NextResponse.json(
      { error: t("api.planNotFound") },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
