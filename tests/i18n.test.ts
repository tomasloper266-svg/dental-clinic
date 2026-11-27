import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  createT,
  dirOf,
  isLocale,
  parseLocaleCookie,
  translate,
} from "@/lib/i18n/core";
import { ar as arDict } from "@/lib/i18n/dictionaries/ar";
import { en as enDict } from "@/lib/i18n/dictionaries/en";

describe("parseLocaleCookie — قراءة كوكي اللغة", () => {
  it("الموجودة تُقرأ كما هي", () => {
    expect(parseLocaleCookie("ar")).toBe("ar");
    expect(parseLocaleCookie("en")).toBe("en");
  });

  it("الغائبة أو التالفة تعود للعربية", () => {
    expect(parseLocaleCookie(undefined)).toBe("ar");
    expect(parseLocaleCookie(null)).toBe("ar");
    expect(parseLocaleCookie("")).toBe("ar");
    expect(parseLocaleCookie("fr")).toBe("ar");
    expect(parseLocaleCookie("EN")).toBe("ar");
    expect(parseLocaleCookie("en; admin=true")).toBe("ar");
  });

  it("العربية هي الافتراضي المعلن", () => {
    expect(DEFAULT_LOCALE).toBe("ar");
    expect(LOCALE_COOKIE).toBe("NEXT_LOCALE");
  });
});

describe("isLocale — حرس اللغة", () => {
  it("يقبل ar وen حصراً", () => {
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("dirOf — الاتجاه حسب اللغة", () => {
  it("العربية RTL والإنجليزية LTR", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
  });
});

describe("سلسلة ارتداد الترجمة", () => {
  it("الإنجليزية بمفتاح موجود تعرض الإنجليزية", () => {
    expect(translate("en", "common.save")).toBe("Save");
    expect(translate("en", "nav.patients")).toBe("Patients");
  });

  it("الإنجليزية بمفتاح غائب ترتد إلى العربية", () => {
    // مفتاح موجود في العربية وحدها — محاكاة الترحيل التدريجي
    const enOnly = enDict as Record<string, string | undefined>;
    const missingKey = Object.keys(arDict).find(
      (key) => enOnly[key] === undefined,
    );
    if (missingKey) {
      expect(translate("en", missingKey as never)).toBe(
        arDict[missingKey as never],
      );
    }
    // والقاموس الإنجليزي الحالي كامل — فنحذف مفتاحاً افتراضياً للتحقق المباشر
    const saved = enDict["common.close"];
    delete enDict["common.close"];
    try {
      expect(translate("en", "common.close")).toBe(arDict["common.close"]);
    } finally {
      enDict["common.close"] = saved;
    }
  });

  it("الغائب من القاموسين معاً يعرض اسم المفتاح نفسه", () => {
    const savedAr = arDict["common.close"] as string | undefined;
    delete (arDict as Record<string, string | undefined>)["common.close"];
    delete enDict["common.close"];
    try {
      expect(translate("en", "common.close")).toBe("common.close");
      expect(translate("ar", "common.close")).toBe("common.close");
    } finally {
      (arDict as Record<string, string | undefined>)["common.close"] = savedAr;
      enDict["common.close"] = savedAr as string;
    }
  });

  it("العربية تُترجم من قاموسها مباشرة", () => {
    expect(translate("ar", "common.save")).toBe("حفظ");
    expect(translate("ar", "nav.home")).toBe("الرئيسية");
  });
});

describe("createT — المترجم المربوط", () => {
  it("يربط اللغة مرة واحدة ويستوفي الوسائط", () => {
    const tAr = createT("ar");
    expect(tAr("common.save")).toBe("حفظ");
    const tEn = createT("en");
    expect(tEn("common.save")).toBe("Save");
  });

  it("يستوفي مواضع {name} بالقيم الممررة", () => {
    const saved = arDict["common.loading"];
    (arDict as Record<string, string>)["common.loading"] =
      "جارٍ تحميل {count} سجل";
    try {
      const t = createT("ar");
      expect(t("common.loading", { count: 7 })).toBe("جارٍ تحميل 7 سجل");
      // موضع بلا قيمة يبقى كما هو — لا يُمتص بصمت
      expect(t("common.loading")).toBe("جارٍ تحميل {count} سجل");
    } finally {
      (arDict as Record<string, string>)["common.loading"] = saved;
    }
  });
});

describe("القواميس — عقد التغطية", () => {
  it("كل مفتاح إنجليزي له مقابل عربي", () => {
    for (const key of Object.keys(enDict)) {
      expect(key in arDict, `المفتاح ${key} غائب عن القاموس العربي`).toBe(true);
    }
  });

  it("القاموس الإنجليزي لا يحتوي قيماً فارغة", () => {
    for (const value of Object.values(enDict)) {
      expect(typeof value === "string" && value.length > 0).toBe(true);
    }
  });
});
