"use client";

import { HandCoins } from "lucide-react";
import Link from "next/link";
import type { ClinicLedgerEntryDto } from "@/lib/services/ledger";
import { formatDate } from "@/lib/i18n/format";
import { useI18n } from "@/components/i18n/I18nProvider";
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
  const { t, locale } = useI18n();
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={HandCoins}
        title={t("payments.emptyTitle")}
        description={t("payments.emptyDesc")}
      />
    );
  }
  return (
    <ul className="divide-warm-100 flex flex-col divide-y">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex items-center justify-between gap-3 py-2.5"
        >
          <EntityCell
            name={entry.patientName}
            subtitle={formatDate(entry.createdAt, locale, {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
          <span className="numeric text-primary-700 shrink-0 text-sm font-bold">
            +{money(Math.abs(entry.amountUsd))}
          </span>
        </li>
      ))}
      <li className="py-2.5 text-end">
        <Link
          href="/invoices"
          className="text-primary-700 hover:text-primary-800 text-xs font-medium"
        >
          {t("payments.openLedger")}
        </Link>
      </li>
    </ul>
  );
}
