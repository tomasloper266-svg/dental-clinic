import { describe, it, expect } from "vitest";
import {
  allTeeth,
  upperRowLeftToRight,
  lowerRowLeftToRight,
  toothQuadrant,
  toothRow,
  toothNameAr,
  isValidToothFdi,
} from "@/lib/odontogram/fdi";
import {
  TOOTH_STATUS_KEYS,
  TOOTH_STATUS_META,
  toothStatusMeta,
  findingKindLabel,
} from "@/lib/odontogram/statuses";
import {
  latestFindingByTooth,
  findingsForTooth,
} from "@/lib/odontogram/findings-view";
import { parseCreateFinding } from "@/lib/services/findings";
import {
  parseCreatePlanItem,
  parseUpdatePlanItem,
  parseResultStatus,
} from "@/lib/services/treatment-plan";

describe("ترقيم FDI", () => {
  it("يعرض الأسنان الدائمة الـ32 كاملة (11–48)", () => {
    const teeth = allTeeth();
    expect(teeth).toHaveLength(32);
    const fdis = new Set(teeth.map((t) => t.fdi));
    expect(fdis.size).toBe(32);
    for (let q = 1; q <= 4; q += 1) {
      for (let p = 1; p <= 8; p += 1) {
        expect(fdis.has(q * 10 + p)).toBe(true);
      }
    }
  });

  it("يصنف الأرباع والصفوف بشكل صحيح", () => {
    expect(toothQuadrant(16)).toBe(1);
    expect(toothQuadrant(26)).toBe(2);
    expect(toothQuadrant(36)).toBe(3);
    expect(toothQuadrant(46)).toBe(4);
    expect(toothRow(18)).toBe("upper");
    expect(toothRow(28)).toBe("upper");
    expect(toothRow(38)).toBe("lower");
    expect(toothRow(48)).toBe("lower");
  });

  it("يرفض أرقاماً خارج النطاق الدائم", () => {
    for (const bad of [10, 20, 30, 40, 50, 19.5, 0, 109, -16]) {
      expect(isValidToothFdi(bad)).toBe(false);
    }
    for (const good of [11, 18, 21, 28, 31, 38, 41, 48]) {
      expect(isValidToothFdi(good)).toBe(true);
    }
  });

  it("يرسم الصف العلوي كما يواجه الطبيب المريض: 18…11 ثم 21…28", () => {
    const row = upperRowLeftToRight();
    expect(row.map((t) => t.fdi)).toEqual([
      18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
    ]);
  });

  it("يرسم الصف السفلي: 48…41 ثم 31…38", () => {
    const row = lowerRowLeftToRight();
    expect(row.map((t) => t.fdi)).toEqual([
      48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
    ]);
  });

  it("يسمّي السن باسمه العربي وربعه", () => {
    expect(toothNameAr(11)).toContain("قاطع مركزي");
    expect(toothNameAr(48)).toContain("ضرس العقل");
    expect(toothNameAr(48)).toContain("سفلي يمين");
  });
});

describe("حالات السن وأنواع القيد", () => {
  it("كل حالة لها لون وأيقونة نصية مختلفة", () => {
    const icons = new Set(TOOTH_STATUS_KEYS.map((k) => TOOTH_STATUS_META[k].icon));
    expect(icons.size).toBe(TOOTH_STATUS_KEYS.length);
    for (const key of TOOTH_STATUS_KEYS) {
      expect(TOOTH_STATUS_META[key].labelAr.length).toBeGreaterThan(0);
      expect(TOOTH_STATUS_META[key].cellClass.length).toBeGreaterThan(0);
    }
  });

  it("toothStatusMeta يتعامل مع قيم غير معروفة بأمان", () => {
    expect(toothStatusMeta("NOT_A_STATUS")).toBeNull();
  });

  it("تسميات أنواع القيد تفصل الموجود والتشخيص والعلاج المنجز", () => {
    expect(findingKindLabel("EXISTING")).toBe("حالة موجودة");
    expect(findingKindLabel("DIAGNOSIS")).toBe("تشخيص");
    expect(findingKindLabel("TREATMENT_DONE")).toBe("علاج منفذ");
  });
});

describe("عرض سجل المشاهدات (إلحاقي)", () => {
  const base = {
    kind: "DIAGNOSIS",
    status: "DECAYED",
  };

  it("آخر مشاهدة لكل سن هي الأحدث زمنياً — والقديمة تبقى في السجل", () => {
    const findings = [
      { id: "1", toothFdi: 26, ...base, recordedAt: "2026-01-01T10:00:00Z" },
      { id: "2", toothFdi: 26, kind: "TREATMENT_DONE", status: "FILLED", recordedAt: "2026-02-01T10:00:00Z" },
      { id: "3", toothFdi: 16, ...base, recordedAt: "2026-02-02T10:00:00Z" },
    ];
    const latest = latestFindingByTooth(findings);
    expect(latest.get(26)?.id).toBe("2");
    expect(latest.get(16)?.id).toBe("3");
    // السجل الكامل لم يُمح — التخطيط لا يستبدل المشاهدة القائمة.
    expect(findings).toHaveLength(3);
    expect(findings.some((f) => f.status === "DECAYED" && f.toothFdi === 26)).toBe(true);
  });

  it("عند تساوي الزمن يفوز القيد الأحدث دخولاً بالقائمة", () => {
    const at = "2026-03-01T08:00:00Z";
    const latest = latestFindingByTooth([
      { id: "a", toothFdi: 36, ...base, recordedAt: at },
      { id: "b", toothFdi: 36, kind: "EXISTING", status: "FILLED", recordedAt: at },
    ]);
    expect(latest.get(36)?.id).toBe("b");
  });

  it("سجل السن الواحد يُرتَّب تصاعدياً بالزمن", () => {
    const history = findingsForTooth(
      [
        { id: "2", toothFdi: 47, ...base, recordedAt: "2026-02-01T10:00:00Z" },
        { id: "1", toothFdi: 47, ...base, recordedAt: "2026-01-01T10:00:00Z" },
        { id: "3", toothFdi: 36, ...base, recordedAt: "2026-01-05T10:00:00Z" },
      ],
      47,
    );
    expect(history.map((f) => f.id)).toEqual(["1", "2"]);
  });
});

describe("parseCreateFinding", () => {
  it("يقبل قيداً صحيحاً ويقصّ الملاحظة", () => {
    const r = parseCreateFinding({
      toothFdi: 26,
      kind: "DIAGNOSIS",
      status: "DECAYED",
      note: "  تسوس سطح مضغي  ",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.note).toBe("تسوس سطح مضغي");
  });

  it("يرفض رقم سن غير صالح", () => {
    expect(
      parseCreateFinding({ toothFdi: 55, kind: "EXISTING", status: "DECAYED" }).ok,
    ).toBe(false);
  });

  it("يرفض نوع قيد وحالة غير صالحين", () => {
    expect(
      parseCreateFinding({ toothFdi: 26, kind: "NOPE", status: "DECAYED" }).ok,
    ).toBe(false);
    expect(
      parseCreateFinding({ toothFdi: 26, kind: "EXISTING", status: "NOPE" }).ok,
    ).toBe(false);
  });
});

describe("التحقق النقي لخطة العلاج", () => {
  it("parseCreatePlanItem يقبل بنداً صحيحاً", () => {
    const r = parseCreatePlanItem({
      toothFdi: 36,
      procedure: "علاج جذور",
      priceUsd: 500000,
      priority: 2,
    });
    expect(r.ok).toBe(true);
  });

  it("يرفض سعراً سالباً أو غير صحيح — والكسر المسموح يقبل", () => {
    expect(
      parseCreatePlanItem({ toothFdi: 36, procedure: "حشو", priceUsd: -1 }).ok,
    ).toBe(false);
    expect(
      parseCreatePlanItem({ toothFdi: 36, procedure: "حشو", priceUsd: 12.505 }).ok,
    ).toBe(false);
    expect(
      parseCreatePlanItem({ toothFdi: 36, procedure: "حشو", priceUsd: 12.5 }).ok,
    ).toBe(true);
  });

  it("يرفض إجراءً قصيراً أو سناً غير صالحة", () => {
    expect(parseCreatePlanItem({ toothFdi: 36, procedure: "ح", priceUsd: 1 }).ok).toBe(
      false,
    );
    expect(
      parseCreatePlanItem({ toothFdi: 99, procedure: "حشو", priceUsd: 1 }).ok,
    ).toBe(false);
  });

  it("parseUpdatePlanItem يمنع تحويل الحالة إلى منفذ مباشرة", () => {
    const r = parseUpdatePlanItem({ status: "DONE" });
    expect(r.ok).toBe(false);
    expect(parseUpdatePlanItem({ status: "ACCEPTED" }).ok).toBe(true);
  });

  it("parseUpdatePlanItem يرفض الجسم الفارغ", () => {
    expect(parseUpdatePlanItem({}).ok).toBe(false);
  });

  it("parseResultStatus يقبل حالة ناتجة معقولة ويرفض السليم", () => {
    expect(parseResultStatus({ resultStatus: "FILLED" }).ok).toBe(true);
    expect(parseResultStatus({ resultStatus: "EXTRACTED" }).ok).toBe(true);
    expect(parseResultStatus({ resultStatus: "HEALTHY" }).ok).toBe(false);
    expect(parseResultStatus({ resultStatus: "JUNK" }).ok).toBe(false);
  });
});
