import { prisma } from "@/lib/db";
import {
  generateOtpCode,
  hashOtpCode,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth/otp";
import { OTP_TTL_MS } from "@/lib/auth/otp";
import { OTP_RESEND_COOLDOWN_MS } from "@/lib/auth/otp";
import { OTP_MAX_ATTEMPTS } from "@/lib/auth/otp";
import { channelFor } from "@/lib/notifications/delivery";
import { describeChannelConfig } from "@/lib/notifications/delivery";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/session";
import type { RecoveryError } from "@/lib/auth/recovery";
import type { TenantContext } from "@/lib/tenant/context";

// إعداد الحساب بعد التسجيل — ربط بريد موثق (OTP) واستكمال بيانات العيادة
// والطبيب. يعمل عبر سياق العيادة من الجلسة حصراً.

export type AccountErrorCode = RecoveryError["code"] | "forbidden";

export type AccountOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: AccountErrorCode; message: string } };

function fail<T>(code: AccountErrorCode, message: string): AccountOutcome<T> {
  return { ok: false, error: { code, message } };
}

// طلب ربط بريد جديد: يُفحص شكله وعدم استخدامه لحساب موثق آخر، ثم يُرسل
// رمز تحقق إلى البريد نفسه — الملكية تثبت عند إدخال الرمز.
export async function requestEmailVerification(
  ctx: TenantContext,
  email: string,
): Promise<AccountOutcome<{ delivered: boolean; fallbackCode?: string }>> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return fail("invalid-input", "البريد الإلكتروني غير صالح");
  }
  const taken = await prisma.user.findFirst({
    where: { email: normalized, emailVerifiedAt: { not: null }, id: { not: ctx.userId } },
    select: { id: true },
  });
  if (taken) {
    return fail("email-taken", "هذا البريد مرتبط بحساب آخر موثق");
  }

  const last = await prisma.verificationToken.findFirst({
    where: { userId: ctx.userId, purpose: "EMAIL_VERIFICATION", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    return fail("cooldown", "أُرسل رمز قبل لحظات — انتظر دقيقة ثم أعد الإرسال");
  }
  await prisma.verificationToken.deleteMany({
    where: { userId: ctx.userId, purpose: "EMAIL_VERIFICATION", consumedAt: null },
  });

  const code = generateOtpCode();
  await prisma.verificationToken.create({
    data: {
      userId: ctx.userId,
      purpose: "EMAIL_VERIFICATION",
      channel: "EMAIL",
      destination: normalized,
      codeHash: hashOtpCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const channel = channelFor("EMAIL");
  if (!channel) {
    return { ok: true, value: { delivered: false, fallbackCode: code } };
  }
  try {
    await channel.send({
      to: normalized,
      subject: "تأكيد البريد الإلكتروني — نظام إدارة عيادات الأسنان",
      body: `رمز التحقق الخاص بك: ${code}\nصالح لعشر دقائق — لا تشاركه مع أحد.`,
    });
    return { ok: true, value: { delivered: true } };
  } catch (err) {
    console.error(`[email-verification] delivery via ${channel.id} failed:`, err);
    return { ok: true, value: { delivered: false, fallbackCode: code } };
  }
}

// تأكيد البريد: التحقق من الرمز ثم ربطه بالحساب — مرة واحدة ولحساب واحد.
export async function verifyEmail(
  ctx: TenantContext,
  email: string,
  code: string,
): Promise<AccountOutcome<{ email: string }>> {
  const normalized = normalizeEmail(email);
  const token = await prisma.verificationToken.findFirst({
    where: { userId: ctx.userId, purpose: "EMAIL_VERIFICATION", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token) {
    return fail("not-found", "لا يوجد رمز نشط — أعد طلب رمز جديد");
  }
  if (token.destination !== normalized) {
    return fail("invalid-input", "البريد لا يطابق الرمز المُرسل");
  }
  if (token.expiresAt < new Date()) {
    return fail("expired", "انتهت صلاحية الرمز — اطلب رمزاً جديداً");
  }
  if (token.attempts >= OTP_MAX_ATTEMPTS) {
    return fail("too-many-attempts", "تجاوزت عدد المحاولات — اطلب رمزاً جديداً");
  }
  if (token.codeHash !== hashOtpCode(code)) {
    await prisma.verificationToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    return fail("invalid-code", "الرمز غير صحيح — تحقق وأعد المحاولة");
  }

  const taken = await prisma.user.findFirst({
    where: { email: normalized, emailVerifiedAt: { not: null }, id: { not: ctx.userId } },
    select: { id: true },
  });
  if (taken) {
    return fail("email-taken", "هذا البريد مرتبط بحساب آخر موثق");
  }

  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: ctx.userId },
      data: { email: normalized, emailVerifiedAt: new Date() },
    }),
  ]);
  return { ok: true, value: { email: normalized } };
}

// استكمال بيانات العيادة والطبيب — تعديل أسماء فقط؛ لا يُلمس رقم الهاتف
// هنا أبداً: تغيير الهاتف يتطلب إثبات ملكية منفصل خارج هذه الواجهة.
export async function updateProfile(
  ctx: TenantContext,
  input: { name?: string; clinicName?: string; usdRate?: number },
): Promise<AccountOutcome<{ name: string; clinicName: string; usdRate: number }>> {
  const name = input.name?.trim();
  const clinicName = input.clinicName?.trim();
  const { usdRate } = input;
  if (name !== undefined && (name.length < 2 || name.length > 100)) {
    return fail("invalid-input", "الاسم يجب أن يكون بين 2 و100 حرف");
  }
  if (clinicName !== undefined && (clinicName.length < 2 || clinicName.length > 100)) {
    return fail("invalid-input", "اسم العيادة يجب أن يكون بين 2 و100 حرف");
  }
  if (usdRate !== undefined && (!Number.isFinite(usdRate) || usdRate <= 0)) {
    return fail("invalid-input", "سعر الصرف يجب أن يكون رقماً موجباً");
  }

  const clinicData: { name?: string; usdRate?: number } = {};
  if (clinicName !== undefined) clinicData.name = clinicName;
  if (usdRate !== undefined) clinicData.usdRate = usdRate;

  const [userRow, clinicRow] = await prisma.$transaction([
    name !== undefined
      ? prisma.user.update({
          where: { id: ctx.userId },
          data: { name },
          select: { name: true },
        })
      : prisma.user.findUniqueOrThrow({
          where: { id: ctx.userId },
          select: { name: true },
        }),
    Object.keys(clinicData).length > 0
      ? prisma.clinic.update({
          where: { id: ctx.clinicId },
          data: clinicData,
          select: { name: true, usdRate: true },
        })
      : prisma.clinic.findUniqueOrThrow({
          where: { id: ctx.clinicId },
          select: { name: true, usdRate: true },
        }),
  ]);

  return {
    ok: true,
    value: { name: userRow.name, clinicName: clinicRow.name, usdRate: clinicRow.usdRate },
  };
}

// سعر صرف العيادة لعرض العملة المزدوجة — قراءة واحدة لكل صفحة محمية.
export async function getClinicUsdRate(ctx: TenantContext): Promise<number> {
  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: ctx.clinicId },
    select: { usdRate: true },
  });
  return clinic.usdRate;
}

// اسم العيادة كما أدخله الطبيب عند التسجيل — من سجل العيادة حصراً،
// لعرضه في ترويسة الشريط الجانبي بدل الاسم الثابت.
export async function getClinicName(ctx: TenantContext): Promise<string> {
  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: ctx.clinicId },
    select: { name: true },
  });
  return clinic.name;
}

// لمحة الحساب لصفحة الإعداد — حالة البريد وحالة ربط قنوات الإرسال.
export async function getAccountOverview(ctx: TenantContext): Promise<{
  name: string;
  clinicName: string;
  usdRate: number;
  email: string | null;
  emailVerified: boolean;
  channels: ReturnType<typeof describeChannelConfig>;
}> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: {
      name: true,
      email: true,
      emailVerifiedAt: true,
      clinic: { select: { name: true, usdRate: true } },
    },
  });
  return {
    name: user.name,
    clinicName: user.clinic.name,
    usdRate: user.clinic.usdRate,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    channels: describeChannelConfig(),
  };
}

// ─── تغيير كلمة السر من صفحة الإعدادات ──────────────────────────────────────

// تغيير كلمة السر وهو مسجّل الدخول: يتطلب كلمة السر الحالية، ثم يحدّث
// الهاش ويبطل الجلسات الأخرى (الأجهزة الأخرى) مع إبقاء الجلسة الحالية
// حيّة — نفس معاملة الاستعادة دون إبطال الجهاز الحالي.
export async function changePassword(
  ctx: TenantContext,
  input: { currentToken?: string; currentPassword: string; newPassword: string },
): Promise<AccountOutcome<{ otherSessionsRevoked: number }>> {
  if (input.newPassword.length < 8) {
    return fail("invalid-input", "كلمة السر الجديدة يجب ألا تقل عن 8 أحرف");
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { passwordHash: true },
  });
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    return fail("invalid-code", "كلمة السر الحالية غير صحيحة");
  }

  const passwordHash = await hashPassword(input.newPassword);
  const updated = await prisma.$transaction([
    prisma.user.update({
      where: { id: ctx.userId },
      data: { passwordHash },
      select: { id: true },
    }),
    // إبقاء جهاز المستخدم الحالي مسجلاً — إبطال بقية الأجهزة فقط.
    prisma.session.deleteMany({
      where: {
        userId: ctx.userId,
        ...(input.currentToken
          ? { tokenHash: { not: hashToken(input.currentToken) } }
          : {}),
      },
    }),
  ]);
  return { ok: true, value: { otherSessionsRevoked: updated[1].count } };
}

