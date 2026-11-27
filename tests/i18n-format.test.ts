import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatNumber } from "@/lib/i18n/format";

// 9 نوفمبر 2026 منتصف الظهر UTC — نفس عينة تواريخ بقية الاختبارات
const SAMPLE = "2026-11-09T12:00:00Z";

describe("formatDate — التاريخ حسب اللغة", () => {
  it("العربية على نمط سوريا بأرقام لاتينية — مثل صيغة خلايا اليوم", () => {
    // ar-SY يدرج علامة اتجاه U+200F بعد كل مجموعة — قاعدة Intl نفسها
    expect(formatDate(SAMPLE, "ar")).toBe("09\u200f/11\u200f/2026");
  });

  it("الإنجليزية على نمط en", () => {
    expect(formatDate(SAMPLE, "en")).toBe("11/09/2026");
  });

  it("الخيارات تُمرَّر كما هي — شهر طويل وحدود منطقة زمنية", () => {
    const long = formatDate(SAMPLE, "ar", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Damascus",
    });
    // تسمية ar-SY لشهر نوفمبر — أسماء الشهور الشامية لا نوفمبر اللاتينية
    expect(long).toBe("9 تشرين الثاني 2026");
  });

  it("المنطقة الزمنية للعيادة تُحترم عبر خيار timeZone", () => {
    // منتصف ليل UTC = فجر دمشق من اليوم نفسه — بصيغة الخلية القصيرة نفسها
    expect(
      formatDate("2026-11-09T00:30:00Z", "ar", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Asia/Damascus",
      }),
    ).toBe("09\u200f/11\u200f/2026");
  });
});

describe("formatNumber — العدد حسب اللغة", () => {
  it("العربية بأرقام لاتينية وفاصل آلاف لاتيني — مطابق للحالي", () => {
    expect(formatNumber(1250, "ar")).toBe("1,250");
    expect(formatNumber(1000000, "ar")).toBe("1,000,000");
  });

  it("الإنجليزية بنفس التجميع اللاتيني", () => {
    expect(formatNumber(1250.5, "en")).toBe("1,250.5");
  });

  it("خيارات Intl تُمرَّر — كسور ثابتة", () => {
    expect(formatNumber(4.5, "ar", { minimumFractionDigits: 2 })).toBe("4.50");
  });
});

describe("formatCurrency — العملة المزدوجة", () => {
  it("الدولار بادئ بـ $ والكسور بمنزلتين كحد أقصى — مطابق لـ formatUsd", () => {
    expect(formatCurrency(50, "ar")).toBe("$50");
    expect(formatCurrency(36.67, "ar")).toBe("$36.67");
    expect(formatCurrency(1250, "en")).toBe("$1,250");
  });

  it("الليرة لاحقة بـ ل.س ومقرّبة لعدد صحيح — مطابق لـ formatSypAmount", () => {
    expect(formatCurrency(1000000, "ar", "SYP")).toBe("1,000,000 ل.س");
    expect(formatCurrency(1234.6, "ar", "SYP")).toBe("1,235 ل.س");
  });

  it("العربية والإنجليزية تتباعدان في التجميع إذا اختلفت لغة العرض — والرموز ثابتة", () => {
    // الرمز $ بادئ في اللغتين، والفرق في الأرقام وحدها حسب لغة Intl
    expect(formatCurrency(1000000, "en", "SYP").endsWith("ل.س")).toBe(true);
    expect(formatCurrency(1000000, "en", "SYP").startsWith("1,000,000")).toBe(
      true,
    );
  });
});
