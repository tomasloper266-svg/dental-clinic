import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { getReportsPeriodSummary } from "@/lib/services/reports-period";

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

  const params = req.nextUrl.searchParams;
  const fromParam = params.get("from");
  const toParam = params.get("to");

  // بلا معاملات: فترة «الكل» — تُحسب داخل الخدمة من أقدم يوم حركة.
  if (!fromParam && !toParam) {
    const summary = await getReportsPeriodSummary(ctx, {
      from: "1970-01-01",
      to: new Date().toISOString().slice(0, 10),
    });
    return NextResponse.json({ summary }, { status: 200 });
  }

  const from = parseDayParam(fromParam);
  const to = parseDayParam(toParam);
  if (!fromParam || !toParam || !from || !to) {
    return NextResponse.json(
      { error: "التاريخان يجب أن يكونا بصيغة YYYY-MM-DD" },
      { status: 400 },
    );
  }
  if (from.getTime() > to.getTime()) {
    return NextResponse.json(
      { error: "تاريخ «من» يجب أن يكون قبل تاريخ «إلى» أو مساوياً له" },
      { status: 400 },
    );
  }

  const summary = await getReportsPeriodSummary(ctx, {
    from: fromParam,
    to: toParam,
  });
  return NextResponse.json({ summary }, { status: 200 });
}
