import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import {
  getAccountOverview,
  updateProfile,
} from "@/lib/services/account";

// إعداد الحساب — لمحة الحساب وتحديث أسماء الطبيب/العيادة.
// رقم الهاتف لا يُعدَّل هنا إطلاقاً — تغييره يتطلب إثبات ملكية منفصل.

export async function GET(req: NextRequest) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const overview = await getAccountOverview(ctx);
  return NextResponse.json(overview, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;

  const result = await updateProfile(ctx, {
    name: typeof raw.name === "string" ? raw.name : undefined,
    clinicName: typeof raw.clinicName === "string" ? raw.clinicName : undefined,
    usdRate: typeof raw.usdRate === "number" ? raw.usdRate : undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 200 });
}
