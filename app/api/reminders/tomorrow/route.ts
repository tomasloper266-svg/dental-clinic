import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { listTomorrowReminders } from "@/lib/services/reminders";

// قائمة تذكير الغد — مواعيد الغد بحالاتها مع رابط واتساب جاهز لكل مريض.
// قراءة فقط: العيادة من الجلسة، والفترة (غد) تُحسب في الخدمة.
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

  const reminders = await listTomorrowReminders(ctx);
  return NextResponse.json({ reminders }, { status: 200 });
}
