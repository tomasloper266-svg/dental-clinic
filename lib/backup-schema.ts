// تحقق نقّي من ملف النسخة الاحتياطية — بلا I/O ولا قاعدة بيانات.
// الاستعادة ترفض أي ملف لا يطابق هذا العقد قبل لمس البيانات.

/** نسخة العقد الحالية — ترتفع مع أي تغيير في شكل اللقطة */
export const SNAPSHOT_VERSION = 1;

/** الجداول التشغيلية المشمولة — بترتيب آمن لإعادة الإنشاء (المرجع قبل المُحال) */
export const SNAPSHOT_TABLES = [
  "patients",
  "staffMembers",
  "appointments",
  "waitlistEntries",
  "appointmentStatusChanges",
  "toothFindings",
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

/** نقّي — فحص شكل ملف النسخة: العقد والجداول وكل صف يحمل معرّفاً */
export function validateSnapshot(input: unknown): SnapshotCheck {
  if (!isRecord(input)) {
    return { ok: false, error: "الملف ليس نسخة احتياطية صالحة" };
  }
  if (input.version !== SNAPSHOT_VERSION) {
    return { ok: false, error: "إصدار النسخة الاحتياطية غير مدعوم" };
  }
  if (!isRecord(input.clinic) || typeof input.clinic.name !== "string" || typeof input.clinic.usdRate !== "number") {
    return { ok: false, error: "بيانات العيادة ناقصة في الملف" };
  }
  const tables = {} as Record<SnapshotTable, Record<string, unknown>[]>;
  for (const table of SNAPSHOT_TABLES) {
    // بنود الفاتورة أُضيفت للعقد لاحقاً — النسخ الأقدم (v1 قبلها) بلا هذا
    // المفتاح، وتُعامَل كقائمة فارغة كي تبقى قابلة للاستعادة (كانت بنودها
    // مفقودة أصلاً فلا شيء يُعاد).
    const fallback = table === "ledgerEntryItems" ? [] : undefined;
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
    version: SNAPSHOT_VERSION,
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
