import { getServerT, tMaybe } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { undoWaitlistAutoFill } from "@/lib/services/waitlist";

// تراجع بضغطة عن حجز تلقائي من قائمة الانتظار — المعرفات الثلاثة تأتي من
// نتيجة PATCH الحالة (waitlistFill) فيتحقق الخادم من صحة كلٍّ منها قبل التنفيذ.
export async function POST(req: NextRequest) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const filledAppointmentId =
    typeof b.filledAppointmentId === "string" ? b.filledAppointmentId : "";
  const waitlistEntryId =
    typeof b.waitlistEntryId === "string" ? b.waitlistEntryId : "";
  const sourceAppointmentId =
    typeof b.sourceAppointmentId === "string" ? b.sourceAppointmentId : "";

  if (!filledAppointmentId || !waitlistEntryId || !sourceAppointmentId) {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const result = await undoWaitlistAutoFill(ctx, {
    filledAppointmentId,
    waitlistEntryId,
    sourceAppointmentId,
  });
  if (!result.ok) {
    const code = result.code === "NOT_FOUND" ? 404 : 422;
    return NextResponse.json({ error: tMaybe(t, result.error) }, { status: code });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
