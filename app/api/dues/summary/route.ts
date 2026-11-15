import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { listClinicLedgerEntries } from "@/lib/services/ledger";
import {
  outstandingDuesUsd,
  patientsWithDuesCount,
} from "@/lib/finance-view";

// ملخص المستحقات الحي — يجلب غلاف التطبيق هذا المسار بعد كل كتابة في الدفتر
// (حدث ledger:changed) كي تعكس شارة السايدبار آخر عملية فوراً بلا إعادة تحميل.
// نفس مصدر أرقام التخطيط الخادم حصراً: مجمع أرصدة المرضى الموجبة.

export async function GET(req: NextRequest) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const entries = await listClinicLedgerEntries(ctx);
  return NextResponse.json({
    outstandingDuesUsd: outstandingDuesUsd(entries),
    patientsWithDues: patientsWithDuesCount(entries),
  });
}
