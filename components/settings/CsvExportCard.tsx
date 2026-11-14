"use client";

import { FileSpreadsheet } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";

// بطاقة «تصدير CSV» — المجموعات الست كلها من هنا: نفس أعمدة أزرار التصدير
// في كل صفحة، وبترميز UTF-8 مع BOM ليفتح Excel العربي الملف مباشرة.

const EXPORT_ITEMS = [
  { dataset: "patients", label: "المرضى" },
  { dataset: "appointments", label: "المواعيد" },
  { dataset: "invoices", label: "الفواتير" },
  { dataset: "payments", label: "المدفوعات" },
  { dataset: "inventory", label: "المخزون" },
  { dataset: "staff", label: "الطاقم" },
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
  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <FileSpreadsheet size={18} className="text-primary-700" aria-hidden />
          تصدير CSV
        </h2>
        <p className="text-sm text-warm-600">
          تُنزَّل المجموعات الست كلها بصيغة CSV بترميز UTF-8 مع BOM لتوافق Excel
          مباشرة.
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          {EXPORT_ITEMS.map((item) => (
            <ExportChip key={item.dataset} dataset={item.dataset} label={item.label} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
