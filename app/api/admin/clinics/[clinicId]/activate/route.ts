import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth/admin";
import {
  activateClinicManually,
  parseManualActivationInput,
} from "@/lib/billing/manual-activation";

// تفعيل يدوي إداري لعيادة — يضبط subscriptionEndsAt بدون طلب دفع، بنفس
// قاعدة التمدد التراكمي. الجلسة الإدارية شرط لكل استدعاء.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string }> },
) {
  if (!isAdminSession(req.cookies)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { clinicId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parseManualActivationInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const result = await activateClinicManually(clinicId, parsed.value);
  if (!result.ok) {
    const status = result.error.code === "clinic-not-found" ? 404 : 422;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json(
    { ok: true, subscriptionEndsAt: result.value.subscriptionEndsAt.toISOString() },
    { status: 200 },
  );
}

// حماية شاملة: أي طريقة أخرى بلا جلسة إدارية مرفوضة صراحةً
export function GET() {
  return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
}
