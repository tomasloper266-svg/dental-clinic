import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import {
  createPatient,
  listPatients,
  parseCreatePatient,
} from "@/lib/services/patients";

export async function GET(req: NextRequest) {
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

  const search = req.nextUrl.searchParams.get("q") ?? undefined;
  const patients = await listPatients(ctx, search || undefined);
  return NextResponse.json({ patients }, { status: 200 });
}

export async function POST(req: NextRequest) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parseCreatePatient(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const patient = await createPatient(ctx, parsed.value);
    return NextResponse.json({ patient }, { status: 201 });
  } catch (err) {
    console.error("[patients:create] failed:", err);
    return NextResponse.json({ error: "تعذر إنشاء المريض" }, { status: 500 });
  }
}
