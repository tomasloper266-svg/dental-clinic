import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import { requireRole } from "@/lib/tenant/context";
import {
  getAccountOverview,
  parseLockInput,
  parseSettingsInput,
  updateSettings,
} from "@/lib/services/account";

// إعدادات العيادة — معلومات العيادة والعملة وسعر الصرف وقفل التطبيق.
// الرمز الرقمي لا يُقرأ أبداً — يعاد تعيينه فقط (hash في قاعدة البيانات).

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
  return NextResponse.json(await getAccountOverview(ctx), { status: 200 });
}

export async function PATCH(req: NextRequest) {
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
  const raw = body as Record<string, unknown>;

  const settingsInput = parseSettingsInput(raw);
  if (!settingsInput.ok) {
    return NextResponse.json({ error: settingsInput.error }, { status: 400 });
  }
  const lockInput = parseLockInput(raw);
  if (!lockInput.ok) {
    return NextResponse.json({ error: lockInput.error }, { status: 400 });
  }

  // بيانات العيادة (الاسم والعملة وسعر الصرف وساعات العمل) للطبيب حصراً؛
  // قفل الحساب الشخصي متاح لكل حساب يدير رمزه الخاص.
  if (Object.keys(settingsInput.value).length > 0) {
    const roleError = requireRole(ctx, "DENTIST");
    if (roleError) {
      return NextResponse.json({ error: roleError }, { status: 403 });
    }
  }

  const result = await updateSettings(ctx, settingsInput.value, lockInput.value);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 200 });
}
