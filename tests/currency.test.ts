import { describe, expect, it } from "vitest";
import {
  DEFAULT_USD_RATE,
  dualFromSypParts,
  displayCostPartsFromSyp,
  formatDualFromSyp,
  formatPrimaryCostFromSyp,
  formatSypAmount,
  formatSypCost,
  formatUsd,
  formatUsdCost,
  sypToUsd,
  usdToSyp,
} from "@/lib/currency";

describe("formatUsd", () => {
  it("يعرض عدداً صحيحاً بلا كسور", () => {
    expect(formatUsd(50)).toBe("$50");
  });

  it("يحافظ على كسورتين كحد أقصى ويحذف الأصفار الزائدة", () => {
    expect(formatUsd(36.67)).toBe("$36.67");
    expect(formatUsd(36.5)).toBe("$36.5");
    expect(formatUsd(36.004)).toBe("$36");
  });

  it("يفصل الآلاف بفواصل لاتينية", () => {
    expect(formatUsd(1250)).toBe("$1,250");
  });
});

describe("formatSypAmount", () => {
  it("يقرّب لأقرب ليرة ويفصل الآلاف", () => {
    expect(formatSypAmount(750000)).toBe("750,000 ل.س");
    expect(formatSypAmount(1234.6)).toBe("1,235 ل.س");
  });
});

describe("usdToSyp", () => {
  it("يحوّل من الدولار إلى الليرة مقرّباً لأقرب ليرة صحيحة", () => {
    expect(usdToSyp(35, 15000)).toBe(525000);
    expect(usdToSyp(0.1, 15000)).toBe(1500);
    expect(usdToSyp(1.05, 1000)).toBe(1050);
  });

  it("يرفض سعراً غير موجب — نفس العقد الصارم", () => {
    expect(() => usdToSyp(35, 0)).toThrow(RangeError);
    expect(() => usdToSyp(35, -5)).toThrow(RangeError);
    expect(() => usdToSyp(35, Number.NaN)).toThrow(RangeError);
  });
});

describe("sypToUsd", () => {
  it("يقسم على سعر الصرف", () => {
    expect(sypToUsd(750000, DEFAULT_USD_RATE)).toBeCloseTo(50);
  });

  it("يرفض سعراً غير موجب — عقد صارم لا امتصاص صامت", () => {
    expect(() => sypToUsd(750000, 0)).toThrow(RangeError);
    expect(() => sypToUsd(750000, -5)).toThrow(RangeError);
    expect(() => sypToUsd(750000, Number.NaN)).toThrow(RangeError);
  });
});

describe("cost formatters", () => {
  it("تكلفة كسرية تُعرض بمنزلتين ثابتتين لا تقريب صحيح", () => {
    expect(formatSypCost(4.5)).toBe("4.50 ل.س");
    expect(formatUsdCost(4.5)).toBe("$4.50");
    expect(formatUsdCost(36.67)).toBe("$36.67");
  });

  it("تكلفة صحيحة تبقى بمنسّق المبالغ العادي", () => {
    expect(formatSypCost(750000)).toBe("750,000 ل.س");
    expect(formatUsdCost(50)).toBe("$50");
  });

  it("عرض التكلفة بالعملتين يحافظ على العشريات", () => {
    expect(displayCostPartsFromSyp(67500, 15000)).toEqual({
      primary: "$4.50",
      secondary: "67,500 ل.س",
    });
    expect(formatPrimaryCostFromSyp(67500, 15000, "USD")).toBe("$4.50");
  });
});

describe("formatDualFromSyp", () => {
  it("يعرض العملتين معاً على شكل المرجع", () => {
    expect(formatDualFromSyp(750000, DEFAULT_USD_RATE)).toBe(
      "$50 (750,000 ل.س)",
    );
  });

  it("يقرّب الدولار لكسرتين ويبقي الليرة صحيحة", () => {
    expect(formatDualFromSyp(550000, DEFAULT_USD_RATE)).toBe(
      "$36.67 (550,000 ل.س)",
    );
  });

  it("يتعامل مع الصفر والمبالغ السالبة بوضوح", () => {
    expect(formatDualFromSyp(0, DEFAULT_USD_RATE)).toBe("$0 (0 ل.س)");
    expect(formatDualFromSyp(-15000, DEFAULT_USD_RATE)).toBe(
      "$-1 (-15,000 ل.س)",
    );
  });
});

describe("dualFromSypParts", () => {
  it("يعطي العملتين كجزأين منفصلين بنفس معادلة العرض المزدوج", () => {
    expect(dualFromSypParts(750000, DEFAULT_USD_RATE)).toEqual({
      usd: "$50",
      syp: "750,000 ل.س",
    });
  });

  it("يرفض سعراً غير موجب — العقد نفسه", () => {
    expect(() => dualFromSypParts(750000, 0)).toThrow(RangeError);
  });
});
