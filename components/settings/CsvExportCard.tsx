"use client";

import { FileSpreadsheet } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/core";

// بطاقة «تصدير CSV» — المجموعات الست كلها من هنا: نفس أعمدة أزرار التصدير
// في كل صفحة، وبترميز UTF-8 مع BOM ليفتح Excel العربي الملف مباشرة.

const EXPORT_ITEMS: { dataset: string; labelKey: TranslationKey }[] = [
  { dataset: "patients", labelKey: "nav.patients" },
  { dataset: "appointments", labelKey: "nav.appointments" },
  { dataset: "invoices", labelKey: "nav.invoices" },
  { dataset: "payments", labelKey: "finance.paymentsTitle" },
  { dataset: "inventory", labelKey: "nav.inventory" },
  { dataset: "staff", labelKey: "nav.staff" },
] as const;

/** رقاقة تصدير — رابط تنزيل مباشر للمجموعة، بلا fetch ولا تحميل */
function ExportChip({ dataset, label }: { dataset: string; label: string }) {
  return (
    <a
      href={`/api/settings/export/${dataset}`}
      download
      className="inline-flex items-center gap-2 rounded-full border border-warm-300 bg-surface-raised px-4 py-2 text-sm font-medium text-ink-900 transition-colors hover:bg-surface-hover active:bg-surface-sunken"
    >
      <FileSpreadsheet size={16} className="text-primary-700" aria-hidden />
      {label}
    </a>
  );
}

export function CsvExportCard() {
  const { t } = useI18n();
  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <FileSpreadsheet size={18} className="text-primary-700" aria-hidden />
          {t("settings.exportCsv")}
        </h2>
        <p className="text-sm text-warm-600">
          {t("settings.exportCsvHint")}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          {EXPORT_ITEMS.map((item) => (
            <ExportChip key={item.dataset} dataset={item.dataset} label={t(item.labelKey)} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
