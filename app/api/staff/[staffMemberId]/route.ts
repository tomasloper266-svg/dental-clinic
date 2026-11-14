import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { requireRole } from "@/lib/tenant/context";
import {
  deleteStaff,
  parseStaffInput,
  updateStaff,
} from "@/lib/services/staff";

type Params = { params: Promise<{ staffMemberId: string }> };

// تعديل عضو الطاقم (بما فيه تعطيل/تفعيل عبر isActive) — تعطيل تحوّل حالة آمن
// يحفظ التاريخ والمواعيد، والحذف يفصل مواعيده فقط (SET NULL).
// كل عمليات هذا المسار إدارية — الطبيب حصراً.

export async function PATCH(req: NextRequest, { params }: Params) {
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
  const roleError = requireRole(ctx, "DENTIST");
  if (roleError) {
    return NextResponse.json({ error: roleError }, { status: 403 });
  }
  const { staffMemberId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  // تعطيل/تفعيل فقط — بلا بقية الحقول.
  if (
    typeof body === "object" &&
    body !== null &&
    "isActive" in body &&
    typeof (body as { isActive: unknown }).isActive === "boolean"
  ) {
    const member = await updateStaff(ctx, staffMemberId, {
      isActive: (body as { isActive: boolean }).isActive,
    });
    if (!member) {
      return NextResponse.json({ error: "العضو غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ member }, { status: 200 });
  }

  const parsed = parseStaffInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const member = await updateStaff(ctx, staffMemberId, parsed.value);
    if (!member) {
      return NextResponse.json({ error: "العضو غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ member }, { status: 200 });
  } catch (err) {
    console.error("[staff:update] failed:", err);
    return NextResponse.json({ error: "تعذر تعديل العضو" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
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
  const roleError = requireRole(ctx, "DENTIST");
  if (roleError) {
    return NextResponse.json({ error: roleError }, { status: 403 });
  }
  const { staffMemberId } = await params;

  try {
    const deleted = await deleteStaff(ctx, staffMemberId);
    if (!deleted) {
      return NextResponse.json({ error: "العضو غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[staff:delete] failed:", err);
    return NextResponse.json({ error: "تعذر حذف العضو" }, { status: 500 });
  }
}
