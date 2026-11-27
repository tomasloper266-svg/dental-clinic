"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { CheckCircle2 } from "lucide-react";
import {
  INVOICE_STATUS_CHIP,
  INVOICE_STATUS_LABEL_KEYS,
} from "@/lib/patient-finance";
import type { DetailedInvoiceView } from "@/lib/patient-finance";
import { useMoney } from "@/components/ui/CurrencyContext";
import { Button } from "@/components/ui/Button";
import { ToothIcon } from "@/components/shell/icons/ToothIcon";

// بطاقة الملخص المالي للمخطط المستقل — تقرأ ملخص الدفتر نفسه وتفتح نموذج
// الفاتورة للقيد المقابل؛ بلا حالة محلية.

type Props = {
  chargesTotalUsd: number;
  paidUsd: number;
  remainingUsd: number;
  invoices: DetailedInvoiceView[];
  onOpenInvoice: (index: number) => void;
};

export default function DentalFinancialCard({
  chargesTotalUsd,
  paidUsd,
  remainingUsd,
  invoices,
  onOpenInvoice,
}: Props) {
  const { t } = useI18n();
  const money = useMoney();
  return (
    <aside className="space-y-4">
      <section className="rounded-panel border-warm-200 bg-surface-raised border p-4">
        <h2 className="text-ink-900 text-base font-semibold">{t("dental.financialSummary")}</h2>

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-steel-600">{t("common.totalOrDue")}</dt>
            <dd className="numeric font-semibold text-danger-600">
              {money(chargesTotalUsd)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-steel-600">{t("invoices.totalPaid")}</dt>
            <dd className="numeric text-ink-900 font-semibold">{money(paidUsd)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-steel-600">{t("common.paid")}</dt>
            <dd className="numeric inline-flex items-center gap-1 font-semibold text-success-600">
              {remainingUsd === 0 && <CheckCircle2 size={15} aria-hidden />}
              {money(paidUsd)}
            </dd>
          </div>
          <div className="border-warm-200 border-t pt-2">
            <div className="flex items-center justify-between">
              <dt className="text-ink-900 font-medium">{t("common.remaining")}</dt>
              <dd className="numeric font-semibold text-danger-600">
                {money(remainingUsd)}
              </dd>
            </div>
          </div>
        </dl>
      </section>

      <section className="rounded-panel border-warm-200 bg-surface-raised border p-4">
        <h3 className="text-ink-900 text-sm font-semibold">{t("common.invoices")}</h3>
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <ToothIcon className="text-warning-500" size={22} />
            <p className="text-steel-500 text-xs">{t("invoices.emptyHint")}</p>
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
                    {t(INVOICE_STATUS_LABEL_KEYS[invoice.status])}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="numeric text-sm font-semibold">
                    {money(invoice.totalUsd)}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onOpenInvoice(index)}
                  >
                    {t("invoices.view")}
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
