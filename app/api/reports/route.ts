import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import {
  dayRange,
  getDailyReport,
  getMonthlyReport,
} from "@/lib/services/reports";

// تقرير يومي/شهري — التحصيل مقابل المصاريف وصافي الفترة.
// ?date=YYYY-MM-DD لتقرير يوم، أو ?year=2026&month=11 لتقرير شهري.

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const dateParam = params.get("date");
  const yearParam = params.get("year");
  const monthParam = params.get("month");

  if (dateParam) {
    const date = new Date(dateParam);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "التاريخ غير صالح" }, { status: 400 });
    }
    const report = await getDailyReport(ctx, date);
    return NextResponse.json({ report }, { status: 200 });
  }

  if (yearParam || monthParam) {
    const year = Number(yearParam);
    const month = Number(monthParam);
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return NextResponse.json(
        { error: "السنة أو الشهر غير صالح" },
        { status: 400 },
      );
    }
    const report = await getMonthlyReport(ctx, year, month);
    return NextResponse.json({ report }, { status: 200 });
  }

  // بلا معاملات: تقرير اليوم الحالي (بتوقيت UTC).
  const report = await getDailyReport(ctx, dayRange(new Date()).from);
  return NextResponse.json({ report }, { status: 200 });
}
