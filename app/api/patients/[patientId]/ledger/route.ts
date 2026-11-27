import { getServerT, tMaybe } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  createLedgerEntry,
  listLedgerEntries,
  parseCreateLedgerEntry,
} from "@/lib/services/ledger";

type Params = { params: Promise<{ patientId: string }> };

// دفتر المريض — قراءة فقط مع إنشاء قيود جديدة. لا PUT ولا DELETE هنا:
// القيد المالي غير قابل للتعديل أو الحذف من أي دور — التصحيح بقيد عكسي.

export async function GET(req: NextRequest, { params }: Params) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const { patientId } = await params;
  const ledger = await listLedgerEntries(ctx, patientId);
  return NextResponse.json(ledger, { status: 200 });
}

export async function POST(req: NextRequest, { params }: Params) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const { patientId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const parsed = parseCreateLedgerEntry(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const entry = await createLedgerEntry(ctx, {
      ...parsed.value,
      // المريض من المسار — المعرّف في جسم الطلب لا يُوثق به.
      patientId,
    });
    if (!entry) {
      return NextResponse.json({ error: t("api.patientNotFound") }, { status: 404 });
    }
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    // تعارض القيد الفريد على treatmentItemId — البند مُرحَّل مسبقاً (نقر مزدوج أو
    // إعادة إرسال بعد استجابة فاقدة). يعالَج كطلب مكرر 409 لا كخطأ خادم.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: t("api.ledger.itemAlreadyCharged") },
        { status: 409 },
      );
    }
    console.error("[ledger:create] failed:", err);
    return NextResponse.json({ error: t("api.ledgerCreateFailed") }, { status: 500 });
  }
}
