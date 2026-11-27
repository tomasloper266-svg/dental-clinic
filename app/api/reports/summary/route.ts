import { getServerT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { getReportsPeriodSummary } from "@/lib/services/reports-period";
import { localDayOf } from "@/lib/local-day";

// ملخص تقرير الفترة — ?from=YYYY-MM-DD&to=YYYY-MM-DD (شاملان). بلا معاملات
// تُعاد فترة «الكل»: من أقدم يوم حركة حتى اليوم. كل التجميعات من خدمة
// التقرير بلا إعادة تفسير.

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDayParam(value: string | null): Date | null {
  if (!value || !DAY_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: NextRequest) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const params = req.nextUrl.searchParams;
  const fromParam = params.get("from");
  const toParam = params.get("to");

  // بلا معاملات: فترة «الكل» — تُحسب داخل الخدمة من أقدم يوم حركة.
  if (!fromParam && !toParam) {
    const summary = await getReportsPeriodSummary(ctx, {
      from: "1970-01-01",
      // اليوم بتوقيت العيادة لا UTC — وإلا وقعت حركة منتصف الليل المحلي في اليوم السابق
      to: localDayOf(new Date()),
    });
    return NextResponse.json({ summary }, { status: 200 });
  }

  const from = parseDayParam(fromParam);
  const to = parseDayParam(toParam);
  if (!fromParam || !toParam || !from || !to) {
    return NextResponse.json(
      { error: t("api.reports.dateFormat") },
      { status: 400 },
    );
  }
  if (from.getTime() > to.getTime()) {
    return NextResponse.json(
      { error: t("api.reports.fromAfterTo") },
      { status: 400 },
    );
  }

  const summary = await getReportsPeriodSummary(ctx, {
    from: fromParam,
    to: toParam,
  });
  return NextResponse.json({ summary }, { status: 200 });
}
