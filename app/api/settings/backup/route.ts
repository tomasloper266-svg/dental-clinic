import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { buildSnapshot, restoreSnapshot } from "@/lib/services/backup";
import { getBasePrisma } from "@/lib/db";

// النسخ الاحتياطي والاستعادة — التنزيل يبني لقطة JSON كاملة الآن، والاستعادة
// تتحقق من الملف وتعيد الإنشاء داخل معاملة واحدة (أي فشل لا يغيّر شيئاً).

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const snapshot = await buildSnapshot(getBasePrisma(), ctx.clinicId);
  const filename = `نسخة-احتياطية-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req);
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "الملف غير صالح" }, { status: 400 });
  }
  const raw = body as { snapshot?: unknown };
  const result = await restoreSnapshot(getBasePrisma(), ctx.clinicId, raw.snapshot);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, counts: result.counts }, { status: 200 });
}
