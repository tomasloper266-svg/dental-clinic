import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { getPatient } from "@/lib/services/patients";
import {
  createPlan,
  listPlans,
  parseCreatePlan,
} from "@/lib/services/treatment-plan";

type Params = { params: Promise<{ patientId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
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

  const { patientId } = await params;
  const patient = await getPatient(ctx, patientId);
  if (!patient) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }

  const plans = await listPlans(ctx, patientId);
  return NextResponse.json({ plans }, { status: 200 });
}

export async function POST(req: NextRequest, { params }: Params) {
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
