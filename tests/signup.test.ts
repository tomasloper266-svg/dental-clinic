import { describe, it, expect } from "vitest";
import { parseSignup, normalizePhone } from "@/lib/auth/signup";

describe("parseSignup", () => {
  it("يقبل بيانات صحيحة ويهذّب الفراغات", () => {
    const result = parseSignup({
      clinicName: "  عيادة الابتسامة ",
      name: "د. محمد",
      phone: "0999 123-456",
      password: "secret123",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        clinicName: "عيادة الابتسامة",
        name: "د. محمد",
        phone: "0999123456",
        password: "secret123",
      },
    });
  });

  it("يرفض جسماً غير كائن", () => {
    expect(parseSignup(null).ok).toBe(false);
    expect(parseSignup("نص").ok).toBe(false);
  });

  it("يرفض اسم عيادة قصيراً جداً", () => {
    const r = parseSignup({
      clinicName: "ع",
      name: "د. محمد",
      phone: "0999123456",
      password: "secret123",
    });
    expect(r.ok).toBe(false);
  });

  it("يرفض كلمة سر أقل من 8 أحرف", () => {
    const r = parseSignup({
      clinicName: "عيادة",
      name: "د. محمد",
      phone: "0999123456",
      password: "short",
    });
    expect(r.ok).toBe(false);
  });

  it("يرفض هاتفاً غير صالح", () => {
    const r = parseSignup({
      clinicName: "عيادة",
      name: "د. محمد",
      phone: "abc",
      password: "secret123",
    });
    expect(r.ok).toBe(false);
  });
});

describe("normalizePhone", () => {
  it("يزيل الفراغات والشرطات والأقواس", () => {
    expect(normalizePhone("+963 991-234-567")).toBe("+963991234567");
  });
});
