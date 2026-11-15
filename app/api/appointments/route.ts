import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import {
  createAppointment,
  listAppointments,
  parseCreateAppointment,
} from "@/lib/services/appointments";
import { dayRange, monthRange, weekRange } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const params = req.nextUrl.searchParams;
  const date = params.get("date");
  const viewParam = params.get("view");
  const view = viewParam === "week" || viewParam === "month" ? viewParam : "day";

  let from: Date;
  let to: Date;
  if (date) {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 });
    }
    [from, to] =
      view === "week"
        ? weekRange(parsed)
        : view === "month"
          ? monthRange(parsed)
          : dayRange(parsed);
  } else {
    const now = new Date();
    [from, to] =
      view === "week"
        ? weekRange(now)
        : view === "month"
          ? monthRange(now)
          : dayRange(now);
  }

  const appointments = await listAppointments(ctx, from, to);
  return NextResponse.json({ appointments, from, to, view }, { status: 200 });
}

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
