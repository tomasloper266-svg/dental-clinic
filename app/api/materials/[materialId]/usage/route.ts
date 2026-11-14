import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { parseUsageInput, recordMaterialUsage } from "@/lib/services/inventory";

type Params = { params: Promise<{ materialId: string }> };

// تسجيل استعمال مادة — الخصم من الكمية مع قيد MaterialUsage.
// الخصم الذي يُرجع الرصيد سالباً يُرفض (409) دون أي تغيير.

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

  const parsed = parseUsageInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
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
            { error: "المادة غير موجودة" },
            { status: 404 },
          );
        case "PATIENT_NOT_FOUND":
          return NextResponse.json(
            { error: "المريض غير موجود" },
            { status: 404 },
          );
        case "INSUFFICIENT_STOCK":
          return NextResponse.json(
            {
              error: `الكمية غير كافية — المتوفر ${result.available}`,
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
      { error: "تعذر تسجيل الاستعمال" },
      { status: 500 },
    );
  }
}
