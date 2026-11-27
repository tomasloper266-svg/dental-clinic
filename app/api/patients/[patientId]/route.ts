import { getServerT, keyForSourceText, tMaybe } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import {
  deletePatient,
  getPatient,
  parseUpdatePatient,
  updatePatient,
} from "@/lib/services/patients";

// معرّف المريض يُقرأ من المسار فقط، والعيادة من الجلسة حصراً —
// مريض عيادة أخرى يظهر كـ 404 ولا يُكشف وجوده أصلاً.

type RouteContext = { params: Promise<{ patientId: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const t = await getServerT();
  const gate = await requireGate(_req);
  if (!gate.ok) return gate.response;
  const tenant = gate.ctx;

  const { patientId: id } = await ctx.params;
  const patient = await getPatient(tenant, id);
  if (!patient) {
    return NextResponse.json({ error: t("api.patientNotFound") }, { status: 404 });
  }
  return NextResponse.json({ patient }, { status: 200 });
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const tenant = gate.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const parsed = parseUpdatePatient(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  const { patientId: id } = await ctx.params;
  try {
    const patient = await updatePatient(tenant, id, parsed.value);
    if (!patient) {
      return NextResponse.json({ error: t("api.patientNotFound") }, { status: 404 });
    }
    return NextResponse.json({ patient }, { status: 200 });
  } catch (err) {
    console.error("[patients:update] failed:", err);
    return NextResponse.json({ error: t("api.patientUpdateFailed") }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const t = await getServerT();
  const gate = await requireGate(_req);
  if (!gate.ok) return gate.response;
  const tenant = gate.ctx;

  const { patientId: id } = await ctx.params;
  try {
    const result = await deletePatient(tenant, id);
    if (!result.ok) {
      // مريض غير موجود يعيد 404، ورفض حذف سجل محفوظ يعيد 409 تعارضاً.
      return NextResponse.json(
        { error: tMaybe(t, result.error) },
        { status: keyForSourceText(result.error) === "api.patientNotFound" ? 404 : 409 },
      );
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[patients:delete] failed:", err);
    return NextResponse.json({ error: t("api.patientDeleteFailed") }, { status: 500 });
  }
}
