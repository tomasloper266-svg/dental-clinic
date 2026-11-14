import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { createStaff, listStaff, parseStaffInput } from "@/lib/services/staff";
import { dayStart } from "@/lib/dates";

// قائمة الطاقم — العدّاد القادم يبدأ من يوم اليوم ?today=YYYY-MM-DD (اختياري).

export async function GET(req: NextRequest) {
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

  const parsed = parseStaffInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const member = await createStaff(ctx, parsed.value);
    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    console.error("[staff:create] failed:", err);
    return NextResponse.json({ error: "تعذر إضافة العضو" }, { status: 500 });
  }
}
