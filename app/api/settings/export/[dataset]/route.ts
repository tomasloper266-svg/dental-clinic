import { getServerT, getLocale } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { getAccountOverview } from "@/lib/services/account";
import {
  exportFileName,
  buildDatasetCsv,
  isExportDataset,
} from "@/lib/services/export";
import { withUtf8Bom } from "@/lib/csv";

// تصدير مجموعات البيانات الست — UTF-8 مع BOM ليفتح Excel العربي مباشرة.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ dataset: string }> },
) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const { dataset } = await params;
  if (!isExportDataset(dataset)) {
    return NextResponse.json({ error: t("api.export.unknownDataset") }, { status: 404 });
  }

  const settings = await getAccountOverview(ctx);
  const locale = await getLocale();
  const csv = await buildDatasetCsv(
    ctx,
    dataset,
    settings.usdRate,
    settings.currency,
    locale,
  );

  return new NextResponse(withUtf8Bom(csv), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(exportFileName(locale, dataset))}`,
    },
  });
}
