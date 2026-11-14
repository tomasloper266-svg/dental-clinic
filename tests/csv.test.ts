import { describe, expect, it, vi } from "vitest";
import { downloadCsv, toCsv, withUtf8Bom } from "@/lib/csv";

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

describe("downloadCsv", () => {
  it("يبدأ الـblob بعلامة الترتيب على أول بايتات الملف (خطأ 11)", async () => {
    const captured: Blob[] = [];
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: (blob: Blob) => {
          captured.push(blob);
          return `blob:mock-${captured.length}`;
        },
        revokeObjectURL: () => {},
      }),
    );

    downloadCsv(
      "تقرير الفترة.csv",
      '"البند","القيمة ($)"\r\n"إجمالي الفواتير","100"',
    );

    expect(captured).toHaveLength(1);
    const head = new Uint8Array(await captured[0].slice(0, 3).arrayBuffer());
    // EF BB BF — البايتات الثلاثة نفسها التي تفتتح بها تصديرات الخادم
    expect(Array.from(head)).toEqual([0xef, 0xbb, 0xbf]);
    // Blob.text() تفك ترميز UTF-8 وتُسقط العلامة — فالبند الأول يظهر مباشرة
    const text = await captured[0].text();
    expect(text.startsWith('"البند"')).toBe(true);
    vi.unstubAllGlobals();
  });
});
