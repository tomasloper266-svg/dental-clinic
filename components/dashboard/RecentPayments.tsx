import { HandCoins } from "lucide-react";
import Link from "next/link";
import type { ClinicLedgerEntryDto } from "@/lib/services/ledger";
import { formatEntryDate } from "@/lib/finance-view";
import { formatSyp } from "@/lib/utils";
import { EntityCell } from "@/components/ui/EntityCell";
import { EmptyState } from "@/components/ui/EmptyState";

// آخر المدفوعات — أحدث قيود الدفع من الدفتر القائم، نفس مصدر المالية حصراً.

/** قائمة آخر المدفوعات — أفاتار المريض + التاريخ + المبلغ أخضر بلون الهوية */
export function RecentPayments({ entries }: { entries: ClinicLedgerEntryDto[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={HandCoins}
        title="لا مدفوعات بعد"
        description="أول دفعة تُسجَّل في الدفتر المالي ستظهر هنا."
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-warm-100">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
          <EntityCell
            name={entry.patientName}
            subtitle={formatEntryDate(entry.createdAt)}
          />
          <span className="numeric shrink-0 text-sm font-bold text-primary-700">
            +{formatSyp(Math.abs(entry.amountSyp))}
          </span>
        </li>
      ))}
      <li className="py-2.5 text-end">
        <Link
          href="/finance"
          className="text-xs font-medium text-primary-700 hover:text-primary-800"
        >
          فتح الدفتر المالي
        </Link>
      </li>
    </ul>
  );
}
