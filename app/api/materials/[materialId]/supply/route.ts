import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { parseSupplyInput, supplyMaterial } from "@/lib/services/inventory";

type Params = { params: Promise<{ materialId: string }> };

// توريد كمية — زيادة صافية على الرصيد الحالي مع سطر حركة في الدفتر،
// بملاحظات اختيارية وتاريخ الحركة كما أدخله المستخدم.

export async function POST(req: NextRequest, { params }: Params) {
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
  const { materialId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parseSupplyInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const material = await supplyMaterial(ctx, materialId, parsed.value);
    if (!material) {
      return NextResponse.json({ error: "المادة غير موجودة" }, { status: 404 });
    }
    return NextResponse.json({ material }, { status: 200 });
  } catch (err) {
    console.error("[materials:supply] failed:", err);
    return NextResponse.json({ error: "تعذر تسجيل التوريد" }, { status: 500 });
  }
}
