import { createHash, createHmac, randomInt } from "node:crypto";

// أدوات رموز التحقق ورموز الاسترداد — نقية بلا I/O لسهولة اختبارها.
// الخدمات التي تلمس القاعدة تستخدمها من lib/auth/otp-service.ts.

export const OTP_TTL_MS = 10 * 60 * 1000; // عشر دقائق
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // دقيقة بين كل إرسالين
export const RECOVERY_CODE_LENGTH = 12; // قبل التنسيق

// مفتاح إضافي لهش رموز OTP القصيرة — يمنع تفكيكها من تسريب قاعدة البيانات.
// إن غاب يُستخدم SHA-256 وحده (نمط الجلسات) — يُوصى بضبط OTP_PEPPER في الإنتاج.
function otpPepper(): string {
  return process.env.OTP_PEPPER ?? "";
}

export function hashOtpCode(code: string): string {
  const pepper = otpPepper();
  if (!pepper) return createHash("sha256").update(code).digest("hex");
  return createHmac("sha256", pepper).update(code).digest("hex");
}

// رمز من 6 أرقام عبر randomInt — بلا تحيّز modulus.
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// حروف رمز الاسترداد: بلا أصفار/آحاد وبلا أحرف متشابهة (O/0, I/1, L).
const RECOVERY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateRecoveryCode(): string {
  let raw = "";
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
    raw += RECOVERY_ALPHABET[randomInt(0, RECOVERY_ALPHABET.length)];
  }
  return formatRecoveryCode(raw);
}

export function formatRecoveryCode(raw: string): string {
  return raw.match(/.{1,4}/g)?.join("-") ?? raw;
}

// تهيئة رمز الاسترداد قبل المقارنة: إزالة الفواصل وتوحيد الحالة.
export function normalizeRecoveryCode(raw: string): string {
  return raw.replace(/[^2-9A-Za-z]/g, "").toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

// ─── البريد الإلكتروني ───────────────────────────────────────────────────────

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test(normalizeEmail(raw));
}

// ─── إخفاء الوجهات في الواجهة — لا نعرض هاتفاً أو بريداً كاملاً قبل إثبات الملكية ──

export function maskPhone(phone: string): string {
  const tail = phone.slice(-3);
  return `•••••${tail}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = normalizeEmail(email).split("@");
  if (!local || !domain) return "•••";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}•••@${domain}`;
}
