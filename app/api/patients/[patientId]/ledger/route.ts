import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import {
  createLedgerEntry,
  listLedgerEntries,
  parseCreateLedgerEntry,
} from "@/lib/services/ledger";

type Params = { params: Promise<{ patientId: string }> };

// دفتر المريض — قراءة فقط مع إنشاء قيود جديدة. لا PUT ولا DELETE هنا:
// القيد المالي غير قابل للتعديل أو الحذف من أي دور — التصحيح بقيد عكسي.

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { patientId } = await params;
  const ledger = await listLedgerEntries(ctx, patientId);
  return NextResponse.json(ledger, { status: 200 });
}

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { patientId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parseCreateLedgerEntry(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const entry = await createLedgerEntry(ctx, {
      ...parsed.value,
      // المريض من المسار — المعرّف في جسم الطلب لا يُوثق به.
      patientId,
    });
    if (!entry) {
      return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    console.error("[ledger:create] failed:", err);
    return NextResponse.json({ error: "تعذر إنشاء القيد" }, { status: 500 });
  }
}
