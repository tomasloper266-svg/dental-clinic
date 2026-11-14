import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { getPatient } from "@/lib/services/patients";
import {
  createPlanItem,
  listPlan,
  parseCreatePlanItem,
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

  const items = await listPlan(ctx, patientId);
  return NextResponse.json({ items }, { status: 200 });
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

  const parsed = parseCreatePlanItem(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const item = await createPlanItem(ctx, patientId, parsed.value);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    console.error("[treatment-plan:create] failed:", err);
    return NextResponse.json({ error: "تعذر إضافة بند الخطة" }, { status: 500 });
  }
}
