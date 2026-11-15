// تحقق نقّي من ملف النسخة الاحتياطية — بلا I/O ولا قاعدة بيانات.
// الاستعادة ترفض أي ملف لا يطابق هذا العقد قبل لمس البيانات.

import { normalizeLegacySurfaces } from "@/lib/odontogram/surfaces";

/** نسخة العقد الحالية — v2: كل المبالغ بالدولار بمنزلتين (وحدة التخزين) */
export const SNAPSHOT_VERSION = 2;

/** نسخة ما قبل قلب الأساس — v1: كل المبالغ بالليرة السورية الصحيحة */
export const LEGACY_SNAPSHOT_VERSION = 1;

/** الإصدارات المدعومة للاستعادة — القديمة تُحوَّل للدولار بسعرها المحفوظ */
const SUPPORTED_VERSIONS = [LEGACY_SNAPSHOT_VERSION, SNAPSHOT_VERSION];

/** الجداول التشغيلية المشمولة — بترتيب آمن لإعادة الإنشاء (المرجع قبل المُحال) */
export const SNAPSHOT_TABLES = [
  "patients",
  "staffMembers",
  "appointments",
  "waitlistEntries",
  "appointmentStatusChanges",
  "toothFindings",
  // قراءات الدواعم — أُضيفت للعقد لاحقاً؛ اللقطات الأقدم بلا المفتاح تُعامَل
  // بقائمة فارغة في validateSnapshot (لا قراءات سابقة فلا شيء يُعاد).
  "periodontalReadings",
  "treatmentPlans",
  "treatmentPlanItems",
  "ledgerEntries",
  // بنود الفاتورة المهيكلة — تابعة لقيود الرسوم (بلا عمود clinicId؛ العزل
  // موروث من قيد الأب). بعد ledgerEntries كي تُحذف أولاً وتُضاف بعد أبيها.
  "ledgerEntryItems",
  "expenses",
  "materials",
  "materialMovements",
  "materialUsages",
  "instructionTemplates",
  "instructionSends",
  "appointmentReminders",
] as const;

export type SnapshotTable = (typeof SNAPSHOT_TABLES)[number];

export type ClinicSnapshot = {
  version: number;
  createdAt: string;
  clinic: {
    name: string;
    currency: string;
    usdRate: number;
    logoLetter: string;
    openingBalance: number;
    workStart: string;
    workEnd: string;
  };
} & Record<SnapshotTable, Record<string, unknown>[]>;

export type SnapshotCheck =
  | { ok: true; snapshot: ClinicSnapshot }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** جداول أُضيفت للعقد لاحقاً — غيابها في لقطة قديمة يعني قائمة فارغة */
const OPTIONAL_SNAPSHOT_TABLES: ReadonlySet<SnapshotTable> = new Set([
  "ledgerEntryItems",
  "periodontalReadings",
] as SnapshotTable[]);

/**
 * أعمدة المبالغ بحسب الجدول في لقطات v1 (ليرة) — الاسم يُستبدل لاحقة Syp
 * بـ Usd عند التحويل. Materials.costSyp وحده nullable؛ البقية إلزامية.
 */
const LEGACY_MONEY_FIELDS: Record<SnapshotTable, readonly string[]> = {
  patients: [],
  staffMembers: [],
  appointments: [],
  waitlistEntries: [],
  appointmentStatusChanges: [],
  toothFindings: [],
  periodontalReadings: [],
  treatmentPlans: [],
  treatmentPlanItems: ["priceSyp"],
  ledgerEntries: ["amountSyp"],
  ledgerEntryItems: ["amountSyp"],
  expenses: ["amountSyp"],
  materials: ["costSyp"],
  materialMovements: [],
  materialUsages: [],
  instructionTemplates: [],
  instructionSends: [],
  appointmentReminders: [],
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * نقّي — تحويل لقطة قديمة (v1، ليرة سورية) إلى عقد v2 (دولار): كل مبلغ
 * يُقسم على سعر العيادة المحفوظ في اللقطة نفسه — نفس معادلة هجرة قاعدة
 * البيانات، فتظهر الأرقام الدولارية كما كانت تُعرض لحظة أخذ اللقطة.
 * فشل تحويل أي مبلغ إلزامي يُفشل التحويل كله — لا خلط وحدتين في عمود واحد.
 */
export function convertLegacySnapshotToUsd(
  snapshot: ClinicSnapshot,
): { ok: true; snapshot: ClinicSnapshot } | { ok: false; error: string } {
  const rate = snapshot.clinic.usdRate;
  if (!Number.isFinite(rate) || rate <= 0) {
    return { ok: false, error: "سعر الصرف في اللقطة غير صالح — لا يمكن تحويل المبالغ" };
  }

  const openingBalance = snapshot.clinic.openingBalance;
  if (typeof openingBalance !== "number" || !Number.isFinite(openingBalance)) {
    return { ok: false, error: "الرصيد الافتتاحي في اللقطة تالف — لا يمكن تحويل المبالغ" };
  }

  const convertedTables: Partial<Record<SnapshotTable, Record<string, unknown>[]>> = {};
  for (const table of SNAPSHOT_TABLES) {
    const fields = LEGACY_MONEY_FIELDS[table];
    if (fields.length === 0) {
      convertedTables[table] = snapshot[table];
      continue;
    }
    const rows: Record<string, unknown>[] = [];
    for (const row of snapshot[table]) {
      const converted = { ...row };
      for (const field of fields) {
        const legacy = converted[field];
        if (legacy === null || legacy === undefined) {
          // الوحيد nullable بينها تكلفة المادة — يبقى فارغاً باسمه الجديد.
          delete converted[field];
          continue;
        }
        const value = Number(legacy);
        if (!Number.isFinite(value)) {
          return {
            ok: false,
            error: `مبلغ تالف في «${table}» (${field}) — أعد إنشاء نسخة احتياطية سليمة`,
          };
        }
        delete converted[field];
        converted[field.replace(/Syp$/, "Usd")] = round2(value / rate);
      }
      rows.push(converted);
    }
    convertedTables[table] = rows;
  }

  return {
    ok: true,
    snapshot: {
      ...snapshot,
      version: SNAPSHOT_VERSION,
      clinic: {
        ...snapshot.clinic,
        openingBalance: round2(openingBalance / rate),
      },
      ...convertedTables,
    },
  };
}

/**
 * نقّي — هجرة ترميز الأسطح في اللقطة (نفس هجرة قاعدة البيانات): قيم
 * toothFindings.surface العربية القديمة (المجمّعة بعلامة «+») تتحول إلى الأكواد
 * المرجعية، وأي نص لا يطابق الكتالوج يصبح OTHER ويُحفظ أصله في الملاحظة —
 * لا فقدان بيانات إطلاقاً. تُطبَّق على لقطات v1 وv2 معاً (لقطة v2 سابقة على
 * هذا النشر قد تحمل قيماً عربية أيضاً).
 */
export function convertLegacySnapshotSurfaces(
  snapshot: ClinicSnapshot,
): { ok: true; snapshot: ClinicSnapshot } | { ok: false; error: string } {
  const rows: Record<string, unknown>[] = [];
  for (const row of snapshot.toothFindings) {
    const surface = row.surface;
    if (typeof surface !== "string" || !surface.trim()) {
      rows.push(row);
      continue;
    }
    const normalized = normalizeLegacySurfaces(surface);
    if (normalized.legacyText === null) {
      rows.push({ ...row, surface: normalized.codes.join("+") });
      continue;
    }
    const legacyNote = `السطح القديم: ${normalized.legacyText}`;
    rows.push({
      ...row,
      surface: normalized.codes.join("+"),
      note:
        typeof row.note === "string" && row.note.trim()
          ? `${row.note} | ${legacyNote}`
          : legacyNote,
    });
  }
  return { ok: true, snapshot: { ...snapshot, toothFindings: rows } };
}

/** نقّي — فحص شكل ملف النسخة: العقد والجداول وكل صف يحمل معرّفاً */
export function validateSnapshot(input: unknown): SnapshotCheck {
  if (!isRecord(input)) {
    return { ok: false, error: "الملف ليس نسخة احتياطية صالحة" };
  }
  if (typeof input.version !== "number" || !SUPPORTED_VERSIONS.includes(input.version)) {
    return { ok: false, error: "إصدار النسخة الاحتياطية غير مدعوم" };
  }
  if (!isRecord(input.clinic) || typeof input.clinic.name !== "string" || typeof input.clinic.usdRate !== "number") {
    return { ok: false, error: "بيانات العيادة ناقصة في الملف" };
  }
  const tables = {} as Record<SnapshotTable, Record<string, unknown>[]>;
  for (const table of SNAPSHOT_TABLES) {
    // جداول أُضيفت للعقد لاحقاً — النسخ الأقدم بلا هذا المفتاح تُعامَل بقائمة
    // فارغة كي تبقى قابلة للاستعادة (بنود الفاتورة قبلها، وقراءات الدواعم الآن).
    const fallback = OPTIONAL_SNAPSHOT_TABLES.has(table) ? [] : undefined;
    const rows = input[table] ?? fallback;
    if (!Array.isArray(rows)) {
      return { ok: false, error: `جدول «${table}» ناقص أو تالف في الملف` };
    }
    for (const row of rows) {
      if (!isRecord(row) || typeof row.id !== "string" || row.id === "") {
        return { ok: false, error: `صف تالف في جدول «${table}»` };
      }
    }
    tables[table] = rows;
  }
  const snapshot: ClinicSnapshot = {
    version: input.version,
    createdAt: typeof input.createdAt === "string" ? input.createdAt : "",
    clinic: input.clinic as ClinicSnapshot["clinic"],
    ...tables,
  };
  return { ok: true, snapshot };
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;

/** نقّي — إحياء قيم التواريخ المُسلسلة نصاً بعد قراءة JSON */
export function reviveDates<T extends Record<string, unknown>>(row: T): T {
  const revived: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    revived[key] =
      typeof value === "string" &&
      key.endsWith("At") &&
      ISO_DATE_PATTERN.test(value)
        ? new Date(value)
        : value;
  }
  return revived as T;
}
