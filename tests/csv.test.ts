import { describe, expect, it } from "vitest";
import { toCsv, withUtf8Bom } from "@/lib/csv";

// اختبارات بناء CSV — نقية: اقتباس كامل، أسطر CRLF، وترميز UTF-8 للعربية.

describe("toCsv", () => {
  it("يبني رأساً وأسطراً باقتباس كامل وأسطر CRLF", () => {
    const csv = toCsv(["الاسم", "المبلغ"], [
      ["أحمد", 300_000],
      ["سارة", -200_000],
    ]);
    expect(csv).toBe(
      '"الاسم","المبلغ"\r\n"أحمد","300000"\r\n"سارة","-200000"',
    );
  });

  it("يضاعف علامات الاقتباس داخل النص ولا يكسر الفواصل", () => {
    const csv = toCsv(["البيان"], [['قال "تم"'], [""], []]);
    expect(csv).toBe('"البيان"\r\n"قال ""تم"""\r\n""\r\n');
  });

  it("يحوّل الخلايا الفارغة إلى نص فارغ", () => {
    expect(toCsv(["أ", "ب"], [["x", null]])).toBe('"أ","ب"\r\n"x",""');
  });
});

describe("withUtf8Bom", () => {
  it("يلحق علامة الترتيب في بداية النص", () => {
    expect(withUtf8Bom("abc").charCodeAt(0)).toBe(0xfeff);
  });
});
