import { getServerT, tMaybe } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import {
  deleteMaterial,
  parseUpdateMaterial,
  updateMaterial,
} from "@/lib/services/inventory";

type Params = { params: Promise<{ materialId: string }> };

// تعديل مادة — الهوية والحدود والفئة والمورد. تعديل الرصيد المباشر يمرّ عبر
// الخدمة، التي تسجّل الفرق سطر حركة تسوية في الدفتر.

export async function PATCH(req: NextRequest, { params }: Params) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const { materialId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const parsed = parseUpdateMaterial(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const material = await updateMaterial(ctx, materialId, parsed.value);
    if (!material) {
      return NextResponse.json({ error: t("api.materialNotFound") }, { status: 404 });
    }
    return NextResponse.json({ material }, { status: 200 });
  } catch (err) {
    console.error("[materials:update] failed:", err);
    return NextResponse.json({ error: t("api.materialUpdateFailed") }, { status: 500 });
  }
}

// حذف مادة — يستلزم تأكيداً صريحاً في الواجهة، ويحذف سطور استعمالها معها.
export async function DELETE(
  req: NextRequest,
  { params }: Params,
) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const { materialId } = await params;

  try {
    const deleted = await deleteMaterial(ctx, materialId);
    if (!deleted) {
      return NextResponse.json({ error: t("api.materialNotFound") }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[materials:delete] failed:", err);
    return NextResponse.json({ error: t("api.materialDeleteFailed") }, { status: 500 });
  }
}
