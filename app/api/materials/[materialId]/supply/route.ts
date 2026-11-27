import { getServerT, tMaybe } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { parseSupplyInput, supplyMaterial } from "@/lib/services/inventory";

type Params = { params: Promise<{ materialId: string }> };

// توريد كمية — زيادة صافية على الرصيد الحالي مع سطر حركة في الدفتر،
// بملاحظات اختيارية وتاريخ الحركة كما أدخله المستخدم.

export async function POST(req: NextRequest, { params }: Params) {
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

  const parsed = parseSupplyInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const material = await supplyMaterial(ctx, materialId, parsed.value);
    if (!material) {
      return NextResponse.json({ error: t("api.materialNotFound") }, { status: 404 });
    }
    return NextResponse.json({ material }, { status: 200 });
  } catch (err) {
    console.error("[materials:supply] failed:", err);
    return NextResponse.json({ error: t("api.supplyRecordFailed") }, { status: 500 });
  }
}
