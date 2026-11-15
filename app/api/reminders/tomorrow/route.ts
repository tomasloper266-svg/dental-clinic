import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { listTomorrowReminders } from "@/lib/services/reminders";

// قائمة تذكير الغد — مواعيد الغد بحالاتها مع رابط واتساب جاهز لكل مريض.
// قراءة فقط: العيادة من الجلسة، والفترة (غد) تُحسب في الخدمة.
export async function GET(req: NextRequest) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const reminders = await listTomorrowReminders(ctx);
  return NextResponse.json({ reminders }, { status: 200 });
}
