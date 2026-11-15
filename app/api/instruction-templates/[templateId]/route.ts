import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import {
  deleteTemplate,
  parseUpdateTemplate,
  updateTemplate,
} from "@/lib/services/instructions";

type Params = { params: Promise<{ templateId: string }> };

// قالب واحد — تعديل وحذف. القالب محصور بالعيادة عبر clinicScope،
// وقالب عيادة أخرى يعامل كغير موجود (404).

export async function PUT(req: NextRequest, { params }: Params) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const { templateId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parseUpdateTemplate(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const template = await updateTemplate(ctx, templateId, parsed.value);
  if (!template) {
    return NextResponse.json({ error: "القالب غير موجود" }, { status: 404 });
  }
  return NextResponse.json({ template }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const { templateId } = await params;

  const deleted = await deleteTemplate(ctx, templateId);
  if (!deleted) {
    return NextResponse.json({ error: "القالب غير موجود" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
