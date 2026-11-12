import { describe, it, expect, afterEach } from "vitest";
import {
  generateOtpCode,
  hashOtpCode,
  generateRecoveryCode,
  normalizeRecoveryCode,
  hashRecoveryCode,
  normalizeEmail,
  isValidEmail,
  maskPhone,
  maskEmail,
} from "@/lib/auth/otp";
import { parseIdentifier, parseNewPassword } from "@/lib/auth/recovery";
import { describeChannelConfig } from "@/lib/notifications/delivery";

describe("رموز OTP", () => {
  it("يولّد رمزاً من 6 أرقام", () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("هش الرمز حتمي", () => {
    expect(hashOtpCode("123456")).toBe(hashOtpCode("123456"));
    expect(hashOtpCode("123456")).not.toBe(hashOtpCode("654321"));
  });
});

describe("رمز الاسترداد الاحتياطي", () => {
  it("يولّد رمزاً بصيغة مجموعات من أربعة", () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){2}$/);
  });

  it("يولّد رموزاً مختلفة", () => {
    expect(generateRecoveryCode()).not.toBe(generateRecoveryCode());
  });

  it("تهيئة الرمز تزيل الفواصل وتوحّد الحالة", () => {
    expect(normalizeRecoveryCode("k7m2-4q9x-t3wz")).toBe("K7M24Q9XT3WZ");
  });

  it("الهش يثبت عبر صيغ العرض المختلفة", () => {
    expect(hashRecoveryCode("K7M2-4Q9X-T3WZ")).toBe(
      hashRecoveryCode("k7m24q9xt3wz"),
    );
  });
});

describe("البريد الإلكتروني", () => {
  it("تهيئة البريد تقلّل الحالة وتزيل الفراغات", () => {
    expect(normalizeEmail("  Doctor@Clinic.COM ")).toBe("doctor@clinic.com");
  });

  it("يتحقق من شكل البريد", () => {
    expect(isValidEmail("doctor@clinic.com")).toBe(true);
    expect(isValidEmail("doctor@clinic")).toBe(false);
    expect(isValidEmail("دكتور@عيادة.كوم")).toBe(false);
  });
});

describe("إخفاء الوجهات", () => {
  it("يخفي الهاتف ويُبقي آخر ثلاثة أرقام", () => {
    expect(maskPhone("0999123456")).toBe("•••••456");
  });

  it("يخفي البريد مع إبقاء بدايته ونطاقه", () => {
    expect(maskEmail("doctor@clinic.com")).toBe("do•••@clinic.com");
  });
});

describe("parseIdentifier", () => {
  it("يقبل هاتفاً ويزيل فراغاته", () => {
    expect(parseIdentifier({ phone: " 0999 123-456 " })).toEqual({
      kind: "phone",
      value: "0999123456",
    });
  });

  it("يقبل بريداً صالحاً ويزيل فراغاته ويوحّد حالته", () => {
    expect(parseIdentifier({ email: " Doctor@Clinic.COM " })).toEqual({
      kind: "email",
      value: "doctor@clinic.com",
    });
  });

  it("يرفض بريداً غير صالح وجسماً فارغاً", () => {
    expect(parseIdentifier({ email: "not-an-email" }).code).toBe(
      "invalid-input",
    );
    expect(parseIdentifier({}).code).toBe("invalid-input");
    expect(parseIdentifier(null).code).toBe("invalid-input");
  });
});

describe("parseNewPassword", () => {
  it("يقبل كلمة سر من 8 أحرف فأكثر ويرفض الأقصر", () => {
    expect(parseNewPassword({ newPassword: "longenough1" })).toBe(
      "longenough1",
    );
    expect(parseNewPassword({ newPassword: "short" }).code).toBe(
      "invalid-input",
    );
    expect(parseNewPassword({}).code).toBe("invalid-input");
  });
});

describe("describeChannelConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("يعيد عدم الربط حين تغيب مفاتيح البيئة", () => {
    delete process.env.SMS_API_URL;
    delete process.env.SMS_API_TOKEN;
    delete process.env.EMAIL_API_URL;
    delete process.env.EMAIL_API_TOKEN;
    const config = describeChannelConfig();
    expect(config.smsConfigured).toBe(false);
    expect(config.emailConfigured).toBe(false);
    expect(config.requiredEnvKeys.SMS).toEqual([
      "SMS_API_URL",
      "SMS_API_TOKEN",
    ]);
  });

  it("يعيد الربط حين تتوفر المفاتيح معاً", () => {
    process.env.SMS_API_URL = "https://example.test/sms";
    process.env.SMS_API_TOKEN = "secret";
    process.env.EMAIL_API_URL = "https://example.test/email";
    process.env.EMAIL_API_TOKEN = "secret";
    const config = describeChannelConfig();
    expect(config.smsConfigured).toBe(true);
    expect(config.emailConfigured).toBe(true);
  });
});
