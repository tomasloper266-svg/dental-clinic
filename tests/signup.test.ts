import { describe, it, expect } from "vitest";
import { parseSignup, normalizePhone } from "@/lib/auth/signup";

describe("parseSignup", () => {
  it("يقبل بيانات صحيحة ويهذّب الفراغات ويوحّد حالة اليوزرنيم", () => {
    const result = parseSignup({
      clinicName: "  عيادة الابتسامة ",
      name: "د. محمد",
      phone: "0999 123-456",
      username: "  Dr.Smile ",
      password: "secret123",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        clinicName: "عيادة الابتسامة",
        name: "د. محمد",
        phone: "0999123456",
        username: "dr.smile",
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
      username: "drsmile",
      password: "secret123",
    });
    expect(r.ok).toBe(false);
  });

  it("يرفض كلمة سر أقل من 8 أحرف", () => {
    const r = parseSignup({
      clinicName: "عيادة",
      name: "د. محمد",
      phone: "0999123456",
      username: "drsmile",
      password: "short",
    });
    expect(r.ok).toBe(false);
  });

  it("يرفض هاتفاً غير صالح", () => {
    const r = parseSignup({
      clinicName: "عيادة",
      name: "د. محمد",
      phone: "abc",
      username: "drsmile",
      password: "secret123",
    });
    expect(r.ok).toBe(false);
  });

  it("يرفض يوزرنيم أقصر من 3 محارف", () => {
    const r = parseSignup({
      clinicName: "عيادة",
      name: "د. محمد",
      phone: "0999123456",
      username: "ab",
      password: "secret123",
    });
    expect(r.ok).toBe(false);
  });

  it("يرفض يوزرنيم أطول من 30 محرفاً", () => {
    const r = parseSignup({
      clinicName: "عيادة",
      name: "د. محمد",
      phone: "0999123456",
      username: "a".repeat(31),
      password: "secret123",
    });
    expect(r.ok).toBe(false);
  });

  it("يرفض يوزرنيم بمحارف غير مسموحة (فراغات، حروف عربية، رموز)", () => {
    for (const bad of ["dr smile", "دكتور", "dr@smile", "dr!"]) {
      expect(
        parseSignup({
          clinicName: "عيادة",
          name: "د. محمد",
          phone: "0999123456",
          username: bad,
          password: "secret123",
        }).ok,
      ).toBe(false);
    }
  });

  it("يقبل يوزرنيم بنقطة وشرطة وشرطة سفلية", () => {
    const r = parseSignup({
      clinicName: "عيادة",
      name: "د. محمد",
      phone: "0999123456",
      username: "dr.smile_clinic-1",
      password: "secret123",
    });
    expect(r.ok).toBe(true);
  });
});

describe("normalizePhone", () => {
  it("يزيل الفراغات والشرطات والأقواس", () => {
    expect(normalizePhone("+963 991-234-567")).toBe("+963991234567");
  });
});
