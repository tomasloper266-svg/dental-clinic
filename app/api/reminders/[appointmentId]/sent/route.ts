import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { markReminderSent } from "@/lib/services/reminders";

// تسجيل إرسال تذكير موعد — يُنادى بعد فتح رابط واتساب بضغطة الزر.
// الموعد يُتحقق منه بنطاق عيادة الجلسة داخل الخدمة، والتسجيل إلحاقي.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { appointmentId } = await params;
  const result = await markReminderSent(ctx, appointmentId);
  if (!result.ok) {
    return NextResponse.json(
      { error: "الموعد غير موجود" },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { sentAt: result.sentAt.toISOString() },
    { status: 200 },
  );
}
