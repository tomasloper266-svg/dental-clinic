import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import {
  createMaterial,
  listMaterials,
  lowStockMaterials,
  parseCreateMaterial,
} from "@/lib/services/inventory";

// قائمة مواد العيادة — عرض كامل أو المواد الواصلة حد التنبيه فقط (?filter=low).

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (req.nextUrl.searchParams.get("filter") === "low") {
    const low = await lowStockMaterials(ctx);
    return NextResponse.json({ materials: low }, { status: 200 });
  }

  const materials = await listMaterials(ctx);
  return NextResponse.json({ materials }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parseCreateMaterial(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const material = await createMaterial(ctx, parsed.value);
    return NextResponse.json({ material }, { status: 201 });
  } catch (err) {
    console.error("[materials:create] failed:", err);
    return NextResponse.json({ error: "تعذر إنشاء المادة" }, { status: 500 });
  }
}
