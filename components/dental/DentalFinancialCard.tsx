"use client";

import { CheckCircle2 } from "lucide-react";
import { formatSypAmount } from "@/lib/currency";
import { INVOICE_STATUS_CHIP, INVOICE_STATUS_LABELS } from "@/lib/patient-finance";
import type { DetailedInvoiceView } from "@/lib/patient-finance";
import { Button } from "@/components/ui/Button";
import { ToothIcon } from "@/components/shell/icons/ToothIcon";

// بطاقة الملخص المالي للمخطط المستقل — تقرأ ملخص الدفتر نفسه وتفتح نموذج
// الفاتورة للقيد المقابل؛ بلا حالة محلية.

type Props = {
  chargesTotalSyp: number;
  paidSyp: number;
  remainingSyp: number;
  invoices: DetailedInvoiceView[];
  onOpenInvoice: (index: number) => void;
};

export default function DentalFinancialCard({
  chargesTotalSyp,
  paidSyp,
  remainingSyp,
  invoices,
  onOpenInvoice,
}: Props) {
  return (
    <aside className="space-y-4">
      <section className="rounded-panel border-warm-200 bg-surface-raised border p-4">
        <h2 className="text-ink-900 text-base font-semibold">الملخص المالي للمرضى</h2>

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-steel-600">الإجمالي/المستحق</dt>
            <dd className="numeric font-semibold text-danger-600">
              {formatSypAmount(chargesTotalSyp)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-steel-600">إجمالي المدفوع</dt>
            <dd className="numeric text-ink-900 font-semibold">{formatSypAmount(paidSyp)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-steel-600">المسدد</dt>
            <dd className="numeric inline-flex items-center gap-1 font-semibold text-success-600">
              {remainingSyp === 0 && <CheckCircle2 size={15} aria-hidden />}
              {formatSypAmount(paidSyp)}
            </dd>
          </div>
          <div className="border-warm-200 border-t pt-2">
            <div className="flex items-center justify-between">
              <dt className="text-ink-900 font-medium">المتبقي</dt>
              <dd className="numeric font-semibold text-danger-600">
                {formatSypAmount(remainingSyp)}
              </dd>
            </div>
          </div>
        </dl>
      </section>

      <section className="rounded-panel border-warm-200 bg-surface-raised border p-4">
        <h3 className="text-ink-900 text-sm font-semibold">الفواتير</h3>
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <ToothIcon className="text-warning-500" size={22} />
            <p className="text-steel-500 text-xs">لا فواتير بعد — أصدر فاتورة من بنود الخطة.</p>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {invoices.map((invoice, index) => (
              <li
                key={invoice.number}
                className="border-warm-200 flex items-center justify-between gap-2 rounded-field border px-2.5 py-2"
              >
                <div>
                  <p className="numeric text-ink-900 text-xs font-semibold">
                    {invoice.number}
                  </p>
                  <span
                    className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${INVOICE_STATUS_CHIP[invoice.status]}`}
                  >
                    {INVOICE_STATUS_LABELS[invoice.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="numeric text-sm font-semibold">
                    {formatSypAmount(invoice.totalSyp)}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onOpenInvoice(index)}
                  >
                    عرض الفاتورة
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
