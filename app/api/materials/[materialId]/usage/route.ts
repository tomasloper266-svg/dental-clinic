import { tMaybe, getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { parseUsageInput, recordMaterialUsage } from "@/lib/services/inventory";

type Params = { params: Promise<{ materialId: string }> };

// تسجيل استعمال مادة — الخصم من الكمية مع قيد MaterialUsage.
// الخصم الذي يُرجع الرصيد سالباً يُرفض (409) دون أي تغيير.

export async function POST(req: NextRequest, { params }: Params) {
  const t = await getRequestT(req);
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

  const parsed = parseUsageInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const result = await recordMaterialUsage(ctx, {
      materialId,
      ...parsed.value,
    });

    if (!result.ok) {
      switch (result.reason) {
        case "NOT_FOUND":
          return NextResponse.json(
            { error: t("api.materialNotFound") },
            { status: 404 },
          );
        case "PATIENT_NOT_FOUND":
          return NextResponse.json(
            { error: t("api.patientNotFound") },
            { status: 404 },
          );
        case "INSUFFICIENT_STOCK":
          return NextResponse.json(
            {
              error: t("api.insufficientStock", { available: result.available }),
              available: result.available,
            },
            { status: 409 },
          );
      }
    }

    return NextResponse.json(
      { usage: result.usage, material: result.material },
      { status: 201 },
    );
  } catch (err) {
    console.error("[materials:usage] failed:", err);
    return NextResponse.json(
      { error: t("api.usageRecordFailed") },
      { status: 500 },
    );
  }
}
