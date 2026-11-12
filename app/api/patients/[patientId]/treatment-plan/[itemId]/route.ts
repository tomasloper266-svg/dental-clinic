import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { getPatient } from "@/lib/services/patients";
import {
  parseResultStatus,
  parseUpdatePlanItem,
  startPlanItem,
  updatePlanItem,
} from "@/lib/services/treatment-plan";

type Params = { params: Promise<{ patientId: string; itemId: string }> };

// تعديل بند مخطط أو مقبول — البند المنفَّذ نهائي.
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { patientId, itemId } = await params;
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

  const parsed = parseUpdatePlanItem(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await updatePlanItem(ctx, patientId, itemId, parsed.value);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    return NextResponse.json({ item: result.value }, { status: 200 });
  } catch (err) {
    console.error("[treatment-plan:update] failed:", err);
    return NextResponse.json({ error: "تعذر تعديل البند" }, { status: 500 });
  }
}

// بدء التنفيذ: يتحول البند إلى منفذ ويُسجَّل مشاهدة علاج منفذ على السن.
export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { patientId, itemId } = await params;
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

  const parsed = parseResultStatus(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await startPlanItem(ctx, patientId, itemId, parsed.value);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    return NextResponse.json({ item: result.value.item }, { status: 200 });
  } catch (err) {
    console.error("[treatment-plan:start] failed:", err);
    return NextResponse.json({ error: "تعذر بدء تنفيذ البند" }, { status: 500 });
  }
}
