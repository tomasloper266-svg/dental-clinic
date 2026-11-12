// قنوات إيصال الرسائل (SMS/بريد) — واجهة حقيقية قابلة للربط لاحقاً.
//
// المتطلبات عند الربط (تُحقن عبر متغيرات البيئة فقط، لا شيء في الشيفرة):
//   SMS:   SMS_API_URL + SMS_API_TOKEN   — POST JSON: { to, body }
//   EMAIL: EMAIL_API_URL + EMAIL_API_TOKEN — POST JSON: { to, subject, body }
//
// ما يحدث حين لا تُربط الخدمة: getChannel يعيد null، وخدمة OTP تعرض الرمز
// عبر مسار الإظهار الآمن البديل (انظر lib/auth/otp-service.ts) مع تحذير صريح
// في الواجهة — لا رموز مُختلَقة ولا مسارات معطلة. قبل الإنتاج يجب ربط موفّر
// فعلي وإلا بقيت الاستعادة تعتمد على الإظهار المباشر.

export type OutboundMessage = {
  to: string;
  body: string;
  /** للبريد فقط — تجاهلته قنوات SMS */
  subject?: string;
};

export interface MessageChannel {
  /** معرف القناة للتسجيل والتشخيص */
  readonly id: string;
  send(message: OutboundMessage): Promise<void>;
}

// موفّر HTTP عام — يرسل JSON إلى نقطة النهاية المضبوطة برمز حامل (Bearer).
// يعمل مع معظم بوابات SMS/البريد مباشرة أو عبر مغلّف صغير.
function createHttpChannel(
  id: string,
  urlEnv: string,
  tokenEnv: string,
): MessageChannel {
  return {
    id,
    async send(message) {
      const url = process.env[urlEnv];
      const token = process.env[tokenEnv];
      if (!url || !token) {
        throw new Error(
          `[${id}] channel not configured — set ${urlEnv} and ${tokenEnv}`,
        );
      }
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(message),
      });
      if (!res.ok) {
        throw new Error(`[${id}] delivery failed with status ${res.status}`);
      }
    },
  };
}

export function getSmsChannel(): MessageChannel | null {
  if (process.env.SMS_API_URL && process.env.SMS_API_TOKEN) {
    return createHttpChannel("sms-http", "SMS_API_URL", "SMS_API_TOKEN");
  }
  return null;
}

export function getEmailChannel(): MessageChannel | null {
  if (process.env.EMAIL_API_URL && process.env.EMAIL_API_TOKEN) {
    return createHttpChannel("email-http", "EMAIL_API_URL", "EMAIL_API_TOKEN");
  }
  return null;
}

export function channelFor(
  channel: "SMS" | "EMAIL",
): MessageChannel | null {
  return channel === "SMS" ? getSmsChannel() : getEmailChannel();
}

// تشخيص حالة الربط — تُستخدم في صفحة الإعداد والتقرير.
export function describeChannelConfig(): {
  smsConfigured: boolean;
  emailConfigured: boolean;
  requiredEnvKeys: Record<"SMS" | "EMAIL", string[]>;
} {
  return {
    smsConfigured: getSmsChannel() !== null,
    emailConfigured: getEmailChannel() !== null,
    requiredEnvKeys: {
      SMS: ["SMS_API_URL", "SMS_API_TOKEN"],
      EMAIL: ["EMAIL_API_URL", "EMAIL_API_TOKEN"],
    },
  };
}
