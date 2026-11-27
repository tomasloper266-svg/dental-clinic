import { tMaybe, getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { getPatient } from "@/lib/services/patients";
import {
  deletePlanItem,
  parseResultStatus,
  parseUpdatePlanItem,
  startPlanItem,
  updatePlanItem,
} from "@/lib/services/treatment-plan";

type Params = { params: Promise<{ patientId: string; itemId: string }> };

// تعديل بند مخطط أو مقبول — البند المنفَّذ نهائي.
export async function PATCH(req: NextRequest, { params }: Params) {
  const t = await getRequestT(req);
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { patientId, itemId } = await params;
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

  const parsed = parseUpdatePlanItem(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const result = await updatePlanItem(ctx, patientId, itemId, parsed.value);
    if (!result.ok) {
      return NextResponse.json({ error: tMaybe(t, result.error) }, { status: 409 });
    }
    return NextResponse.json({ item: result.value }, { status: 200 });
  } catch (err) {
    console.error("[treatment-plan:update] failed:", err);
    return NextResponse.json({ error: t("api.planItemUpdateFailed") }, { status: 500 });
  }
}

// بدء التنفيذ: يتحول البند إلى منفذ ويُسجَّل مشاهدة علاج منفذ على السن.
export async function POST(req: NextRequest, { params }: Params) {
  const t = await getRequestT(req);
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { patientId, itemId } = await params;
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

  const parsed = parseResultStatus(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const result = await startPlanItem(ctx, patientId, itemId, parsed.value);
    if (!result.ok) {
      return NextResponse.json({ error: tMaybe(t, result.error) }, { status: 409 });
    }
    return NextResponse.json({ item: result.value.item }, { status: 200 });
  } catch (err) {
    console.error("[treatment-plan:start] failed:", err);
    return NextResponse.json({ error: t("api.planItemStartFailed") }, { status: 500 });
  }
}

// حذف بند غير منفذ — البند المنفذ نهائي.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const t = await getRequestT(_req);
  const gate = await requireGate(_req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { patientId, itemId } = await params;
  const result = await deletePlanItem(ctx, patientId, itemId);
  if (result === "NOT_FOUND") {
    return NextResponse.json({ error: t("api.planItemNotFound") }, { status: 404 });
  }
  if (result === "LOCKED") {
    return NextResponse.json(
      { error: t("api.planItemDoneImmutable") },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
