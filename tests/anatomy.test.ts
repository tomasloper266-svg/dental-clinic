import { describe, it, expect } from "vitest";
import {
  SURFACE_OPTIONS,
  toothAnatomies,
  toothAnatomy,
  type ToothType,
} from "@/lib/odontogram/anatomy";
import {
  allTeeth,
  upperRowLeftToRight,
  lowerRowLeftToRight,
  type ToothCell,
} from "@/lib/odontogram/fdi";

const TYPES: ToothType[] = ["incisor", "canine", "premolar", "molar"];

describe("التشريح السني — anatomy.ts", () => {
  it("يغطي الأسنان الدائمة الـ32 (11–48) دون أي رقم خارج النطاق", () => {
    const anatomies = toothAnatomies();
    expect(anatomies).toHaveLength(32);
    for (const anatomy of anatomies) {
      expect(anatomy.fdi).toBeGreaterThanOrEqual(11);
      expect(anatomy.fdi).toBeLessThanOrEqual(48);
      expect(anatomy.fdi % 10).toBeGreaterThanOrEqual(1);
      expect(anatomy.fdi % 10).toBeLessThanOrEqual(8);
    }
    const fdis = new Set(anatomies.map((a) => a.fdi));
    expect(fdis.size).toBe(32);
  });

  it("لكل سن من 11–48 نوعاً ومسارات صحيحة غير فارغة", () => {
    for (let q = 1; q <= 4; q += 1) {
      for (let p = 1; p <= 8; p += 1) {
        const anatomy = toothAnatomy(q * 10 + p);
        expect(anatomy).not.toBeNull();
        expect(TYPES).toContain(anatomy?.type);
        for (const path of [
          anatomy?.bodyPath,
          anatomy?.crownPath,
          anatomy?.rootPath,
        ]) {
          expect(path).toBeTruthy();
          expect(path?.startsWith("M")).toBe(true);
        }
      }
    }
  });

  it("يرفض أي رقم خارج FDI الدائم", () => {
    expect(toothAnatomy(0)).toBeNull();
    expect(toothAnatomy(10)).toBeNull();
    expect(toothAnatomy(19)).toBeNull();
    expect(toothAnatomy(50)).toBeNull();
    expect(toothAnatomy(11.5)).toBeNull();
    expect(toothAnatomy(-11)).toBeNull();
  });

  it("يحافظ على بيانات fdi.ts كما هي (مصدر الحقيقة الوحيد)", () => {
    const cells = new Map(allTeeth().map((t) => [t.fdi, t]));
    for (const anatomy of toothAnatomies()) {
      const cell = cells.get(anatomy.fdi) as ToothCell;
      expect(anatomy.quadrant).toBe(cell.quadrant);
      expect(anatomy.row).toBe(cell.row);
      expect(anatomy.positionFromMidline).toBe(cell.positionFromMidline);
      expect(anatomy.nameAr).toBe(cell.nameAr);
    }
  });

  it("الأرباع الأربعة مرتبة بعين الطبيب (الربع 1 يمين الأعلى…)", () => {
    const upper = upperRowLeftToRight();
    expect(upper).toHaveLength(16);
    expect(upper[0].fdi).toBe(18);
    expect(upper[15].fdi).toBe(28);
    expect(upper.slice(0, 8).every((t) => t.quadrant === 1)).toBe(true);
    expect(upper.slice(8).every((t) => t.quadrant === 2)).toBe(true);

    const lower = lowerRowLeftToRight();
    expect(lower).toHaveLength(16);
    expect(lower[0].fdi).toBe(48);
    expect(lower[15].fdi).toBe(38);
    expect(lower.slice(0, 8).every((t) => t.quadrant === 4)).toBe(true);
    expect(lower.slice(8).every((t) => t.quadrant === 3)).toBe(true);
  });

  it("يوزّع الأنواع الأربعة على المواضع الثمانية تشريحياً", () => {
    const expectType = (fdi: number, type: ToothType) =>
      expect(toothAnatomy(fdi)?.type).toBe(type);

    // القواطع (مركزي وجانبي) والنواب والضواحك والأضراس — في كل ربع
    for (const q of [1, 2, 3, 4]) {
      expectType(q * 10 + 1, "incisor");
      expectType(q * 10 + 2, "incisor");
      expectType(q * 10 + 3, "canine");
      expectType(q * 10 + 4, "premolar");
      expectType(q * 10 + 5, "premolar");
      expectType(q * 10 + 6, "molar");
      expectType(q * 10 + 7, "molar");
      expectType(q * 10 + 8, "molar");
    }
  });

  it("الأشكال الأربعة مختلفة فعلاً — كل نوع بمساراته الخاصة", () => {
    const [incisor, canine, premolar, molar] = [11, 13, 14, 16].map(
      (fdi) =>
        toothAnatomy(fdi) as NonNullable<ReturnType<typeof toothAnatomy>>,
    );
    const crowns = new Set(
      [incisor, canine, premolar, molar].map((a) => a.crownPath),
    );
    expect(crowns.size).toBe(4);

    // الضواحك جذران والأضراس جذور أعرض/أكثر تعقيداً من الجذر الواحد
    expect(premolar.rootPath).not.toEqual(incisor.rootPath);
    expect(molar.rootPath).not.toEqual(premolar.rootPath);
  });

  it("الأضراس العلوية بثلاثة جذور والسفلية بجذرين (أشكال مختلفة)", () => {
    const upperMolar = toothAnatomy(16) as NonNullable<
      ReturnType<typeof toothAnatomy>
    >;
    const lowerMolar = toothAnatomy(36) as NonNullable<
      ReturnType<typeof toothAnatomy>
    >;
    expect(upperMolar.rootPath).not.toBe(lowerMolar.rootPath);
    // ثلاثة جذور = ثلاث نقاط انطلاق مستقلة في المسار
    expect(upperMolar.rootPath.split("M").length - 1).toBe(3);
    expect(lowerMolar.rootPath.split("M").length - 1).toBe(2);
  });

  it("أسطح التسجيل: الحدّية للأسنان الأمامية والمضغية للخلفية", () => {
    for (const fdi of [11, 12, 13, 21, 23, 33, 43]) {
      const surfaces = toothAnatomy(fdi)?.surfaces ?? [];
      expect(surfaces).toContain("الحدّية");
      expect(surfaces).not.toContain("المضغية");
    }
    for (const fdi of [16, 14, 24, 26, 36, 45, 47]) {
      const surfaces = toothAnatomy(fdi)?.surfaces ?? [];
      expect(surfaces).toContain("المضغية");
      expect(surfaces).not.toContain("الحدّية");
    }
  });

  it("كل الأسطح المعروفة ضمن الخيارات، وأطول تركيبة مسجّلة تدخل في 50 حرفاً", () => {
    for (const anatomy of toothAnatomies()) {
      for (const surface of anatomy.surfaces) {
        expect(SURFACE_OPTIONS).toContain(surface);
      }
    }
    const longest = [...SURFACE_OPTIONS].sort((a, b) => b.length - a.length);
    // أسوأ حالة: كل الأسطح الست مختارة ومفصولة بـ «+»
    const worst = longest.join("+");
    expect(worst.length).toBeLessThanOrEqual(50);
  });
});
