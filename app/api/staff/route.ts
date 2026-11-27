import { tMaybe, getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { requireRole } from "@/lib/tenant/context";
import { createStaff, listStaff, parseStaffInput } from "@/lib/services/staff";
import { dayStart } from "@/lib/dates";

// قائمة الطاقم — العدّاد القادم يبدأ من يوم اليوم ?today=YYYY-MM-DD (اختياري).

export async function GET(req: NextRequest) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const todayParam = req.nextUrl.searchParams.get("today");
  const upcomingFrom = todayParam ? new Date(`${todayParam}T00:00:00`) : undefined;
  const staff = await listStaff(ctx, {
    upcomingFrom:
      upcomingFrom && !Number.isNaN(upcomingFrom.getTime())
        ? upcomingFrom
        : dayStart(new Date()),
  });
  return NextResponse.json({ staff }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const t = await getRequestT(req);
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  // إدارة الطاقم عملية إدارية — الطبيب حصراً.
  const roleError = requireRole(ctx, "DENTIST");
  if (roleError) {
    return NextResponse.json({ error: tMaybe(t, roleError) }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const parsed = parseStaffInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const member = await createStaff(ctx, parsed.value);
    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    console.error("[staff:create] failed:", err);
    return NextResponse.json({ error: t("api.staffAddFailed") }, { status: 500 });
  }
}
