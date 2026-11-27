import { getRequestT, getServerT, tMaybe } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth/admin";
import {
  approvePaymentRequest,
  rejectPaymentRequest,
} from "@/lib/billing/requests";

type DecideBody = { decision?: unknown; note?: unknown };

// قرار اللوحة الإدارية في طلب تفعيل — الاعتماد يمدد الاشتراك تراكمياً،
// والرفض يسجل السبب. الجلسة الإدارية شرط لكل استدعاء.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ paymentId: string }> },
) {
  const t = await getRequestT(req);
  if (!isAdminSession(req.cookies)) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const { paymentId } = await ctx.params;
  let body: DecideBody;
  try {
    body = (await req.json()) as DecideBody;
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const note =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 500)
      : undefined;

  const result =
    body.decision === "APPROVED"
      ? await approvePaymentRequest(paymentId, note)
      : body.decision === "REJECTED"
        ? await rejectPaymentRequest(paymentId, note)
        : null;
  if (!result) {
    return NextResponse.json(
      { error: t("api.admin.invalidDecision") },
      { status: 400 },
    );
  }
  if (!result.ok) {
    return NextResponse.json({ error: tMaybe(t, result.error.message) }, { status: 409 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

// حماية شاملة: أي طريقة أخرى بلا جلسة إدارية مرفوضة صراحةً
export async function GET() {
  const t = await getServerT();
  return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
}
