import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import {
  createTemplate,
  listTemplates,
  parseCreateTemplate,
} from "@/lib/services/instructions";

// قوالب تعليمات ما بعد الجراحة — قائمة بكل القوالب أو بفلتر إجراء،
// وإنشاء قالب جديد. التعديل والحذف في مسار [id].

export async function GET(req: NextRequest) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const procedure = req.nextUrl.searchParams.get("procedure") ?? undefined;
  const templates = await listTemplates(ctx, procedure || undefined);
  return NextResponse.json({ templates }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parseCreateTemplate(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const template = await createTemplate(ctx, parsed.value);
  return NextResponse.json({ template }, { status: 201 });
}
