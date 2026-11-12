import { describe, expect, it } from "vitest";

import {
  buildReminderMessage,
  buildWhatsAppUrl,
  normalizePhone,
} from "@/lib/reminders/whatsapp";

// اختبارات نقية — تنظيم أرقام الهاتف وبناء نص التذكير وروابط wa.me
// بلا قاعدة بيانات ولا شبكة.

describe("normalizePhone — تنظيم أرقام الهاتف", () => {
  it("يزيل الأصفار البادئة والرموز والأقسام", () => {
    expect(normalizePhone("0933333333")).toBe("933333333");
    expect(normalizePhone("0933-333-333")).toBe("933333333");
    expect(normalizePhone("+963 933 333 333")).toBe("963933333333");
    expect(normalizePhone("(0933) 333/333")).toBe("933333333");
  });

  it("يحوّل الأرقام العربية-الهندية وينظفها بنفس القاعدة", () => {
    expect(normalizePhone("٠٩٣٣٣٣٣٣٣٣")).toBe("933333333");
    expect(normalizePhone("+٩٦٣٩٣٣٣٣٣٣٣٣")).toBe("963933333333");
  });

  it("يبقي أرقام الدولة البادئة غير الصفرية كما هي", () => {
    expect(normalizePhone("963933333333")).toBe("963933333333");
    expect(normalizePhone("12025550123")).toBe("12025550123");
  });

  it("يعيد null لما لا يصلح رقماً", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("٠٠٠٠")).toBeNull(); // أصفار فقط بعد التنظيف
    expect(normalizePhone("   ")).toBeNull();
  });
});

describe("buildReminderMessage — نص التذكير", () => {
  it("يتضمن اسم المريض والعيادة والطبيب وتاريخ ووقت الموعد", () => {
    const message = buildReminderMessage({
      patientName: "أحمد",
      clinicName: "عيادة الابتسامة",
      doctorName: "د. علي",
      dateText: "الثلاثاء 16 يونيو",
      timeText: "10:30",
    });
    expect(message).toContain("أحمد");
    expect(message).toContain("عيادة الابتسامة");
    expect(message).toContain("د. علي");
    expect(message).toContain("الثلاثاء 16 يونيو");
    expect(message).toContain("10:30");
  });

  it("رسالة مهذبة وآمنة الإرسال — تذكير بنوعه في النص", () => {
    const message = buildReminderMessage({
      patientName: "م",
      clinicName: "ع",
      doctorName: "د",
      dateText: "غداً",
      timeText: "09:00",
    });
    expect(message).toContain("نذكّركم بموعدكم");
  });
});

describe("buildWhatsAppUrl — روابط wa.me", () => {
  it("يبني رابط wa.me برقم مقبّد ونص رسالة مرمّز", () => {
    const url = buildWhatsAppUrl("0933-333-333", "مرحباً بك");
    expect(url).toMatch(/^https:\/\/wa\.me\/933333333\?text=/);
    expect(url).toContain(encodeURIComponent("مرحباً بك"));
  });

  it("لا يضع + ولا أصفاراً في مقطع الرقم", () => {
    const url = buildWhatsAppUrl("+963 933 333 333", "تذكير");
    expect(url).toMatch(/^https:\/\/wa\.me\/963933333333\?text=/);
  });

  it("يعيد null لرقم غير صالح — لا رابط بلا رقم", () => {
    expect(buildWhatsAppUrl("abc", "نص")).toBeNull();
    expect(buildWhatsAppUrl("", "نص")).toBeNull();
  });
});
