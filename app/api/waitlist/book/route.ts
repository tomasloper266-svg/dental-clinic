import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { bookFromWaitlist } from "@/lib/services/waitlist";

export async function POST(req: NextRequest) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const waitlistEntryId =
    typeof b.waitlistEntryId === "string" ? b.waitlistEntryId : "";
  const startsAt =
    typeof b.startsAt === "string" && !Number.isNaN(Date.parse(b.startsAt))
      ? new Date(b.startsAt)
      : null;
  const durationMin =
    typeof b.durationMin === "number" && Number.isInteger(b.durationMin)
      ? b.durationMin
      : 30;

  if (!waitlistEntryId || !startsAt) {
    return NextResponse.json(
      { error: "قيد الانتظار أو وقت البداية غير صالح" },
      { status: 400 },
    );
  }

  const result = await bookFromWaitlist(ctx, {
    waitlistEntryId,
    startsAt,
    durationMin,
  });
  if (!result.ok) {
    const status =
      result.code === "CONFLICT" ? 409 : result.code === "INVALID" ? 422 : 404;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ appointment: result.value }, { status: 201 });
}
