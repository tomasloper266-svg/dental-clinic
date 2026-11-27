import { tMaybe, getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { changeAppointmentStatus } from "@/lib/services/appointment-state";
import type { AppointmentStatus } from "@/lib/services/appointments";

const STATUSES: ReadonlySet<string> = new Set([
  "SCHEDULED",
  "CONFIRMED",
  "IN_TREATMENT",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getRequestT(req);
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const status = (body as { status?: unknown }).status;
  if (typeof status !== "string" || !STATUSES.has(status)) {
    return NextResponse.json({ error: t("api.unknownStatus") }, { status: 400 });
  }

  const result = await changeAppointmentStatus(
    ctx,
    id,
    status as AppointmentStatus,
  );
  if (!result.ok) {
    const code = result.code === "INVALID" ? 422 : 404;
    return NextResponse.json({ error: tMaybe(t, result.error) }, { status: code });
  }
  // waitlistFill يُحمل فقط حين يُفتح موعد CANCELLED/NO_SHOW ويُحجز منتظر
  // مناسباً في الفجوة — يغذي رسالة المكوّن وزر التراجع بضغطة.
  return NextResponse.json(
    { appointment: result.value, waitlistFill: result.waitlistFill },
    { status: 200 },
  );
}
