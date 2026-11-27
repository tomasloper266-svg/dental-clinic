"use client";

import { HandCoins } from "lucide-react";
import Link from "next/link";
import type { ClinicLedgerEntryDto } from "@/lib/services/ledger";
import { formatEntryDate } from "@/lib/finance-view";
import { useMoney } from "@/components/ui/CurrencyContext";
import { EntityCell } from "@/components/ui/EntityCell";
import { EmptyState } from "@/components/ui/EmptyState";

// آخر المدفوعات — أحدث قيود الدفع من الدفتر القائم، نفس مصدر المالية حصراً.

/** قائمة آخر المدفوعات — أفاتار المريض + التاريخ + المبلغ أخضر بلون الهوية */
export function RecentPayments({
  entries,
}: {
  entries: ClinicLedgerEntryDto[];
}) {
  const money = useMoney();
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
            +{money(Math.abs(entry.amountUsd))}
          </span>
        </li>
      ))}
      <li className="py-2.5 text-end">
        <Link
          href="/invoices"
          className="text-xs font-medium text-primary-700 hover:text-primary-800"
        >
          فتح الدفتر المالي
        </Link>
      </li>
    </ul>
  );
}
