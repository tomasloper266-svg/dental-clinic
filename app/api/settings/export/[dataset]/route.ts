import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { getAccountOverview } from "@/lib/services/account";
import {
  EXPORT_FILENAMES,
  buildDatasetCsv,
  isExportDataset,
} from "@/lib/services/export";
import { withUtf8Bom } from "@/lib/csv";

// تصدير مجموعات البيانات الست — UTF-8 مع BOM ليفتح Excel العربي مباشرة.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ dataset: string }> },
) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const { dataset } = await params;
  if (!isExportDataset(dataset)) {
    return NextResponse.json({ error: "مجموعة غير معروفة" }, { status: 404 });
  }

  const settings = await getAccountOverview(ctx);
  const csv = await buildDatasetCsv(
    ctx,
    dataset,
    settings.usdRate,
    settings.currency,
  );

  return new NextResponse(withUtf8Bom(csv), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(EXPORT_FILENAMES[dataset])}`,
    },
  });
}
