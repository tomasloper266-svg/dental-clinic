import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { deleteUnallocatedCharge } from "@/lib/services/ledger";

type Params = { params: Promise<{ patientId: string; entryId: string }> };

// حذف فاتورة (قيد رسوم) لم تُخصَّص له دفعات أو خصومات بعد — الباب الوحيد
// للحذف في الدفتر غير القابل للتعديل. فاتورة مُخصَّصة تُرفض بـ 409 لأن حذفها
// يعيد توزيع الدفعات بأثر رجعي.

export async function DELETE(req: NextRequest, { params }: Params) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const { patientId, entryId } = await params;

  try {
    const result = await deleteUnallocatedCharge(ctx, patientId, entryId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[ledger:deleteCharge] failed:", err);
    return NextResponse.json({ error: "تعذر حذف الفاتورة" }, { status: 500 });
  }
}
