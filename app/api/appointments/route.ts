import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import {
  createAppointment,
  listAppointments,
  parseCreateAppointment,
} from "@/lib/services/appointments";
import { dayRange, weekRange } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const date = params.get("date");
  const view = params.get("view") === "week" ? "week" : "day";

  let from: Date;
  let to: Date;
  if (date) {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 });
    }
    [from, to] = view === "week" ? weekRange(parsed) : dayRange(parsed);
  } else {
    const now = new Date();
    [from, to] = view === "week" ? weekRange(now) : dayRange(now);
  }

  const appointments = await listAppointments(ctx, from, to);
  return NextResponse.json({ appointments, from, to, view }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parseCreateAppointment(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await createAppointment(ctx, parsed.value);
  if (!result.ok) {
    const status = result.code === "CONFLICT" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ appointment: result.value }, { status: 201 });
}
