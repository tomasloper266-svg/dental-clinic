import { describe, expect, it } from "vitest";
import { doctorDisplayName } from "@/lib/staff-name";

// اختبارات تحضير اسم الطبيب — بادئة «د. » تُضاف مرة واحدة حصراً ولا تتكرر.

describe("doctorDisplayName", () => {
  it("يضيف البادئة لاسم بلا «د. »", () => {
    expect(doctorDisplayName("خالد المنصور")).toBe("د. خالد المنصور");
  });

  it("لا يكرر البادئة إن وُجدت أصلاً (خطأ «د. د.»)", () => {
    expect(doctorDisplayName("د. خالد المنصور")).toBe("د. خالد المنصور");
  });

  it("يطبع «د.» الملصوقة بالاسم بمسافة قبل الإضافة", () => {
    expect(doctorDisplayName("د.خالد المنصور")).toBe("د. خالد المنصور");
  });

  it("يقصّ الفراغات الطرفية", () => {
    expect(doctorDisplayName("  رنا الحلبي ")).toBe("د. رنا الحلبي");
  });
});
