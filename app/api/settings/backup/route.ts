import { tMaybe, getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import { requireRole } from "@/lib/tenant/context";
import { buildSnapshot, restoreSnapshot } from "@/lib/services/backup";
import { getBasePrisma } from "@/lib/db";

// النسخ الاحتياطي والاستعادة — التنزيل يبني لقطة JSON كاملة الآن، والاستعادة
// تتحقق من الملف وتعيد الإنشاء داخل معاملة واحدة (أي فشل لا يغيّر شيئاً).

export async function GET(req: NextRequest) {
  const t = await getRequestT(req);
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const snapshot = await buildSnapshot(getBasePrisma(), ctx.clinicId);
  const filename = t("settings.backupFilename", { date: new Date().toISOString().slice(0, 10) });
  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

export async function POST(req: NextRequest) {
  const t = await getRequestT(req);
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  // الاستعادة تمس كل بيانات العيادة التشغيلية — الطبيب حصراً.
  const roleError = requireRole(ctx, "DENTIST");
  if (roleError) {
    return NextResponse.json({ error: tMaybe(t, roleError) }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.backup.invalidFile") }, { status: 400 });
  }
  const raw = body as { snapshot?: unknown };
  const result = await restoreSnapshot(getBasePrisma(), ctx.clinicId, raw.snapshot);
  if (!result.ok) {
    return NextResponse.json({ error: tMaybe(t, result.error) }, { status: 400 });
  }
  return NextResponse.json({ ok: true, counts: result.counts }, { status: 200 });
}
