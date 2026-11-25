import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  generateOtpCode,
  hashOtpCode,
  hashRecoveryCode,
  isValidEmail,
  maskEmail,
  maskPhone,
  normalizeEmail,
} from "@/lib/auth/otp";
import { normalizePhone } from "@/lib/auth/signup";
import { channelFor } from "@/lib/notifications/delivery";
import type { SupportRequest } from "@/lib/generated/prisma/client";

// مسارات استعادة الحساب — طبقة الخدمة التي تلمس القاعدة.
// كل مسار يثبت الملكية عبر OTP على قناة موثقة (هاتف/بريد مُتحقق منه) أو
// رمز استرداد، ولا يكشف أي بيانات قبل الإثبات.

export type RecoveryErrorCode =
  | "invalid-input"
  | "not-found"
  | "ambiguous"
  | "cooldown"
  | "expired"
  | "too-many-attempts"
  | "invalid-code"
  | "email-taken";

export type RecoveryError = { code: RecoveryErrorCode; message: string };

export type IssueOutcome =
  | {
      ok: true;
      delivered: boolean;
      /** يُعرض فقط حين لا تُربط قناة الإرسال — مسار بديل صريح لا رمز مُختلَق */
      fallbackCode?: string;
      destinationHint: string;
    }
  | { ok: false; error: RecoveryError };

export type Identifier =
  | { kind: "phone"; value: string }
  | { kind: "email"; value: string };

export function parseIdentifier(body: unknown): Identifier | RecoveryError {
  if (typeof body !== "object" || body === null) {
    return { code: "invalid-input", message: "Invalid request" };
  }
  const b = body as Record<string, unknown>;
  const phone = typeof b.phone === "string" ? normalizePhone(b.phone.trim()) : "";
  const email = typeof b.email === "string" ? normalizeEmail(b.email) : "";
  if (phone) return { kind: "phone", value: phone };
  if (email) {
    if (!isValidEmail(email)) {
      return { code: "invalid-input", message: "Invalid email address" };
    }
    return { kind: "email", value: email };
  }
  return {
    code: "invalid-input",
    message: "Enter your phone number or verified email",
  };
}

export function parseNewPassword(body: unknown): string | RecoveryError {
  const password =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).newPassword
      : undefined;
  if (typeof password !== "string" || password.length < 8) {
    return {
      code: "invalid-input",
      message: "Password must be at least 8 characters",
    };
  }
  return password;
}

// ─── إصدار رمز التحقق وتسليمه ───────────────────────────────────────────────

function otpMessage(code: string): string {
  return `رمز التحقق الخاص بك: ${code}\nصالح لعشر دقائق — لا تشاركه مع أحد.`;
}

// يُبطل الرموز غير المستهلكة السابقة لنفس الغرض ثم يُصدر رمزاً جديداً.
// حين لا تُربط قناة الإرسال يعيد الرمز كمسار بديل صريح (fallbackCode).
async function issueOtp(input: {
  userId: string;
  purpose: "PASSWORD_RESET" | "EMAIL_VERIFICATION" | "PHONE_RECOVERY";
  channel: "SMS" | "EMAIL";
  destination: string;
}): Promise<IssueOutcome> {
  const last = await prisma.verificationToken.findFirst({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
  if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      error: {
        code: "cooldown",
        message: "A code was just sent — wait a minute and try again",
      },
    };
  }

  await prisma.verificationToken.deleteMany({
    where: { userId: input.userId, purpose: input.purpose, consumedAt: null },
  });

  const code = generateOtpCode();
  await prisma.verificationToken.create({
    data: {
      userId: input.userId,
      purpose: input.purpose,
      channel: input.channel,
      destination: input.destination,
      codeHash: hashOtpCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const channel = channelFor(input.channel);
  const destinationHint =
    input.channel === "SMS"
      ? maskPhone(input.destination)
      : maskEmail(input.destination);

  if (!channel) {
    return { ok: true, delivered: false, fallbackCode: code, destinationHint };
  }
  try {
    await channel.send({
      to: input.destination,
      body: otpMessage(code),
      subject: "رمز التحقق — نظام إدارة عيادات الأسنان",
    });
    return { ok: true, delivered: true, destinationHint };
  } catch (err) {
    // فشل التسليم لا يُكتم: يُسجل، ويُعرض الرمز عبر المسار البديل.
    console.error(`[otp] delivery via ${channel.id} failed:`, err);
    return { ok: true, delivered: false, fallbackCode: code, destinationHint };
  }
}

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; error: RecoveryError };

// التحقق دون استهلاك — لخطوة «تأكيد الرمز» في الواجهة قبل تعيين كلمة السر.
export async function verifyOtp(input: {
  userId: string;
  purpose: "PASSWORD_RESET" | "EMAIL_VERIFICATION" | "PHONE_RECOVERY";
  code: string;
}): Promise<VerifyOutcome> {
  const token = await prisma.verificationToken.findFirst({
    where: { userId: input.userId, purpose: input.purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token) {
    return {
      ok: false,
      error: { code: "not-found", message: "No active code — request a new one" },
    };
  }
  if (token.expiresAt < new Date()) {
    return {
      ok: false,
      error: { code: "expired", message: "The code expired — request a new one" },
    };
  }
  if (token.attempts >= OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      error: {
        code: "too-many-attempts",
        message: "Too many attempts — request a new code",
      },
    };
  }
  if (token.codeHash !== hashOtpCode(input.code)) {
    await prisma.verificationToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    return {
      ok: false,
      error: { code: "invalid-code", message: "Incorrect code — check it and try again" },
    };
  }
  return { ok: true };
}

// ─── نسيت كلمة المرور ───────────────────────────────────────────────────────

// الهاتف فريد لكل عيادة وليس عالمياً — تطابق أكثر من حساب يعني غموضاً
// يجب حسمه بقناة أخرى (بريد موثق أو دعم) بدلاً من التخمين.
async function resolveUserByIdentifier(
  identifier: Identifier,
): Promise<{ id: string } | RecoveryError> {
  if (identifier.kind === "phone") {
    const users = await prisma.user.findMany({
      where: { phone: identifier.value },
      select: { id: true },
    });
    if (users.length === 0) {
      return { code: "not-found", message: "No account found with this phone number" };
    }
    if (users.length > 1) {
      return {
        code: "ambiguous",
        message:
          "This number is used by more than one clinic — use your verified email or contact support",
      };
    }
    return { id: users[0].id };
  }
  // البريد يُقبل بعد التحقق منه فقط — حقلا emailVerifiedAt إجباري هنا.
  const users = await prisma.user.findMany({
    where: { email: identifier.value, emailVerifiedAt: { not: null } },
    select: { id: true },
  });
  if (users.length === 0) {
    return {
      code: "not-found",
      message: "No account found with this verified email",
    };
  }
  if (users.length > 1) {
    return { code: "ambiguous", message: "Contact support to complete recovery" };
  }
  return { id: users[0].id };
}

export async function requestPasswordReset(
  identifier: Identifier,
): Promise<IssueOutcome> {
  const resolved = await resolveUserByIdentifier(identifier);
  if ("code" in resolved) return { ok: false, error: resolved };
  return issueOtp({
    userId: resolved.id,
    purpose: "PASSWORD_RESET",
    channel: identifier.kind === "phone" ? "SMS" : "EMAIL",
    destination: identifier.value,
  });
}

export async function verifyPasswordResetCode(input: {
  identifier: Identifier;
  code: string;
}): Promise<VerifyOutcome> {
  const resolved = await resolveUserByIdentifier(input.identifier);
  if ("code" in resolved) return { ok: false, error: resolved };
  return verifyOtp({
    userId: resolved.id,
    purpose: "PASSWORD_RESET",
    code: input.code,
  });
}

// تعيين كلمة السر الجديدة: تحقق، استهلاك الرمز، تحديث الهاش، وإبطال كل
// جلسات الحساب القديمة — في معاملة واحدة.
export async function resetPassword(input: {
  identifier: Identifier;
  code: string;
  newPassword: string;
}): Promise<VerifyOutcome> {
  const resolved = await resolveUserByIdentifier(input.identifier);
  if ("code" in resolved) return { ok: false, error: resolved };
  const verdict = await verifyOtp({
    userId: resolved.id,
    purpose: "PASSWORD_RESET",
    code: input.code,
  });
  if (!verdict.ok) return verdict;

  const passwordHash = await hashPassword(input.newPassword);
  const token = await prisma.verificationToken.findFirst({
    where: { userId: resolved.id, purpose: "PASSWORD_RESET", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token) {
    return {
      ok: false,
      error: { code: "not-found", message: "No active code — request a new one" },
    };
  }

  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: resolved.id },
      data: { passwordHash },
    }),
    // إبطال الجلسات القديمة — من طلب الاستعادة إلى كل الأجهزة.
    prisma.session.deleteMany({ where: { userId: resolved.id } }),
  ]);
  return { ok: true };
}

// ─── نسيت رقم الهاتف ────────────────────────────────────────────────────────

export async function requestPhoneRecoveryByEmail(
  email: string,
): Promise<IssueOutcome> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return {
      ok: false,
      error: { code: "invalid-input", message: "Invalid email address" },
    };
  }
  const users = await prisma.user.findMany({
    where: { email: normalized, emailVerifiedAt: { not: null } },
    select: { id: true },
  });
  if (users.length === 0) {
    return {
      ok: false,
      error: { code: "not-found", message: "No account found with this verified email" },
    };
  }
  return issueOtp({
    userId: users[0].id,
    purpose: "PHONE_RECOVERY",
    channel: "EMAIL",
    destination: normalized,
  });
}

export type RecoveredPhone = { clinicName: string; phone: string };

// إثبات الملكية بالبريد الموثق — يكشف أرقام الهواتف المرتبطة بالبريد فقط
// بعد التحقق من الرمز، ويستهلك الرمز.
export async function verifyPhoneRecovery(input: {
  email: string;
  code: string;
}): Promise<{ ok: true; accounts: RecoveredPhone[] } | { ok: false; error: RecoveryError }> {
  const normalized = normalizeEmail(input.email);
  const users = await prisma.user.findMany({
    where: { email: normalized, emailVerifiedAt: { not: null } },
    select: { id: true },
  });
  if (users.length === 0) {
    return {
      ok: false,
      error: { code: "not-found", message: "No account found with this verified email" },
    };
  }
  const verdict = await verifyOtp({
    userId: users[0].id,
    purpose: "PHONE_RECOVERY",
    code: input.code,
  });
  if (!verdict.ok) return verdict;

  const token = await prisma.verificationToken.findFirst({
    where: { userId: users[0].id, purpose: "PHONE_RECOVERY", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (token) {
    await prisma.verificationToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });
  }

  const accounts = await prisma.user.findMany({
    where: { email: normalized, emailVerifiedAt: { not: null } },
    select: { phone: true, clinic: { select: { name: true } } },
  });
  return {
    ok: true,
    accounts: accounts.map((a) => ({
      clinicName: a.clinic.name,
      phone: a.phone,
    })),
  };
}

// إثبات الملكية برمز الاسترداد الاحتياطي — يعيد رقم الهاتف والعيادة.
export async function recoverPhoneByRecoveryCode(input: {
  recoveryCode: string;
}): Promise<
  { ok: true; account: RecoveredPhone } | { ok: false; error: RecoveryError }
> {
  if (!input.recoveryCode || input.recoveryCode.trim().length < 8) {
    return {
      ok: false,
      error: { code: "invalid-input", message: "Enter the backup recovery code" },
    };
  }
  const user = await prisma.user.findFirst({
    where: { recoveryCodeHash: hashRecoveryCode(input.recoveryCode) },
    select: { phone: true, clinic: { select: { name: true } } },
  });
  if (!user) {
    return {
      ok: false,
      error: { code: "invalid-code", message: "Incorrect recovery code" },
    };
  }
  return { ok: true, account: { phone: user.phone, clinicName: user.clinic.name } };
}

// تعيين كلمة سر جديدة بحيازة رمز الاسترداد — حيازته تثبت الملكية، فنحدّث
// الهاش ونبطل كل الجلسات القديمة. الرمز نفسه لا يُستهلك (يبقى مفتاح طوارئ).
export async function resetPasswordByRecoveryCode(input: {
  recoveryCode: string;
  newPassword: string;
}): Promise<VerifyOutcome> {
  const code = input.recoveryCode?.trim() ?? "";
  if (code.length < 8) {
    return {
      ok: false,
      error: { code: "invalid-input", message: "Enter the backup recovery code" },
    };
  }
  if (typeof input.newPassword !== "string" || input.newPassword.length < 8) {
    return {
      ok: false,
      error: { code: "invalid-input", message: "Password must be at least 8 characters" },
    };
  }
  const user = await prisma.user.findFirst({
    where: { recoveryCodeHash: hashRecoveryCode(code) },
    select: { id: true },
  });
  if (!user) {
    return {
      ok: false,
      error: { code: "invalid-code", message: "Incorrect recovery code" },
    };
  }
  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  return { ok: true };
}

// ─── مسار الدعم — «نسيت رقم الهاتف» بلا قناة موثقة ينتهي هنا ────────────────

export async function createSupportRequest(input: {
  clinicName: string;
  contactEmail?: string;
  contactPhone?: string;
  message: string;
}): Promise<SupportRequest | RecoveryError> {
  const clinicName = input.clinicName.trim();
  const message = input.message.trim();
  if (clinicName.length < 2) {
    return { code: "invalid-input", message: "Enter the clinic name" };
  }
  if (message.length < 10) {
    return { code: "invalid-input", message: "Write a clear description (at least 10 characters)" };
  }
  const contactEmail = input.contactEmail?.trim()
    ? normalizeEmail(input.contactEmail)
    : undefined;
  if (contactEmail && !isValidEmail(contactEmail)) {
    return { code: "invalid-input", message: "Invalid email address" };
  }
  const contactPhone = input.contactPhone?.trim()
    ? normalizePhone(input.contactPhone)
    : undefined;

  return prisma.supportRequest.create({
    data: {
      clinicName,
      contactEmail,
      contactPhone,
      message,
    },
  });
}
