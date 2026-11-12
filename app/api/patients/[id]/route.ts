import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import {
  getPatient,
  parseUpdatePatient,
  updatePatient,
} from "@/lib/services/patients";

// معرّف المريض يُقرأ من المسار فقط، والعيادة من الجلسة حصراً —
// مريض عيادة أخرى يظهر كـ 404 ولا يُكشف وجوده أصلاً.

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const tenant = await requireTenant(_req);
  if (!tenant) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const patient = await getPatient(tenant, id);
  if (!patient) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }
  return NextResponse.json({ patient }, { status: 200 });
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const tenant = await requireTenant(req);
  if (!tenant) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parseUpdatePatient(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { id } = await ctx.params;
  try {
    const patient = await updatePatient(tenant, id, parsed.value);
    if (!patient) {
      return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ patient }, { status: 200 });
  } catch (err) {
    console.error("[patients:update] failed:", err);
    return NextResponse.json({ error: "تعذر تحديث المريض" }, { status: 500 });
  }
}
