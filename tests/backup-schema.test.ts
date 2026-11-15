import { describe, expect, it } from "vitest";
import {
  LEGACY_SNAPSHOT_VERSION,
  SNAPSHOT_VERSION,
  convertLegacySnapshotSurfaces,
  convertLegacySnapshotToUsd,
  validateSnapshot,
  type ClinicSnapshot,
} from "@/lib/backup-schema";

// اختبارات عقد النسخة الاحتياطية — تحويل لقطة قديمة (v1، ليرة) إلى v2 (دولار)
// نقية بلا قاعدة بيانات. نفس معادلة هجرة القاعدة: usd = round(syp / rate).

function legacySnapshot(): ClinicSnapshot {
  return {
    version: LEGACY_SNAPSHOT_VERSION,
    createdAt: "2026-11-01T00:00:00.000Z",
    clinic: {
      name: "عيادة الاختبار",
      currency: "USD",
      usdRate: 15000,
      logoLetter: "س",
      openingBalance: 750_000,
      workStart: "09:00",
      workEnd: "17:00",
    },
    patients: [{ id: "p1" }],
    staffMembers: [],
    appointments: [],
    waitlistEntries: [],
    appointmentStatusChanges: [],
    toothFindings: [
      { id: "tf1", surface: "المضغية+القريبة", note: null },
    ],
    periodontalReadings: [],
    treatmentPlans: [],
    treatmentPlanItems: [{ id: "tpi1", priceSyp: 120_000 }],
    ledgerEntries: [
      { id: "le1", amountSyp: 750_000 },
      { id: "le2", amountSyp: -12_250 },
    ],
    ledgerEntryItems: [{ id: "lei1", amountSyp: 67_500 }],
    expenses: [{ id: "ex1", amountSyp: 15_000 }],
    materials: [
      { id: "m1", costSyp: 67_500 },
      { id: "m2", costSyp: null },
    ],
    materialMovements: [],
    materialUsages: [],
    instructionTemplates: [],
    instructionSends: [],
    appointmentReminders: [],
  } as unknown as ClinicSnapshot;
}

describe("convertLegacySnapshotToUsd", () => {
  it("750,000 ل.س بسعر 15000 تتحول إلى 50.00$ بالضبط", () => {
    const result = convertLegacySnapshotToUsd(legacySnapshot());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = result.snapshot.ledgerEntries[0] as Record<string, unknown>;
    expect(entry.amountUsd).toBe(50);
    expect(entry.amountSyp).toBeUndefined();
    expect(result.snapshot.version).toBe(SNAPSHOT_VERSION);
  });

  it("يحول كل أعمدة المبالغ ويحافظ على الفراغ (تكلفة المادة)", () => {
    const result = convertLegacySnapshotToUsd(legacySnapshot());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.clinic.openingBalance).toBe(50);
    expect(result.snapshot.ledgerEntryItems[0]).toMatchObject({ amountUsd: 4.5 });
    expect(result.snapshot.expenses[0]).toMatchObject({ amountUsd: 1 });
    expect(result.snapshot.treatmentPlanItems[0]).toMatchObject({ priceUsd: 8 });
    const materials = result.snapshot.materials as Record<string, unknown>[];
    expect(materials[0]).toMatchObject({ costUsd: 4.5 });
    expect(materials[1].costUsd).toBeUndefined();
    expect(materials[1].costSyp).toBeUndefined();
  });

  it("الدفعة السالبة تبقى سالبة بالدولار (-12,250 بسعر 15000)", () => {
    const result = convertLegacySnapshotToUsd(legacySnapshot());
    if (!result.ok) return;
    expect(result.snapshot.ledgerEntries[1]).toMatchObject({ amountUsd: -0.82 });
  });

  it("سعر صرف تالف في اللقطة يُفشل التحويل كله — لا خلط وحدتين", () => {
    const bad = legacySnapshot();
    bad.clinic.usdRate = 0;
    expect(convertLegacySnapshotToUsd(bad).ok).toBe(false);

    const negative = legacySnapshot();
    negative.clinic.usdRate = -5;
    expect(convertLegacySnapshotToUsd(negative).ok).toBe(false);
  });

  it("مبلغ تالف في جدول يُفشل التحويل برسالة تحمل الجدول", () => {
    const bad = legacySnapshot();
    (bad.ledgerEntries[0] as Record<string, unknown>).amountSyp = "وليست رقماً";
    const result = convertLegacySnapshotToUsd(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("ledgerEntries");
  });
});

describe("validateSnapshot", () => {
  it("يقبل v1 وv2 معاً", () => {
    expect(validateSnapshot(legacySnapshot()).ok).toBe(true);
    const current = { ...legacySnapshot(), version: SNAPSHOT_VERSION };
    expect(validateSnapshot(current).ok).toBe(true);
  });

  it("يرفض إصداراً غير مدعوم", () => {
    const future = { ...legacySnapshot(), version: 3 };
    expect(validateSnapshot(future).ok).toBe(false);
  });

  it("نسخة بلا مفتاح بنود الفواتير تعامَل بقائمة فارغة", () => {
    const partial = legacySnapshot() as unknown as Record<string, unknown>;
    delete partial.ledgerEntryItems;
    const check = validateSnapshot(partial);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.snapshot.ledgerEntryItems).toEqual([]);
  });

  it("نسخة بلا مفتاح قراءات الدواعم (أقدم من العقد) تعامَل بقائمة فارغة", () => {
    const partial = legacySnapshot() as unknown as Record<string, unknown>;
    delete partial.periodontalReadings;
    const check = validateSnapshot(partial);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.snapshot.periodontalReadings).toEqual([]);
  });
});

describe("convertLegacySnapshotSurfaces — هجرة ترميز الأسطر في اللقطة", () => {
  it("القيم العربية المجمعة تتحول لأكواد عبر هجرة الاستعادة", () => {
    const result = convertLegacySnapshotSurfaces(legacySnapshot());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const finding = result.snapshot.toothFindings[0] as Record<string, unknown>;
    expect(finding.surface).toBe("O+M");
  });

  it("نص حر لا يطابق الكتالوج يصبح OTHER ويُحفظ أصله في الملاحظة", () => {
    const snapshot = legacySnapshot();
    (snapshot.toothFindings[0] as Record<string, unknown>).surface =
      "المضغية+حشو خارجي";
    (snapshot.toothFindings[0] as Record<string, unknown>).note = "ملاحظة قديمة";
    const result = convertLegacySnapshotSurfaces(snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const finding = result.snapshot.toothFindings[0] as Record<string, unknown>;
    expect(finding.surface).toBe("O+OTHER");
    expect(finding.note).toBe("ملاحظة قديمة | السطح القديم: المضغية+حشو خارجي");
  });

  it("قيمة surface غائبة أو فارغة تعبر كما هي", () => {
    const snapshot = legacySnapshot();
    (snapshot.toothFindings[0] as Record<string, unknown>).surface = null;
    const result = convertLegacySnapshotSurfaces(snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const finding = result.snapshot.toothFindings[0] as Record<string, unknown>;
    expect(finding.surface).toBeNull();
  });

  it("اللقطة المحولة تمر كاملة عبر الاستعادة: validate ثم الأسطح ثم المبالغ", () => {
    // نفس تسلسل restoreSnapshot — الأسطح قبل تحويل المبالغ وبلا تعارض بينهما.
    const check = validateSnapshot(legacySnapshot());
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    const surfaced = convertLegacySnapshotSurfaces(check.snapshot);
    expect(surfaced.ok).toBe(true);
    if (!surfaced.ok) return;
    const money = convertLegacySnapshotToUsd(surfaced.snapshot);
    expect(money.ok).toBe(true);
    if (!money.ok) return;
    const finding = money.snapshot.toothFindings[0] as Record<string, unknown>;
    expect(finding.surface).toBe("O+M");
    expect(money.snapshot.version).toBe(SNAPSHOT_VERSION);
  });
});
