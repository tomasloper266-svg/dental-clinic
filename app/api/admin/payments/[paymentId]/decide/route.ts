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
  if (!isAdminSession(req.cookies)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { paymentId } = await ctx.params;
  let body: DecideBody;
  try {
    body = (await req.json()) as DecideBody;
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
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
      { error: "القرار يجب أن يكون APPROVED أو REJECTED" },
      { status: 400 },
    );
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

// حماية شاملة: أي طريقة أخرى بلا جلسة إدارية مرفوضة صراحةً
export function GET() {
  return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
}
