import { describe, expect, it } from "vitest";
import { archPositions } from "@/lib/odontogram/arch-positions";
import {
  lowerRowLeftToRight,
  upperRowLeftToRight,
} from "@/lib/odontogram/fdi";

// مواضع القوس البيضوي للمخطط البانورامي — الدالة نقية فتُضبط نتائجها هنا:
// الترتيب، القواطع المركزية قرب خط المنتصف بأدوار متعاكسة، والأضراس عند الطرفين.

const UPPER = upperRowLeftToRight().map((tooth) => tooth.fdi);
const LOWER = lowerRowLeftToRight().map((tooth) => tooth.fdi);

const CX = 290;
const CY_UPPER = 268;
const CY_LOWER = 300;
const RX = 242;
const RY = 216;

describe("archPositions — مواضع قوس الفك البانورامي", () => {
  it("يرجع موضعاً لكل سن مُمرَّر بالترتيب نفسه", () => {
    const upper = archPositions(UPPER, CX, CY_UPPER, RX, RY, "upper");
    expect(upper).toHaveLength(16);
    expect(upper.map((p) => p.fdi)).toEqual(UPPER);

    const lower = archPositions(LOWER, CX, CY_LOWER, RX, RY, "lower");
    expect(lower).toHaveLength(16);
    expect(lower.map((p) => p.fdi)).toEqual(LOWER);

    // الفكّان معاً: الأسنان الـ32 كلها بلا تكرار
    const all = [...upper, ...lower].map((p) => p.fdi);
    expect(all).toHaveLength(32);
    expect(new Set(all).size).toBe(32);
  });

  it("القاطعان المركزيان 11 و21 الأقربان لخط المنتصف بميلان متعاكس نحوه", () => {
    const upper = archPositions(UPPER, CX, CY_UPPER, RX, RY, "upper");
    const central = upper.filter((p) => p.fdi === 11 || p.fdi === 21);

    for (const { fdi, x, rotation } of central) {
      // أقرب من أي سن آخر لخط المنتصف رأسياً (بتفاوت يلتهم تقارب الفاصلة العائمة
      // بين السنين المتناظرتين 11 و21)
      const distance = Math.abs(x - CX);
      for (const other of upper) {
        if (other.fdi === fdi) continue;
        expect(Math.abs(other.x - CX)).toBeGreaterThanOrEqual(distance - 1e-6);
      }
      // الميلان محدود (قرب القمة) ومتعاكس: 11 يمين المريض (يسار الشاشة) و21 يساره
      expect(Math.abs(rotation)).toBeLessThan(10);
    }

    const byFdi = new Map(central.map((p) => [p.fdi, p]));
    expect(byFdi.get(11)!.x).toBeLessThan(CX);
    expect(byFdi.get(21)!.x).toBeGreaterThan(CX);
    expect(byFdi.get(11)!.rotation).toBeLessThan(0);
    expect(byFdi.get(21)!.rotation).toBeGreaterThan(0);
  });

  it("ضرسا العقل 18 و48 عند طرفي القوس الأيسر بأقصى ميلان نحو الخارج", () => {
    const upper = archPositions(UPPER, CX, CY_UPPER, RX, RY, "upper");
    const lower = archPositions(LOWER, CX, CY_LOWER, RX, RY, "lower");

    const upper18 = upper.find((p) => p.fdi === 18)!;
    const lower48 = lower.find((p) => p.fdi === 48)!;

    // أقصى يسار الشاشة في كل قوس، وعلى المحيط تقريباً (rx من المركز)
    expect(upper18.x).toBe(Math.min(...upper.map((p) => p.x)));
    expect(Math.abs(upper18.x - CX)).toBeCloseTo(RX, -1);
    expect(lower48.x).toBe(Math.min(...lower.map((p) => p.x)));
    expect(Math.abs(lower48.x - CX)).toBeCloseTo(RX, -1);

    // الميلان قرب الأفقي — التاج نحو خارج القوس (يسار الشاشة = قيم سالبة)
    expect(upper18.rotation).toBeLessThan(-80);
    expect(lower48.rotation).toBeLessThan(-80);
    expect(lower48.rotation).toBeGreaterThan(-120);
  });

  it("القوس العلوي قبّة فوق مركزه والسفلي حوض تحته — بلا تقاطع رأسياً عند خط المنتصف", () => {
    const upper = archPositions(UPPER, CX, CY_UPPER, RX, RY, "upper");
    const lower = archPositions(LOWER, CX, CY_LOWER, RX, RY, "lower");

    for (const p of upper) expect(p.y).toBeLessThan(CY_UPPER);
    for (const p of lower) expect(p.y).toBeGreaterThan(CY_LOWER);

    // القاطع المركزي السفلي (41/31) أدنى من العلوي (11/21) — فراغ الإطباق محفوظ
    const upperMin = Math.max(...upper.map((p) => p.y));
    const lowerMidline = lower.filter((p) => p.fdi === 31 || p.fdi === 41);
    for (const p of lowerMidline) expect(p.y).toBeGreaterThan(upperMin);
  });

  it("الدورة قابلة للتكرار — نفس المدخلات تعطي المواضع نفسها", () => {
    const first = archPositions(UPPER, CX, CY_UPPER, RX, RY, "upper");
    const second = archPositions(UPPER, CX, CY_UPPER, RX, RY, "upper");
    expect(second).toEqual(first);
  });
});
