import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { deleteUnallocatedCharge } from "@/lib/services/ledger";

type Params = { params: Promise<{ patientId: string; entryId: string }> };

// حذف فاتورة (قيد رسوم) لم تُخصَّص له دفعات أو خصومات بعد — الباب الوحيد
// للحذف في الدفتر غير القابل للتعديل. فاتورة مُخصَّصة تُرفض بـ 409 لأن حذفها
// يعيد توزيع الدفعات بأثر رجعي.

export async function DELETE(req: NextRequest, { params }: Params) {
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
