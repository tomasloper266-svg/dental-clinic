import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
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
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const status = (body as { status?: unknown }).status;
  if (typeof status !== "string" || !STATUSES.has(status)) {
    return NextResponse.json({ error: "حالة غير معروفة" }, { status: 400 });
  }

  const result = await changeAppointmentStatus(
    ctx,
    id,
    status as AppointmentStatus,
  );
  if (!result.ok) {
    const code = result.code === "INVALID" ? 422 : 404;
    return NextResponse.json({ error: result.error }, { status: code });
  }
  return NextResponse.json({ appointment: result.value }, { status: 200 });
}
