import { getServerT, tMaybe } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
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
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  return NextResponse.json(await getAccountOverview(ctx), { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;

  const settingsInput = parseSettingsInput(raw);
  if (!settingsInput.ok) {
    return NextResponse.json({ error: tMaybe(t, settingsInput.error) }, { status: 400 });
  }
  const lockInput = parseLockInput(raw);
  if (!lockInput.ok) {
    return NextResponse.json({ error: tMaybe(t, lockInput.error) }, { status: 400 });
  }

  // بيانات العيادة (الاسم والعملة وسعر الصرف وساعات العمل) للطبيب حصراً؛
  // قفل الحساب الشخصي متاح لكل حساب يدير رمزه الخاص.
  if (Object.keys(settingsInput.value).length > 0) {
    const roleError = requireRole(ctx, "DENTIST");
    if (roleError) {
      return NextResponse.json({ error: tMaybe(t, roleError) }, { status: 403 });
    }
  }

  const result = await updateSettings(ctx, settingsInput.value, lockInput.value);
  if (!result.ok) {
    return NextResponse.json({ error: tMaybe(t, result.error.message) }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 200 });
}
