import { STATUS_META } from "@/lib/appointment-ui";
import {
  formatPrimaryFromUsd,
  type DisplayCurrency,
} from "@/lib/currency";
import { toCsv } from "@/lib/csv";
import { formatDateCell } from "@/lib/dates";
import { createT, type Locale } from "@/lib/i18n/core";
import type { DetailedInvoiceView } from "@/lib/patient-finance";
import { invoiceStatusLabel } from "@/lib/patient-finance";
import type { ClinicLedgerEntryDto } from "@/lib/services/ledger";
import { materialsToCsv } from "@/lib/inventory-view";
import type { PatientDto } from "@/lib/services/patients";
import type { StaffMemberDto } from "@/lib/services/staff";
import { staffRoleLabelKey } from "@/lib/staff-view";
import type { AppointmentDto } from "@/lib/services/appointments";

// بنية أعمدة تصدير CSV لصفحة الإعدادات — نقية بلا I/O. نفس أعمدة أزرار
// التصدير في كل صفحة، وتُغذّى من خدمات العيادة حصراً، وبالعملة المعروضة
// التي اختارتها العيادة (BOM يُلحق عند التنزيل عبر withUtf8Bom).

export type PatientsRow = Pick<
  PatientDto,
  | "fileNo"
  | "name"
  | "birthYear"
  | "phone"
  | "secondaryPhone"
  | "address"
  | "email"
  | "medicalNotes"
  | "createdAt"
>;

/** نقّي — ملف المرضى كاملاً بأعمدة جدول المرضى */
export function patientsToCsv(
  locale: Locale,
  rows: ReadonlyArray<PatientsRow>,
): string {
  const t = createT(locale);
  return toCsv(
    [
      t("export.column.fileNo"),
      t("export.column.name"),
      t("export.column.birthYear"),
      t("export.column.phone"),
      t("export.column.phone2"),
      t("export.column.address"),
      t("export.column.email"),
      t("export.column.medicalNotes"),
      t("export.column.registeredAt"),
    ],
    rows.map((row) => [
      row.fileNo ?? "",
      row.name,
      row.birthYear ?? "",
      row.phone ?? "",
      row.secondaryPhone ?? "",
      row.address ?? "",
      row.email ?? "",
      row.medicalNotes ?? "",
      formatDateCell(row.createdAt),
    ]),
  );
}

type AppointmentRow = Pick<
  AppointmentDto,
  "startsAt" | "patientName" | "staffName" | "durationMin" | "status" | "reason" | "note"
>;

/** نقّي — المواعيد كلها بأعمدة لوحة المواعيد */
export function appointmentsToCsv(
  locale: Locale,
  rows: ReadonlyArray<AppointmentRow>,
): string {
  const t = createT(locale);
  return toCsv(
    [t("export.column.date"), t("export.column.time"), t("export.column.patient"), t("export.column.doctor"), t("export.column.durationMin"), t("export.column.status"), t("export.column.reason"), t("export.column.notes")],
    rows.map((row) => [
      formatDateCell(row.startsAt),
      row.startsAt instanceof Date
        ? row.startsAt.toISOString().slice(11, 16)
        : String(row.startsAt).slice(11, 16),
      row.patientName,
      row.staffName ?? "",
      row.durationMin,
      t(STATUS_META[row.status].labelKey),
      row.reason ?? "",
      row.note ?? "",
    ]),
  );
}

export type InvoiceRow = DetailedInvoiceView & {
  patientName: string;
};

/** نقّي — الفواتير المشتقة من الدفتر بأعمدة صفحة الفواتير وبالعملة المعروضة */
export function invoicesToCsv(
  locale: Locale,
  rows: ReadonlyArray<InvoiceRow>,
  usdRate: number,
  currency: DisplayCurrency,
): string {
  const t = createT(locale);
  return toCsv(
    [t("export.column.fileNo"), t("export.column.patient"), t("export.column.date"), t("export.column.total"), t("export.column.paid"), t("export.column.remaining"), t("export.column.status")],
    rows.map((row) => [
      row.number,
      row.patientName,
      formatDateCell(row.date),
      formatPrimaryFromUsd(row.totalUsd, usdRate, currency),
      formatPrimaryFromUsd(row.paidUsd, usdRate, currency),
      formatPrimaryFromUsd(row.remainingUsd, usdRate, currency),
      invoiceStatusLabel(locale, row.status),
    ]),
  );
}

export type PaymentRow = Pick<
  ClinicLedgerEntryDto,
  "createdAt" | "patientName" | "patientPhone" | "amountUsd" | "note"
>;

/** نقّي — قيود الدفع فقط بأعمدة الدفتر المالي وبالعملة المعروضة */
export function paymentsToCsv(
  locale: Locale,
  rows: ReadonlyArray<PaymentRow>,
  usdRate: number,
  currency: DisplayCurrency,
): string {
  const t = createT(locale);
  return toCsv(
    [t("export.column.date"), t("export.column.patient"), t("export.column.phone"), t("export.column.amount"), t("export.column.statement")],
    rows.map((row) => [
      formatDateCell(row.createdAt),
      row.patientName,
      row.patientPhone ?? "",
      formatPrimaryFromUsd(row.amountUsd, usdRate, currency),
      row.note ?? "",
    ]),
  );
}

export type MaterialCsvRow = Parameters<typeof materialsToCsv>[1][number];

/** نقّي — المخزون بعمود بنّاء materialsToCsv نفسه المستخدم في صفحة المخزون */
export function materialsCsvForExport(
  locale: Locale,
  rows: ReadonlyArray<MaterialCsvRow>,
): string {
  return materialsToCsv(locale, rows);
}

export type StaffCsvRow = Pick<
  StaffMemberDto,
  "name" | "role" | "specialty" | "phone" | "commissionPercent" | "isActive"
>;

/** نقّي — الطاقم بأعمدة صفحة الطاقم */
export function staffToCsv(
  locale: Locale,
  rows: ReadonlyArray<StaffCsvRow>,
): string {
  const t = createT(locale);
  return toCsv(
    [t("export.column.name"), t("export.column.role"), t("export.column.specialty"), t("export.column.phone"), t("export.column.commissionPercent"), t("export.column.status")],
    rows.map((row) => [
      row.name,
      t(staffRoleLabelKey(row.role)),
      row.specialty ?? "",
      row.phone ?? "",
      row.commissionPercent,
      row.isActive ? t("export.active") : t("export.disabled"),
    ]),
  );
}
