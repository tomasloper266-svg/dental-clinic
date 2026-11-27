import { tMaybe, getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import {
  createMaterial,
  listMaterials,
  lowStockMaterials,
  parseCreateMaterial,
} from "@/lib/services/inventory";

// قائمة مواد العيادة — عرض كامل أو المواد الواصلة حد التنبيه فقط (?filter=low).

export async function GET(req: NextRequest) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  if (req.nextUrl.searchParams.get("filter") === "low") {
    const low = await lowStockMaterials(ctx);
    return NextResponse.json({ materials: low }, { status: 200 });
  }

  const materials = await listMaterials(ctx);
  return NextResponse.json({ materials }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const t = await getRequestT(req);
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const parsed = parseCreateMaterial(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const material = await createMaterial(ctx, parsed.value);
    return NextResponse.json({ material }, { status: 201 });
  } catch (err) {
    console.error("[materials:create] failed:", err);
    return NextResponse.json({ error: t("api.materialCreateFailed") }, { status: 500 });
  }
}
