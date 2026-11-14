import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { undoWaitlistAutoFill } from "@/lib/services/waitlist";

// تراجع بضغطة عن حجز تلقائي من قائمة الانتظار — المعرفات الثلاثة تأتي من
// نتيجة PATCH الحالة (waitlistFill) فيتحقق الخادم من صحة كلٍّ منها قبل التنفيذ.
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req);
  if (ctx === "LOCKED") {
    return NextResponse.json(
      { error: "التطبيق مقفل — أدخل الرمز الرقمي للفتح" },
      { status: 423 },
    );
  }
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const filledAppointmentId =
    typeof b.filledAppointmentId === "string" ? b.filledAppointmentId : "";
  const waitlistEntryId =
    typeof b.waitlistEntryId === "string" ? b.waitlistEntryId : "";
  const sourceAppointmentId =
    typeof b.sourceAppointmentId === "string" ? b.sourceAppointmentId : "";

  if (!filledAppointmentId || !waitlistEntryId || !sourceAppointmentId) {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const result = await undoWaitlistAutoFill(ctx, {
    filledAppointmentId,
    waitlistEntryId,
    sourceAppointmentId,
  });
  if (!result.ok) {
    const code = result.code === "NOT_FOUND" ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status: code });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
