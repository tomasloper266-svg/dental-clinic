import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { getPatient } from "@/lib/services/patients";
import { deletePlan, endPlan } from "@/lib/services/treatment-plan";

type Params = { params: Promise<{ patientId: string; planId: string }> };

// إنهاء الخطة — طابع زمني على endedAt وتبقى البنود كما هي
export async function PATCH(req: NextRequest, { params }: Params) {
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

  const { patientId, planId } = await params;
  const patient = await getPatient(ctx, patientId);
  if (!patient) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }

  const ended = await endPlan(ctx, patientId, planId);
  if (!ended) {
    return NextResponse.json(
      { error: "الخطة غير موجودة أو منتهية مسبقاً" },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

// حذف الخطة مع بنودها
export async function DELETE(req: NextRequest, { params }: Params) {
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

  const { patientId, planId } = await params;
  const patient = await getPatient(ctx, patientId);
  if (!patient) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }

  const deleted = await deletePlan(ctx, patientId, planId);
  if (!deleted) {
    return NextResponse.json(
      { error: "الخطة غير موجودة" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
