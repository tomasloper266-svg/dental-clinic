import { describe, expect, it } from "vitest";

import { filterTemplates, templateExcerpt } from "@/lib/templates-view";

// اختبارات عرض قوالب التعليمات — التصفية والسطر القصير، نقية بلا I/O.

const templates = [
  { id: "1", procedure: "خلع ضرس العقل", body: "انضم عضًا على قطعة شاش" },
  { id: "2", procedure: "حشو ضوئي", body: "تجنب الأكل ساعتين" },
  { id: "3", procedure: "زرعة", body: "اتبع تعليمات التخدير" },
];

describe("filterTemplates — تصفية القوالب", () => {
  it("بلا بحث يعطي كل القوالب", () => {
    expect(filterTemplates(templates, "")).toHaveLength(3);
    expect(filterTemplates(templates, "   ")).toHaveLength(3);
  });
  it("يطابق الإجراء", () => {
    expect(filterTemplates(templates, "خلع")).toEqual([templates[0]]);
  });
  it("يطابق نص التعليمات أيضاً", () => {
    expect(filterTemplates(templates, "ساعتين")).toEqual([templates[1]]);
  });
  it("لا تطابق يعطي قائمة فارغة", () => {
    expect(filterTemplates(templates, "تقويم")).toEqual([]);
  });
});

describe("templateExcerpt — سطر المعاينة القصير", () => {
  it("أول سطر من النص", () => {
    expect(templateExcerpt("سطر أول\nسطر ثانٍ")).toBe("سطر أول");
  });
  it("يقص النصوص الطويلة بعلامة حذف", () => {
    const long = "ط".repeat(100);
    const excerpt = templateExcerpt(long, 64);
    expect(excerpt.length).toBe(65);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});
