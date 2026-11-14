import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGO_LETTER,
  clinicLogoLetter,
} from "@/lib/branding";

describe("clinicLogoLetter", () => {
  it("يُرجع الحرف المخزّن كما هو", () => {
    expect(clinicLogoLetter("ن")).toBe("ن");
    expect(clinicLogoLetter("ن", "عيادات النور")).toBe("ن");
  });

  it("يُفسّر الحرف من اسم العيادة عند غياب المخزّن", () => {
    expect(clinicLogoLetter("", "عيادات النور")).toBe("ع");
    expect(clinicLogoLetter(undefined, "الشفق")).toBe("ا");
    expect(clinicLogoLetter(null, "   النور  ")).toBe("ا");
  });

  it("يلحق بالمثل الافتراضي عند غيابهما معاً أو بفراغات فقط", () => {
    expect(clinicLogoLetter()).toBe(DEFAULT_LOGO_LETTER);
    expect(clinicLogoLetter("", "")).toBe(DEFAULT_LOGO_LETTER);
    expect(clinicLogoLetter("   ", "   ")).toBe(DEFAULT_LOGO_LETTER);
    expect(clinicLogoLetter("  ", undefined)).toBe(DEFAULT_LOGO_LETTER);
  });

  it("الحرف المخزّن كفراغ لا يُقبل كحرف — يُفسَّر من الاسم", () => {
    expect(clinicLogoLetter(" ", "عيادات النور")).toBe("ع");
  });
});
