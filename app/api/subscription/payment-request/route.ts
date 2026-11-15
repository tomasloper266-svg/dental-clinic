import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import {
  createPaymentRequest,
  parsePaymentRequestInput,
} from "@/lib/billing/requests";

// رفع طلب تفعيل بحوالة شام كاش — الجلسة مطلوبة (حماية الهوية) لكن بوابة
// الاشتراك مستثناة عمداً: العيادة المنتهية والنشطة (تجديد مبكر أو دفع من
// أول يوم) كلها معنية بالرفع.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parsePaymentRequestInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const result = await createPaymentRequest(session.clinicId, parsed.value);
  if (!result.ok) {
    // مبلغ غير مطابق أو حوالة معتمدة سابقاً رفض صريح — 422 وليس 500
    return NextResponse.json({ error: result.error.message }, { status: 422 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
