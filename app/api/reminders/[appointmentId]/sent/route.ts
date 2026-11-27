import { getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { markReminderSent } from "@/lib/services/reminders";

// تسجيل إرسال تذكير موعد — يُنادى بعد فتح رابط واتساب بضغطة الزر.
// الموعد يُتحقق منه بنطاق عيادة الجلسة داخل الخدمة، والتسجيل إلحاقي.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  const t = await getRequestT(req);
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { appointmentId } = await params;
  const result = await markReminderSent(ctx, appointmentId);
  if (!result.ok) {
    return NextResponse.json(
      { error: t("api.appointmentNotFound") },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { sentAt: result.sentAt.toISOString() },
    { status: 200 },
  );
}
