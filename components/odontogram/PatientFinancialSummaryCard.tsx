import { Wallet } from "lucide-react";
import { summarizePatientLedger } from "@/lib/ledger-view";
import type { LedgerEntryDto } from "@/lib/services/ledger";
import { DualAmount } from "@/components/ui/DualAmount";
import { cn } from "@/components/ui/cn";

// بطاقة ملخص مالي للمريض — كما في المرجع بجانب خطة العلاج في صفحة
// المخطط الموحّدة: إجمالي الفواتير والمسدد والرصيد المستحق بالعملتين.
type Props = {
  entries: LedgerEntryDto[];
  balanceSyp: number;
  usdRate: number;
  className?: string;
};

export function PatientFinancialSummaryCard({
  entries,
  balanceSyp,
  usdRate,
  className,
}: Props) {
  const summary = summarizePatientLedger(entries, balanceSyp);
  const dueSyp = Math.max(balanceSyp, 0);

  return (
    <div
      className={cn(
        "h-fit rounded-panel border border-warm-200 bg-surface-raised p-4",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <Wallet size={16} aria-hidden className="text-primary-600" />
        ملخص مالي للمريض
      </p>
      <dl className="mt-3 space-y-3">
        <div className="flex items-baseline justify-between gap-2 border-b border-warm-200 pb-2">
          <dt className="text-xs text-warm-500">إجمالي الفواتير</dt>
          <dd>
            <DualAmount syp={summary.chargesSyp} usdRate={usdRate} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2 border-b border-warm-200 pb-2">
          <dt className="text-xs text-primary-700">المسدد</dt>
          <dd>
            <DualAmount syp={summary.paidSyp} usdRate={usdRate} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt
            className={cn(
              "text-xs",
              dueSyp > 0 ? "text-danger-600" : "text-warm-500",
            )}
          >
            الرصيد المستحق
          </dt>
          <dd>
            <DualAmount
              syp={summary.balanceSyp}
              usdRate={usdRate}
              tone={dueSyp > 0 ? "danger" : "default"}
            />
          </dd>
        </div>
      </dl>
      <p
        className={cn(
          "mt-3 text-xs font-medium",
          dueSyp > 0 ? "text-danger-600" : "text-primary-700",
        )}
      >
        {dueSyp > 0 ? "عليه رصيد مستحق — سوِّف عبر صفحة المستحقات" : "مسدد ✓"}
      </p>
    </div>
  );
}
