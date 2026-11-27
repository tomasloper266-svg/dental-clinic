import { describe, expect, it } from "vitest";

import {
  OTHER_SURFACE,
  SURFACE_CODES,
  allowedSurfaceCodesForTooth,
  formatSurfaceAr,
  normalizeLegacySurfaces,
  parseSurfaceInput,
} from "@/lib/odontogram/surfaces";
import { parseCreateFinding } from "@/lib/services/findings";
import { parseCreatePlanItem } from "@/lib/services/treatment-plan";
import { parseCreateLedgerEntry } from "@/lib/services/ledger";

// اختبارات الترميز المرجعي للأسطح — نقية بلا قاعدة بيانات.
// القاعدة: كل قيمة سطح تُخزن بأكواد مجمّعة بعلامة «+» (مثال O+M)، وأي قيمة
// قديمة تُطبَّع عبر نفس الخريطة، وأي شيء خارج تشريح السن يُرفض.

describe("SURFACE_CODES — الترميز المرجعي", () => {
  it("كل كود حرف واحد والكتالوج الستة كاملاً", () => {
    expect(Object.values(SURFACE_CODES)).toEqual([
      "O",
      "I",
      "M",
      "D",
      "B",
      "L",
    ]);
  });

  it("أسطح النوع التشريحي: الضرس بالمضغية والقاطع بلاها", () => {
    expect(allowedSurfaceCodesForTooth(36)).toContain("O");
    expect(allowedSurfaceCodesForTooth(11)).not.toContain("O");
    expect(allowedSurfaceCodesForTooth(11)).toContain("I");
  });
});

describe("normalizeLegacySurfaces — هجرة القيم القديمة", () => {
  it("قيم مجمعة عربية تتحول لأكواد: «المضغية+القريبة» → O+M", () => {
    const norm = normalizeLegacySurfaces("المضغية+القريبة");
    expect(norm.codes).toEqual(["O", "M"]);
    expect(norm.legacyText).toBeNull();
  });

  it("قيمة مفردة عربية: «الحدّية» → I", () => {
    expect(normalizeLegacySurfaces("الحدّية").codes).toEqual(["I"]);
  });

  it("الرموز نفسها تمر كما هي", () => {
    expect(normalizeLegacySurfaces("O+M").codes).toEqual(["O", "M"]);
  });

  it("فراغات حول العلامة والرموز الزائدة تُلغى", () => {
    expect(
      normalizeLegacySurfaces(" المضغية + المضغية + القريبة ").codes,
    ).toEqual(["O", "M"]);
  });

  it("نص غير مطابق يصبح OTHER مع حفظ النص الأصلي — لا فقدان بيانات", () => {
    const norm = normalizeLegacySurfaces("المضغية+حشو خارجي");
    expect(norm.codes).toEqual(["O", OTHER_SURFACE]);
    expect(norm.legacyText).toBe("المضغية+حشو خارجي");
  });

  it("نص حر كلياً يصبح OTHER وحيداً", () => {
    const norm = normalizeLegacySurfaces("سطح غير معروف");
    expect(norm.codes).toEqual([OTHER_SURFACE]);
    expect(norm.legacyText).toBe("سطح غير معروف");
  });

  it("الرموز الفارغة حول العلامة تُتجاهل", () => {
    expect(normalizeLegacySurfaces("O++M+").codes).toEqual(["O", "M"]);
  });
});

describe("parseSurfaceInput — تحقق الكتابة الجديدة", () => {
  it("يقبل الأكواد والأسماء العربية معاً ويوحد الصيغة", () => {
    expect(parseSurfaceInput("O+M", 36)).toEqual({ ok: true, value: "O+M" });
    expect(parseSurfaceInput("المضغية+القريبة", 36)).toEqual({
      ok: true,
      value: "O+M",
    });
  });

  it("يرفض سطحاً غير تشريحي للنوع: المضغية على قاطع", () => {
    const r = parseSurfaceInput("O", 11);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("غير تابع");
  });

  it("يقبل الحدّية على القاطع", () => {
    expect(parseSurfaceInput("I", 11).ok).toBe(true);
  });

  it("يرفض نصاً غير معروف — الكتابة الجديدة لا تقبل OTHER", () => {
    expect(parseSurfaceInput("حشو خارجي", 36).ok).toBe(false);
    expect(parseSurfaceInput("OTHER", 36).ok).toBe(false);
  });

  it("بلا سن مرافق: تحقق الشكل فقط", () => {
    expect(parseSurfaceInput("المضغية").ok).toBe(true);
    expect(parseSurfaceInput("نص غريب").ok).toBe(false);
  });
});

describe("parseCreateFinding — السطح المرجعي", () => {
  it("يطبّع الأسماء العربية القادمة من الواجهة القديمة", () => {
    const r = parseCreateFinding({
      toothFdi: 26,
      kind: "DIAGNOSIS",
      status: "DECAYED",
      surface: "المضغية+القريبة",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.surface).toBe("O+M");
  });

  it("يرفض سطحاً غير تشريحي لنوع السن (قاطع بلا المضغية)", () => {
    const r = parseCreateFinding({
      toothFdi: 11,
      kind: "EXISTING",
      status: "DECAYED",
      surface: "O",
    });
    expect(r.ok).toBe(false);
  });
});

describe("parseCreatePlanItem — سطح بند الخطة", () => {
  it("يقبل سطحاً مرجعياً مع سن صالح", () => {
    const r = parseCreatePlanItem({
      toothFdi: 36,
      procedure: "حشو ضوئي",
      priceUsd: 25,
      surface: "المضغية",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.surface).toBe("O");
  });

  it("يرفض سطحاً على بند بلا سن (0)", () => {
    const r = parseCreatePlanItem({
      toothFdi: 0,
      procedure: "حشو ضوئي",
      priceUsd: 25,
      surface: "O",
    });
    expect(r.ok).toBe(false);
  });

  it("يرفض سطحاً غير تشريحي", () => {
    const r = parseCreatePlanItem({
      toothFdi: 11,
      procedure: "حشو ضوئي",
      priceUsd: 25,
      surface: "O",
    });
    expect(r.ok).toBe(false);
  });
});

describe("parseCreateLedgerEntry — إشارة السن/السطح على البنود", () => {
  it("يقبل بنوداً بسن وسطح مرجعيين ويطبّعهما", () => {
    const r = parseCreateLedgerEntry({
      type: "CHARGE",
      amountUsd: 30,
      items: [
        {
          description: "حشو ضوئي",
          amountUsd: 30,
          toothFdi: 36,
          surface: "المضغية+القريبة",
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.items?.[0].toothFdi).toBe(36);
      expect(r.value.items?.[0].surface).toBe("O+M");
    }
  });

  it("يرفض فدى بترقيم غير صالح أو سطحاً غير تشريحي للسن المرافق", () => {
    const badTooth = parseCreateLedgerEntry({
      type: "CHARGE",
      amountUsd: 30,
      items: [{ description: "x", amountUsd: 30, toothFdi: 99 }],
    });
    expect(badTooth.ok).toBe(false);

    const badSurface = parseCreateLedgerEntry({
      type: "CHARGE",
      amountUsd: 30,
      items: [{ description: "x", amountUsd: 30, toothFdi: 11, surface: "O" }],
    });
    expect(badSurface.ok).toBe(false);
  });

  it("category يبقى نظيفاً كما أُدخل — السطح لا يلوثه", () => {
    const r = parseCreateLedgerEntry({
      type: "CHARGE",
      amountUsd: 30,
      items: [
        {
          description: "حشو ضوئي",
          category: "حشو ضوئي",
          amountUsd: 30,
          surface: "O",
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.items?.[0].category).toBe("حشو ضوئي");
      expect(r.value.items?.[0].toothFdi).toBeUndefined();
    }
  });
});

describe("formatSurfaceAr — العرض العربي", () => {
  it("«O+M» → «المضغية+القريبة» وOTHER → «أخرى»", () => {
    expect(formatSurfaceAr("O+M")).toBe("المضغية+القريبة");
    expect(formatSurfaceAr(OTHER_SURFACE)).toBe("أخرى");
  });
});
