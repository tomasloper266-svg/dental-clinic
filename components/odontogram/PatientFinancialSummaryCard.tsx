import { getServerT } from "@/lib/i18n";
import { Wallet } from "lucide-react";
import { summarizePatientLedger } from "@/lib/ledger-view";
import type { LedgerEntryDto } from "@/lib/services/ledger";
import { DualAmount } from "@/components/ui/DualAmount";
import { cn } from "@/components/ui/cn";

// بطاقة ملخص مالي للمريض — كما في المرجع بجانب خطة العلاج في صفحة
// المخطط الموحّدة: إجمالي الفواتير والمسدد والرصيد المستحق بالعملتين.
type Props = {
  entries: LedgerEntryDto[];
  balanceUsd: number;
  usdRate: number;
  className?: string;
};

export async function PatientFinancialSummaryCard({
  entries,
  balanceUsd,
  usdRate,
  className,
}: Props) {
  const t = await getServerT();
  const summary = summarizePatientLedger(entries, balanceUsd);
  const dueUsd = Math.max(balanceUsd, 0);

  return (
    <div
      className={cn(
        "h-fit rounded-panel border border-warm-200 bg-surface-raised p-4",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <Wallet size={16} aria-hidden className="text-primary-600" />
        {t("patients.financialSummary")}
      </p>
      <dl className="mt-3 space-y-3">
        <div className="flex items-baseline justify-between gap-2 border-b border-warm-200 pb-2">
          <dt className="text-xs text-warm-500">{t("invoices.totalInvoices")}</dt>
          <dd>
            <DualAmount usd={summary.chargesUsd} usdRate={usdRate} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2 border-b border-warm-200 pb-2">
          <dt className="text-xs text-primary-700">{t("common.paid")}</dt>
          <dd>
            <DualAmount usd={summary.paidUsd} usdRate={usdRate} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt
            className={cn(
              "text-xs",
              dueUsd > 0 ? "text-danger-600" : "text-warm-500",
            )}
          >
            {t("finance.dueBalance")}
          </dt>
          <dd>
            <DualAmount
              usd={summary.balanceUsd}
              usdRate={usdRate}
              tone={dueUsd > 0 ? "danger" : "default"}
            />
          </dd>
        </div>
      </dl>
      <p
        className={cn(
          "mt-3 text-xs font-medium",
          dueUsd > 0 ? "text-danger-600" : "text-primary-700",
        )}
      >
        {dueUsd > 0 ? t("patients.hasDuesHint") : t("dues.paidCheck")}
      </p>
    </div>
  );
}
