import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { listClinicLedgerEntries } from "@/lib/services/ledger";

// دفتر العيادة الموحّد — قراءة فقط بأحدث القيود. التصفية بالمريض عبر
// ?patientId=. الإنشاء يبقى عبر مسار دفتر المريض نفسه (source of truth).

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const patientId = req.nextUrl.searchParams.get("patientId");
  const entries = await listClinicLedgerEntries(
    ctx,
    patientId ? { patientId } : undefined,
  );
  return NextResponse.json({ entries }, { status: 200 });
}
