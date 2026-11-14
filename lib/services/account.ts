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
import { type DisplayCurrency } from "@/lib/currency";
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

// ساعات العمل بصيغة 12 ساعة — «09:00 AM» حتى «09:00 PM» خطوة نصف ساعة.
const WORK_TIME_PATTERN = /^(0[0-9]|1[0-2]):[0-5]0 (AM|PM)$/;

export function isValidWorkTime(value: string): boolean {
  return WORK_TIME_PATTERN.test(value);
}

/** العملات المعروضة المسموحة — قائمة مغلقة لا نص حر */
const DISPLAY_CURRENCIES: readonly DisplayCurrency[] = ["USD", "SYP"];

function isDisplayCurrency(value: string): value is DisplayCurrency {
  return (DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

// استكمال بيانات العيادة والطبيب — تعديل أسماء وإعدادات العيادة العامة
// (العملة وسعر الصرف والرصيد الافتتاحي وساعات العمل)؛ لا يُلمس رقم الهاتف
// هنا أبداً: تغيير الهاتف يتطلب إثبات ملكية منفصل خارج هذه الواجهة.
export async function updateProfile(
  ctx: TenantContext,
  input: {
    name?: string;
    clinicName?: string;
    usdRate?: number;
    logoLetter?: string;
    currency?: string;
    openingBalance?: number;
    workStart?: string;
    workEnd?: string;
  },
): Promise<
  AccountOutcome<{
    name: string;
    clinicName: string;
    usdRate: number;
    currency: DisplayCurrency;
  }>
> {
  const name = input.name?.trim();
  const clinicName = input.clinicName?.trim();
  const logoLetter = input.logoLetter?.trim();
  const currency = input.currency?.trim();
  const { usdRate, openingBalance, workStart, workEnd } = input;
  if (name !== undefined && (name.length < 2 || name.length > 100)) {
    return fail("invalid-input", "الاسم يجب أن يكون بين 2 و100 حرف");
  }
  if (clinicName !== undefined && (clinicName.length < 2 || clinicName.length > 100)) {
    return fail("invalid-input", "اسم العيادة يجب أن يكون بين 2 و100 حرف");
  }
  if (usdRate !== undefined && (!Number.isFinite(usdRate) || usdRate <= 0)) {
    return fail("invalid-input", "سعر الصرف يجب أن يكون رقماً موجباً");
  }
  if (logoLetter !== undefined && logoLetter.length > 2) {
    return fail("invalid-input", "حرف الشعار حرف أو حرفان كحد أقصى");
  }
  if (currency !== undefined && !isDisplayCurrency(currency)) {
    return fail("invalid-input", "العملة إما دولار (USD) أو ليرة سورية (SYP)");
  }
  if (
    openingBalance !== undefined &&
    (!Number.isFinite(openingBalance) || openingBalance < 0)
  ) {
    return fail("invalid-input", "الرصيد الافتتاحي يجب أن يكون رقماً غير سالب");
  }
  if (workStart !== undefined && !isValidWorkTime(workStart)) {
    return fail("invalid-input", "بداية الدوام بصيغة غير صحيحة");
  }
  if (workEnd !== undefined && !isValidWorkTime(workEnd)) {
    return fail("invalid-input", "نهاية الدوام بصيغة غير صحيحة");
  }

  const clinicData: {
    name?: string;
    usdRate?: number;
    currency?: string;
    logoLetter?: string;
    openingBalance?: number;
    workStart?: string;
    workEnd?: string;
  } = {};
  if (clinicName !== undefined) clinicData.name = clinicName;
  if (usdRate !== undefined) clinicData.usdRate = usdRate;
  if (currency !== undefined) clinicData.currency = currency;
  if (logoLetter !== undefined) clinicData.logoLetter = logoLetter;
  if (openingBalance !== undefined) clinicData.openingBalance = openingBalance;
  if (workStart !== undefined) clinicData.workStart = workStart;
  if (workEnd !== undefined) clinicData.workEnd = workEnd;

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
          select: { name: true, usdRate: true, currency: true },
        })
      : prisma.clinic.findUniqueOrThrow({
          where: { id: ctx.clinicId },
          select: { name: true, usdRate: true, currency: true },
        }),
  ]);

  return {
    ok: true,
    value: {
      name: userRow.name,
      clinicName: clinicRow.name,
      usdRate: clinicRow.usdRate,
      currency: clinicRow.currency as DisplayCurrency,
    },
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

// العملة المعروضة لصفحات المبالغ — USD يعرض الدولار أساسياً، والعكس مع SYP.
export async function getClinicCurrency(
  ctx: TenantContext,
): Promise<DisplayCurrency> {
  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: ctx.clinicId },
    select: { currency: true },
  });
  return clinic.currency as DisplayCurrency;
}

// ─── قفل التطبيق — لكل حساب مستقله كقفل الهاتف ─────────────────────────────────

// الرمز الافتراضي وفق ملاحظة البطاقة — يُهشَّر ولا يُخزَّن نصاً أبداً.
export const DEFAULT_LOCK_PIN = "0000";

export function isValidLockPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

// حفظ إعدادات القفل من بطاقة الإعدادات: تفعيل/تعطيل مع إعادة تعيين الرمز
// اختيارياً. التفعيل بلا رمز جديد يُبقي الرمز الحالياً أو يضع الافتراضي 0000.
export async function setLockSettings(
  ctx: TenantContext,
  input: { enabled: boolean; pin?: string },
): Promise<AccountOutcome<{ enabled: boolean; pinChanged: boolean }>> {
  const pin = input.pin?.trim();
  if (pin !== undefined && !isValidLockPin(pin)) {
    return fail("invalid-input", "الرمز الرقمي 4 أرقام بالضبط");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { lockPinHash: true },
  });

  let pinHash: string | undefined;
  if (pin !== undefined) {
    pinHash = await hashPassword(pin);
  } else if (input.enabled && user.lockPinHash === null) {
    pinHash = await hashPassword(DEFAULT_LOCK_PIN);
  }

  await prisma.user.update({
    where: { id: ctx.userId },
    data: {
      lockEnabled: input.enabled,
      ...(pinHash !== undefined ? { lockPinHash: pinHash } : {}),
    },
  });
  return { ok: true, value: { enabled: input.enabled, pinChanged: pinHash !== undefined } };
}

export type LockState = { enabled: boolean; hasPin: boolean };

// حالة قفل حساب الجلسة — يقرأها غلاف الصفحات لتحويل الدخول إلى شاشة القفل.
export async function getLockState(ctx: TenantContext): Promise<LockState> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { lockEnabled: true, lockPinHash: true },
  });
  return { enabled: user.lockEnabled, hasPin: user.lockPinHash !== null };
}

// التحقق من الرمز الرقمي على شاشة القفل — مقارنة الهاش، بلا أي كشف عن الرمز.
export async function verifyLockPin(
  ctx: TenantContext,
  pin: string,
): Promise<boolean> {
  if (!isValidLockPin(pin)) return false;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { lockEnabled: true, lockPinHash: true },
  });
  if (!user.lockEnabled || user.lockPinHash === null) return false;
  return verifyPassword(pin, user.lockPinHash);
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

// لمحة الحساب لصفحة الإعدادات — بيانات العيدة وحالتها وحالة البريد
// وقنوات الإرسال، وحالة القفل بلا أي أثر للرمز نفسه.
export async function getAccountOverview(ctx: TenantContext): Promise<{
  name: string;
  clinicName: string;
  usdRate: number;
  currency: DisplayCurrency;
  logoLetter: string;
  openingBalance: number;
  workStart: string;
  workEnd: string;
  lockEnabled: boolean;
  hasPin: boolean;
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
      lockEnabled: true,
      lockPinHash: true,
      clinic: {
        select: {
          name: true,
          usdRate: true,
          currency: true,
          logoLetter: true,
          openingBalance: true,
          workStart: true,
          workEnd: true,
        },
      },
    },
  });
  return {
    name: user.name,
    clinicName: user.clinic.name,
    usdRate: user.clinic.usdRate,
    currency: user.clinic.currency as DisplayCurrency,
    logoLetter: user.clinic.logoLetter,
    openingBalance: user.clinic.openingBalance,
    workStart: user.clinic.workStart,
    workEnd: user.clinic.workEnd,
    lockEnabled: user.lockEnabled,
    hasPin: user.lockPinHash !== null,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    channels: describeChannelConfig(),
  };
}

// ─── واجهة بطاقة الإعدادات — معلومات العيادة والعملة والقفل معاً ──────────────

/** حقول بطاقة «معلومات العيادة» و«قفل التطبيق» القابلة للتحديث من الصفحة */
export type SettingsPatchInput = {
  clinicName?: string;
  logoLetter?: string;
  currency?: string;
  usdRate?: number;
  openingBalance?: number;
  workStart?: string;
  workEnd?: string;
};

export type LockPatchInput = { enabled?: boolean; pin?: string };

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** رقم من الجسم — رقم صريح أو نص رقمي، وإلا يُتجاهل */
function numberFrom(raw: Record<string, unknown>, key: string): number | undefined {
  const value = raw[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** منطق من الجسم — نص صريح أو قيمة منطقية، مع قبول تسميات الواجهة العربية */
function booleanFrom(raw: Record<string, unknown>, key: string): boolean | undefined {
  const value = raw[key];
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "ENABLED") return true;
  if (value === "false" || value === "DISABLED") return false;
  return undefined;
}

/** تحليل جسم طلب الإعدادات — الحقول الغريبة تُتجاهل والنواقص تبقى كما هي */
export function parseSettingsInput(
  raw: Record<string, unknown>,
): ParseResult<SettingsPatchInput> {
  const input: SettingsPatchInput = {};
  if (typeof raw.clinicName === "string") input.clinicName = raw.clinicName;
  if (typeof raw.logoLetter === "string") input.logoLetter = raw.logoLetter;
  if (typeof raw.currency === "string") input.currency = raw.currency;
  if (typeof raw.workStart === "string") input.workStart = raw.workStart;
  if (typeof raw.workEnd === "string") input.workEnd = raw.workEnd;
  const usdRate = numberFrom(raw, "usdRate");
  if (usdRate !== undefined) input.usdRate = usdRate;
  const openingBalance = numberFrom(raw, "openingBalance");
  if (openingBalance !== undefined) input.openingBalance = openingBalance;
  return { ok: true, value: input };
}

/** تحليل جسم طلب القفل — الرمز إن وُجد يجب أن يكون 4 أرقام بالضبط */
export function parseLockInput(
  raw: Record<string, unknown>,
): ParseResult<LockPatchInput> {
  const input: LockPatchInput = {};
  const enabled = booleanFrom(raw, "lockEnabled");
  if (enabled !== undefined) input.enabled = enabled;
  if (typeof raw.pinCode === "string" && raw.pinCode.trim() !== "") {
    const pin = raw.pinCode.trim();
    if (!isValidLockPin(pin)) {
      return { ok: false, error: "الرمز الرقمي 4 أرقام بالضبط" };
    }
    input.pin = pin;
  }
  return { ok: true, value: input };
}

// حفظ بطاقتي الإعدادات معاً: بيانات العيادة ثم حالة القفل إن طُلب أحدهما.
// تعطيل القفل بلا رمز لا يلمس الرمز المحفوظ — تعاد الإعدادات كاملة بعد الحفظ.
export async function updateSettings(
  ctx: TenantContext,
  settings: SettingsPatchInput,
  lock: LockPatchInput,
): Promise<AccountOutcome<Awaited<ReturnType<typeof getAccountOverview>>>> {
  const hasClinicFields =
    settings.clinicName !== undefined ||
    settings.logoLetter !== undefined ||
    settings.currency !== undefined ||
    settings.usdRate !== undefined ||
    settings.openingBalance !== undefined ||
    settings.workStart !== undefined ||
    settings.workEnd !== undefined;

  if (hasClinicFields) {
    const clinicResult = await updateProfile(ctx, settings);
    if (!clinicResult.ok) return clinicResult;
  }

  if (lock.enabled !== undefined || lock.pin !== undefined) {
    const lockInput =
      lock.enabled !== undefined
        ? { enabled: lock.enabled, pin: lock.pin }
        : { enabled: (await getLockState(ctx)).enabled, pin: lock.pin };
    const lockResult = await setLockSettings(ctx, lockInput);
    if (!lockResult.ok) return lockResult;
  }

  return { ok: true, value: await getAccountOverview(ctx) };
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

