import { describe, expect, it } from "vitest";
import {
  DEFAULT_USD_RATE,
  dualFromUsdParts,
  displayCostPartsFromUsd,
  formatDualFromUsd,
  formatPrimaryCostFromUsd,
  formatSypAmount,
  formatSypCost,
  formatUsd,
  formatUsdCost,
  isUsdAmount,
  roundUsd2,
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

// المعيار الحي: المبلغ المخزن دولار ثابت، وتغيّر السعر يغيّر الليرة وحدها.
describe("usdToSyp — الليرة مشتقة من الدولار المخزن", () => {
  it("50$ بسعر 20000 يعرض 1,000,000 ل.س", () => {
    expect(usdToSyp(50, 20000)).toBe(1000000);
  });

  it("وبعد تحديث السعر إلى 25000 يبقى الدولار 50 وتصير الليرة 1,250,000", () => {
    const storedUsd = 50;
    expect(storedUsd).toBe(50);
    expect(usdToSyp(storedUsd, 25000)).toBe(1250000);
  });

  it("يشتق من كسور الدولار المسموحة بمنزلتين", () => {
    expect(usdToSyp(0.1, 15000)).toBe(1500);
    expect(usdToSyp(1.05, 1000)).toBe(1050);
    expect(usdToSyp(12.25, 15000)).toBe(183750);
  });

  it("يرفض سعراً غير موجب — نفس العقد الصارم", () => {
    expect(() => usdToSyp(35, 0)).toThrow(RangeError);
    expect(() => usdToSyp(35, -5)).toThrow(RangeError);
    expect(() => usdToSyp(35, Number.NaN)).toThrow(RangeError);
  });
});

// تحويل الليرة القديمة إلى الدولار — مسار هجرة البيانات ولقطات النسخ v1.
describe("sypToUsd — تحويل الهجرة واللقطات القديمة", () => {
  it("750,000 ل.س بسعر 15000 تهاجر إلى 50.00$ بالضبط", () => {
    expect(sypToUsd(750000, DEFAULT_USD_RATE)).toBe(50);
    expect(roundUsd2(sypToUsd(750000, DEFAULT_USD_RATE))).toBe(50.0);
  });

  it("يقبل كسور الدولار الناتجة عن أسعار لا تقسمها بلا باقٍ", () => {
    expect(roundUsd2(sypToUsd(750001, DEFAULT_USD_RATE))).toBe(50.0);
  });

  it("يرفض سعراً غير موجب — عقد صارم لا امتصاص صامت", () => {
    expect(() => sypToUsd(750000, 0)).toThrow(RangeError);
    expect(() => sypToUsd(750000, -5)).toThrow(RangeError);
    expect(() => sypToUsd(750000, Number.NaN)).toThrow(RangeError);
  });
});

describe("isUsdAmount — قبول الكسور بمنزلتين ورفض ما فوقها", () => {
  it("رسوم 4.50$ ودفع 12.25$ يُقبلان بلا تقريب", () => {
    expect(isUsdAmount(4.5)).toBe(true);
    expect(isUsdAmount(12.25)).toBe(true);
    expect(isUsdAmount(50)).toBe(true);
    expect(isUsdAmount(0)).toBe(true);
    expect(isUsdAmount(-36.67)).toBe(true);
  });

  it("ما فوق منزلتين وغير المنتهي يُرفض قبل الكتابة", () => {
    expect(isUsdAmount(12.255)).toBe(false);
    expect(isUsdAmount(Number.NaN)).toBe(false);
    expect(isUsdAmount(Infinity)).toBe(false);
  });
});

describe("roundUsd2", () => {
  it("يقرّب إلى دقة التخزين Decimal(12,2)", () => {
    expect(roundUsd2(12.255)).toBe(12.26);
    expect(roundUsd2(12.25)).toBe(12.25);
  });
});

describe("cost formatters", () => {
  it("تكلفة كسرية تُعرض بالدولار بمنزلتين ثابتتين لا تقريب صحيح", () => {
    expect(formatUsdCost(4.5)).toBe("$4.50");
    expect(formatUsdCost(36.67)).toBe("$36.67");
  });

  it("تكلفة صحيحة تبقى بمنسّق المبالغ العادي", () => {
    expect(formatUsdCost(50)).toBe("$50");
  });

  it("الليرة في تكلفة المادة مشتقة بالضرب بسعر العيادة", () => {
    expect(formatSypCost(usdToSyp(4.5, 15000))).toBe("67,500 ل.س");
    expect(formatSypCost(750000)).toBe("750,000 ل.س");
  });

  it("عرض التكلفة بالعملتين: الدولار المخزن أولاً والليرة مشتقة", () => {
    expect(displayCostPartsFromUsd(4.5, 15000)).toEqual({
      primary: "$4.50",
      secondary: "67,500 ل.س",
    });
    expect(formatPrimaryCostFromUsd(4.5, 15000, "USD")).toBe("$4.50");
  });
});

describe("formatDualFromUsd", () => {
  it("يولّد من الدولار المخزن: 50$ بسعر 20000 = 1,000,000 ل.س", () => {
    expect(formatDualFromUsd(50, 20000)).toBe("$50 (1,000,000 ل.س)");
  });

  it("تغيير السعر وحده يغير الليرة ويحافظ على الدولار", () => {
    expect(formatDualFromUsd(50, 25000)).toBe("$50 (1,250,000 ل.س)");
  });

  it("يحافظ على كسور الدولار في العرض", () => {
    expect(formatDualFromUsd(36.67, DEFAULT_USD_RATE)).toBe(
      "$36.67 (550,050 ل.س)",
    );
  });

  it("يتعامل مع الصفر والمبالغ السالبة بوضوح", () => {
    expect(formatDualFromUsd(0, DEFAULT_USD_RATE)).toBe("$0 (0 ل.س)");
    expect(formatDualFromUsd(-1, DEFAULT_USD_RATE)).toBe("$-1 (-15,000 ل.س)");
  });
});

describe("dualFromUsdParts", () => {
  it("يعطي العملتين كجزأين منفصلين بنفس معادلة العرض المزدوج", () => {
    expect(dualFromUsdParts(50, 20000)).toEqual({
      usd: "$50",
      syp: "1,000,000 ل.س",
    });
  });

  it("يرفض سعراً غير موجب — العقد نفسه", () => {
    expect(() => dualFromUsdParts(50, 0)).toThrow(RangeError);
  });
});
