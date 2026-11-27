import { getServerT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import {
  listOpenGaps,
  WORK_DAY_END_UTC_HOUR,
  WORK_DAY_START_UTC_HOUR,
} from "@/lib/services/waitlist";
import { dayRange } from "@/lib/dates";

// مقترحات الفجوات الشاغرة ليوم محدد — ضمن ساعات العمل الافتراضية.
export async function GET(req: NextRequest) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const date = req.nextUrl.searchParams.get("date");
  const base = date
    ? new Date(`${date}T00:00:00`)
    : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  if (Number.isNaN(base.getTime())) {
    return NextResponse.json({ error: t("api.invalidDate") }, { status: 400 });
  }

  const [dayStart] = dayRange(base);
  const windowStart = new Date(
    dayStart.getTime() + WORK_DAY_START_UTC_HOUR * 60 * 60_000,
  );
  const windowEnd = new Date(
    dayStart.getTime() + WORK_DAY_END_UTC_HOUR * 60 * 60_000,
  );

  const gaps = await listOpenGaps(ctx, windowStart, windowEnd);
  return NextResponse.json({ gaps, windowStart, windowEnd }, { status: 200 });
}
