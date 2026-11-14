import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import {
  SNAPSHOT_VERSION,
  reviveDates,
  validateSnapshot,
  type ClinicSnapshot,
  type SnapshotTable,
} from "@/lib/backup-schema";

// النسخ الاحتياطي والاستعادة — لقطة JSON كاملة للبيانات التشغيلية للعيادة.
// تلقائية بعد كل عملية تحديث (مؤجَّلة ومجمّعة من غلاف استعلام Prisma في
// lib/db.ts) ويدوية بالتنزيل الآن. الاستعادة تتحقق من الملف ثم تعيد الإنشاء
// داخل معاملة واحدة — أي فشل يعيد قاعدة البيانات كما كانت.

type Db = PrismaClient | Prisma.TransactionClient;

type Row = Record<string, unknown>;

/**
 * عمليات كل جدول تشغيلي — القراءة للنسخ، والحذف والإضافة للاستعادة.
 * ترتيب المصفوفة هو ترتيب الإحالات: المرجع قبل المُحال عند الإعادة.
 * الإضافة تفرض clinicId من الجلسة — معرّف العيادة في الملف لا يُوثق به أبداً.
 */
const TABLES: {
  key: SnapshotTable;
  list: (db: Db, clinicId: string) => Promise<Row[]>;
  clear: (db: Prisma.TransactionClient, clinicId: string) => Promise<unknown>;
  insert: (
    db: Prisma.TransactionClient,
    rows: Row[],
  ) => Promise<unknown>;
}[] = [
  {
    key: "patients",
    list: (db, c) => db.patient.findMany({ where: { clinicId: c } }),
    clear: (db, c) => db.patient.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.patient.createMany({ data: rows as Prisma.PatientCreateManyInput[] }),
  },
  {
    key: "staffMembers",
    list: (db, c) => db.staffMember.findMany({ where: { clinicId: c } }),
    clear: (db, c) => db.staffMember.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.staffMember.createMany({
        data: rows as Prisma.StaffMemberCreateManyInput[],
      }),
  },
  {
    key: "appointments",
    list: (db, c) => db.appointment.findMany({ where: { clinicId: c } }),
    clear: (db, c) => db.appointment.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.appointment.createMany({
        data: rows as Prisma.AppointmentCreateManyInput[],
      }),
  },
  {
    key: "waitlistEntries",
    list: (db, c) => db.waitlistEntry.findMany({ where: { clinicId: c } }),
    clear: (db, c) => db.waitlistEntry.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.waitlistEntry.createMany({
        data: rows as Prisma.WaitlistEntryCreateManyInput[],
      }),
  },
  {
    key: "appointmentStatusChanges",
    list: (db, c) =>
      db.appointmentStatusChange.findMany({ where: { clinicId: c } }),
    clear: (db, c) =>
      db.appointmentStatusChange.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.appointmentStatusChange.createMany({
        data: rows as Prisma.AppointmentStatusChangeCreateManyInput[],
      }),
  },
  {
    key: "toothFindings",
    list: (db, c) => db.toothFinding.findMany({ where: { clinicId: c } }),
    clear: (db, c) => db.toothFinding.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.toothFinding.createMany({
        data: rows as Prisma.ToothFindingCreateManyInput[],
      }),
  },
  {
    key: "treatmentPlans",
    list: (db, c) => db.treatmentPlan.findMany({ where: { clinicId: c } }),
    clear: (db, c) => db.treatmentPlan.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.treatmentPlan.createMany({
        data: rows as Prisma.TreatmentPlanCreateManyInput[],
      }),
  },
  {
    key: "treatmentPlanItems",
    list: (db, c) =>
      db.treatmentPlanItem.findMany({ where: { clinicId: c } }),
    clear: (db, c) =>
      db.treatmentPlanItem.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.treatmentPlanItem.createMany({
        data: rows as Prisma.TreatmentPlanItemCreateManyInput[],
      }),
  },
  {
    key: "ledgerEntries",
    list: (db, c) => db.ledgerEntry.findMany({ where: { clinicId: c } }),
    clear: (db, c) => db.ledgerEntry.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.ledgerEntry.createMany({
        data: rows as Prisma.LedgerEntryCreateManyInput[],
      }),
  },
  {
    key: "expenses",
    list: (db, c) => db.expense.findMany({ where: { clinicId: c } }),
    clear: (db, c) => db.expense.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.expense.createMany({ data: rows as Prisma.ExpenseCreateManyInput[] }),
  },
  {
    key: "materials",
    list: (db, c) => db.material.findMany({ where: { clinicId: c } }),
    clear: (db, c) => db.material.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.material.createMany({
        data: rows as Prisma.MaterialCreateManyInput[],
      }),
  },
  {
    key: "materialMovements",
    list: (db, c) => db.materialMovement.findMany({ where: { clinicId: c } }),
    clear: (db, c) =>
      db.materialMovement.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.materialMovement.createMany({
        data: rows as Prisma.MaterialMovementCreateManyInput[],
      }),
  },
  {
    key: "materialUsages",
    list: (db, c) => db.materialUsage.findMany({ where: { clinicId: c } }),
    clear: (db, c) => db.materialUsage.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.materialUsage.createMany({
        data: rows as Prisma.MaterialUsageCreateManyInput[],
      }),
  },
  {
    key: "instructionTemplates",
    list: (db, c) =>
      db.instructionTemplate.findMany({ where: { clinicId: c } }),
    clear: (db, c) =>
      db.instructionTemplate.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.instructionTemplate.createMany({
        data: rows as Prisma.InstructionTemplateCreateManyInput[],
      }),
  },
  {
    key: "instructionSends",
    list: (db, c) => db.instructionSend.findMany({ where: { clinicId: c } }),
    clear: (db, c) => db.instructionSend.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.instructionSend.createMany({
        data: rows as Prisma.InstructionSendCreateManyInput[],
      }),
  },
  {
    key: "appointmentReminders",
    list: (db, c) =>
      db.appointmentReminder.findMany({ where: { clinicId: c } }),
    clear: (db, c) =>
      db.appointmentReminder.deleteMany({ where: { clinicId: c } }),
    insert: (db, rows) =>
      db.appointmentReminder.createMany({
        data: rows as Prisma.AppointmentReminderCreateManyInput[],
      }),
  },
];

// بناء لقطة JSON — العيادة وإعداداتها وكل جداولها التشغيلية.
export async function buildSnapshot(
  db: Db,
  clinicId: string,
): Promise<ClinicSnapshot> {
  const clinic = await db.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: {
      name: true,
      currency: true,
      usdRate: true,
      logoLetter: true,
      openingBalance: true,
      workStart: true,
      workEnd: true,
    },
  });

  const tables = {} as Record<SnapshotTable, Row[]>;
  for (const table of TABLES) {
    tables[table.key] = await table.list(db, clinicId);
  }

  return {
    version: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    clinic,
    ...tables,
  };
}

// ─── النسخة التلقائية — مؤجَّلة ومجمّعة لكل عيادة ─────────────────────────────

const AUTO_BACKUP_DEBOUNCE_MS = 2000;
const pendingBackups = new Map<string, ReturnType<typeof setTimeout>>();

/** مجدول النسخة التلقائية — يُستدعى من غلاف lib/db بعد كل عملية تحديث */
export function scheduleAutoBackup(
  db: PrismaClient,
  clinicId: string,
): void {
  const existing = pendingBackups.get(clinicId);
  if (existing) clearTimeout(existing);
  pendingBackups.set(
    clinicId,
    setTimeout(() => {
      pendingBackups.delete(clinicId);
      void storeAutoBackup(db, clinicId);
    }, AUTO_BACKUP_DEBOUNCE_MS),
  );
}

// حفظ آخر نسخة تلقائية فقط — استبدال السابقة كي لا ينمو الجدول بلا حدود.
// فشل النسخ لا يفشل العملية الأصلية أبداً — يُسجَّل ولا يُبتلع بصمت.
async function storeAutoBackup(
  db: PrismaClient,
  clinicId: string,
): Promise<void> {
  try {
    const payload = await buildSnapshot(db, clinicId);
    await db.$transaction([
      db.clinicBackup.deleteMany({ where: { clinicId, kind: "AUTO" } }),
      db.clinicBackup.create({
        data: {
          clinicId,
          kind: "AUTO",
          // اللقطة JSON بطبيعتها — validateSnapshot يضمن شكلها عند الاستعادة
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
  } catch (err) {
    console.error(`[auto-backup] failed for clinic ${clinicId}:`, err);
  }
}

// ─── الاستعادة ─────────────────────────────────────────────────────────────────

export type RestoreResult =
  | { ok: true; counts: Record<string, number> }
  | { ok: false; error: string };

// استعادة نسخة احتياطية داخل معاملة واحدة: تحقق من الملف، ثم حذف البيانات
// التشغيلية الحالية بعكس ترتيب الإحالات وإعادة إنشاء الصفوف بترتيبها.
// حسابات الدخول لا تُمس — قفل الحساب وكلمات السر يبقيان كما هما.
export async function restoreSnapshot(
  db: PrismaClient,
  clinicId: string,
  input: unknown,
): Promise<RestoreResult> {
  const check = validateSnapshot(input);
  if (!check.ok) return { ok: false, error: check.error };
  const snapshot = check.snapshot;

  const counts: Record<string, number> = {};
  await db.$transaction(async (tx) => {
    for (const table of [...TABLES].reverse()) {
      await table.clear(tx, clinicId);
    }
    for (const table of TABLES) {
      const rows = snapshot[table.key].map((row) => ({
        ...reviveDates(row),
        clinicId,
      }));
      await table.insert(tx, rows);
      counts[table.key] = rows.length;
    }
    await tx.clinic.update({ where: { id: clinicId }, data: snapshot.clinic });
  });
  return { ok: true, counts };
}
