import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { listClinicLedgerEntries } from "@/lib/services/ledger";
import {
  outstandingDuesSyp,
  patientsWithDuesCount,
} from "@/lib/finance-view";

// ملخص المستحقات الحي — يجلب غلاف التطبيق هذا المسار بعد كل كتابة في الدفتر
// (حدث ledger:changed) كي تعكس شارة السايدبار آخر عملية فوراً بلا إعادة تحميل.
// نفس مصدر أرقام التخطيط الخادم حصراً: مجمع أرصدة المرضى الموجبة.

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

  const entries = await listClinicLedgerEntries(ctx);
  return NextResponse.json({
    outstandingDuesSyp: outstandingDuesSyp(entries),
    patientsWithDues: patientsWithDuesCount(entries),
  });
}
