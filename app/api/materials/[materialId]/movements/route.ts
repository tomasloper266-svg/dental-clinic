import { getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { listMaterialMovements } from "@/lib/services/inventory";

type Params = { params: Promise<{ materialId: string }> };

// سجل حركات مادة — الدفتر الإلحاقي للتوريد والاستعمال والتسويات، الأحدث أولاً.

export async function GET(req: NextRequest, { params }: Params) {
  const t = await getRequestT(req);
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const { materialId } = await params;

  try {
    const movements = await listMaterialMovements(ctx, materialId);
    if (movements === null) {
      return NextResponse.json({ error: t("api.materialNotFound") }, { status: 404 });
    }
    return NextResponse.json({ movements }, { status: 200 });
  } catch (err) {
    console.error("[materials:movements] failed:", err);
    return NextResponse.json(
      { error: t("api.movementsLoadFailed") },
      { status: 500 },
    );
  }
}
