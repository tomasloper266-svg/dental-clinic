import { STATUS_LABEL } from "@/lib/appointment-ui";
import {
  formatPrimaryFromUsd,
  type DisplayCurrency,
} from "@/lib/currency";
import { toCsv } from "@/lib/csv";
import { formatDateCell } from "@/lib/dates";
import type { DetailedInvoiceView } from "@/lib/patient-finance";
import { INVOICE_STATUS_LABELS } from "@/lib/patient-finance";
import type { ClinicLedgerEntryDto } from "@/lib/services/ledger";
import { materialsToCsv } from "@/lib/inventory-view";
import type { PatientDto } from "@/lib/services/patients";
import type { StaffMemberDto } from "@/lib/services/staff";
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
export function patientsToCsv(rows: ReadonlyArray<PatientsRow>): string {
  return toCsv(
    [
      "الرقم",
      "الاسم",
      "سنة الميلاد",
      "الهاتف",
      "الهاتف الثاني",
      "العنوان",
      "البريد",
      "الملاحظات الطبية",
      "تاريخ التسجيل",
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
export function appointmentsToCsv(rows: ReadonlyArray<AppointmentRow>): string {
  return toCsv(
    ["التاريخ", "الوقت", "المريض", "الطبيب", "المدة (دقيقة)", "الحالة", "السبب", "الملاحظات"],
    rows.map((row) => [
      formatDateCell(row.startsAt),
      row.startsAt instanceof Date
        ? row.startsAt.toISOString().slice(11, 16)
        : String(row.startsAt).slice(11, 16),
      row.patientName,
      row.staffName ?? "",
      row.durationMin,
      STATUS_LABEL(row.status),
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
  rows: ReadonlyArray<InvoiceRow>,
  usdRate: number,
  currency: DisplayCurrency,
): string {
  return toCsv(
    ["الرقم", "المريض", "التاريخ", "الإجمالي", "المدفوع", "المتبقي", "الحالة"],
    rows.map((row) => [
      row.number,
      row.patientName,
      formatDateCell(row.date),
      formatPrimaryFromUsd(row.totalUsd, usdRate, currency),
      formatPrimaryFromUsd(row.paidUsd, usdRate, currency),
      formatPrimaryFromUsd(row.remainingUsd, usdRate, currency),
      INVOICE_STATUS_LABELS[row.status],
    ]),
  );
}

export type PaymentRow = Pick<
  ClinicLedgerEntryDto,
  "createdAt" | "patientName" | "patientPhone" | "amountUsd" | "note"
>;

/** نقّي — قيود الدفع فقط بأعمدة الدفتر المالي وبالعملة المعروضة */
export function paymentsToCsv(
  rows: ReadonlyArray<PaymentRow>,
  usdRate: number,
  currency: DisplayCurrency,
): string {
  return toCsv(
    ["التاريخ", "المريض", "الهاتف", "المبلغ", "البيان"],
    rows.map((row) => [
      formatDateCell(row.createdAt),
      row.patientName,
      row.patientPhone ?? "",
      formatPrimaryFromUsd(row.amountUsd, usdRate, currency),
      row.note ?? "",
    ]),
  );
}

export type MaterialCsvRow = Parameters<typeof materialsToCsv>[0][number];

/** نقّي — المخزون بعمود بنّاء materialsToCsv نفسه المستخدم في صفحة المخزون */
export function materialsCsvForExport(
  rows: ReadonlyArray<MaterialCsvRow>,
): string {
  return materialsToCsv(rows);
}

export type StaffCsvRow = Pick<
  StaffMemberDto,
  "name" | "roleLabelAr" | "specialty" | "phone" | "commissionPercent" | "isActive"
>;

/** نقّي — الطاقم بأعمدة صفحة الطاقم */
export function staffToCsv(rows: ReadonlyArray<StaffCsvRow>): string {
  return toCsv(
    ["الاسم", "الدور", "التخصص", "الهاتف", "العمولة %", "الحالة"],
    rows.map((row) => [
      row.name,
      row.roleLabelAr,
      row.specialty ?? "",
      row.phone ?? "",
      row.commissionPercent,
      row.isActive ? "نشط" : "معطل",
    ]),
  );
}
