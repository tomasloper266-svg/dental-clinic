import { getServerT, tMaybe } from "@/lib/i18n";
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
  const t = await getServerT();
  if (!isAdminSession(req.cookies)) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const { clinicId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const parsed = parseManualActivationInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error.message) }, { status: 400 });
  }

  const result = await activateClinicManually(clinicId, parsed.value);
  if (!result.ok) {
    const status = result.error.code === "clinic-not-found" ? 404 : 422;
    return NextResponse.json({ error: tMaybe(t, result.error.message) }, { status });
  }
  return NextResponse.json(
    { ok: true, subscriptionEndsAt: result.value.subscriptionEndsAt.toISOString() },
    { status: 200 },
  );
}

// حماية شاملة: أي طريقة أخرى بلا جلسة إدارية مرفوضة صراحةً
export async function GET() {
  const t = await getServerT();
  return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
}
