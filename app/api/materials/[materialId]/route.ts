import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { parseUpdateMaterial, updateMaterial } from "@/lib/services/inventory";

type Params = { params: Promise<{ materialId: string }> };

// تعديل مادة — الهوية والحدود فقط. الكمية لا تُعدَّل من هنا:
// تزيد بالتوريد وتنقص بالاستعمال حصراً.

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req);
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

  const parsed = parseUpdateMaterial(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const material = await updateMaterial(ctx, materialId, parsed.value);
    if (!material) {
      return NextResponse.json({ error: "المادة غير موجودة" }, { status: 404 });
    }
    return NextResponse.json({ material }, { status: 200 });
  } catch (err) {
    console.error("[materials:update] failed:", err);
    return NextResponse.json({ error: "تعذر تعديل المادة" }, { status: 500 });
  }
}
