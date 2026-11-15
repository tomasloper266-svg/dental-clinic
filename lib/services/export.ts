import { prisma } from "@/lib/db";
import { deriveClinicInvoices } from "@/lib/invoices-view";
import { listClinicLedgerEntries } from "@/lib/services/ledger";
import { listMaterials } from "@/lib/services/inventory";
import { listStaff } from "@/lib/services/staff";
import {
  appointmentsToCsv,
  invoicesToCsv,
  materialsCsvForExport,
  patientsToCsv,
  paymentsToCsv,
  staffToCsv,
} from "@/lib/export-view";
import type { TenantContext } from "@/lib/tenant/context";
import type { DisplayCurrency } from "@/lib/currency";

// تصدير مجموعات البيانات الست من صفحة الإعدادات — قراءة حصرية بنطاق العيادة
// من الجلسة، وبالأعمدة نفسها التي تستخدمها أزرار التصدير في كل صفحة.

export const EXPORT_DATASETS = [
  "patients",
  "appointments",
  "invoices",
  "payments",
  "inventory",
  "staff",
] as const;

export type ExportDataset = (typeof EXPORT_DATASETS)[number];

export const EXPORT_FILENAMES: Record<ExportDataset, string> = {
  patients: "المرضى.csv",
  appointments: "المواعيد.csv",
  invoices: "الفواتير.csv",
  payments: "المدفوعات.csv",
  inventory: "المخزون.csv",
  staff: "الطاقم.csv",
};

export function isExportDataset(value: string): value is ExportDataset {
  return (EXPORT_DATASETS as readonly string[]).includes(value);
}

/** تصدير مجموعة واحدة — يعيد نص CSV جاهزاً (BOM يُلحق عند الرد) */
export async function buildDatasetCsv(
  ctx: TenantContext,
  dataset: ExportDataset,
  usdRate: number,
  currency: DisplayCurrency,
): Promise<string> {
  switch (dataset) {
    case "patients": {
      const rows = await prisma.patient.findMany({
        where: { clinicId: ctx.clinicId },
        orderBy: { createdAt: "asc" },
        select: {
          fileNo: true,
          name: true,
          birthYear: true,
          phone: true,
          secondaryPhone: true,
          address: true,
          email: true,
          medicalNotes: true,
          createdAt: true,
        },
      });
      return patientsToCsv(rows);
    }
    case "appointments": {
      const rows = await prisma.appointment.findMany({
        where: { clinicId: ctx.clinicId },
        orderBy: { startsAt: "asc" },
        select: {
          startsAt: true,
          durationMin: true,
          status: true,
          reason: true,
          note: true,
          patient: { select: { name: true } },
          staff: { select: { name: true } },
        },
      });
      return appointmentsToCsv(
        rows.map((row) => ({
          startsAt: row.startsAt,
          patientName: row.patient.name,
          staffName: row.staff?.name ?? null,
          durationMin: row.durationMin,
          status: row.status,
          reason: row.reason,
          note: row.note,
        })),
      );
    }
    case "invoices": {
      const entries = await listClinicLedgerEntries(ctx, { limit: 50000 });
      return invoicesToCsv(
        deriveClinicInvoices(entries),
        usdRate,
        currency,
      );
    }
    case "payments": {
      const entries = await listClinicLedgerEntries(ctx, { limit: 50000 });
      return paymentsToCsv(
        entries
          .filter((entry) => entry.type === "PAYMENT")
          .map(({ createdAt, patientName, patientPhone, amountUsd, note }) => ({
            createdAt,
            patientName,
            patientPhone,
            amountUsd,
            note,
          })),
        usdRate,
        currency,
      );
    }
    case "inventory": {
      const materials = await listMaterials(ctx);
      return materialsCsvForExport(materials);
    }
    case "staff": {
      const staff = await listStaff(ctx);
      return staffToCsv(
        staff.map(({ name, roleLabelAr, specialty, phone, commissionPercent, isActive }) => ({
          name,
          roleLabelAr,
          specialty,
          phone,
          commissionPercent,
          isActive,
        })),
      );
    }
  }
}
