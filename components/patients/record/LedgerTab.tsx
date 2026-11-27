"use client";

import { Plus, ReceiptText, Wallet } from "lucide-react";
import type { LedgerEntryDto } from "@/lib/services/ledger";
import {
  INVOICE_STATUS_CHIP,
  buildPaymentLog,
  deriveInvoicesDetailed,
} from "@/lib/patient-finance";
import { formatDateCell } from "@/lib/dates";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/core";
import {
  useMoney,
  useDisplayCurrency,
  useUsdRate,
} from "@/components/ui/CurrencyContext";
import { formatPrimaryCostFromUsd } from "@/lib/currency";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { cn } from "@/components/ui/cn";

// تبويب «الحساب والسجل المالي» — جدولان جنباً إلى جنب كالمرجع: الفواتير
// المشتوبة من قيود الرسوم مع تخصيص الدفعات، وسجل الدفعات/المخزون (الدفعات
// واستهلاك المواد). المشتقة كلها نقية في lib/patient-finance.ts.

type Props = {
  entries: LedgerEntryDto[];
  balance: number;
  /** سعر صرف الدولار من إعدادات العيادة */
  usdRate: number;
  /** صفوف استهلاك المواد للمريض — من MaterialUsage على الصفحة الخادمية */
  materialRows: ReadonlyArray<{
    createdAt: Date | string;
    materialName: string;
    costUsd: number;
  }>;
  onNewEntry: () => void;
};

const MATERIAL_CHIP = "border-plum-200 bg-plum-50 text-plum-700";
const PAYMENT_CHIP = "border-primary-200 bg-primary-50 text-primary-800";

export default function LedgerTab({
  entries,
  balance,
  materialRows,
  onNewEntry,
}: Props) {
  const { t } = useI18n();
  const money = useMoney();
  const currency = useDisplayCurrency();
  const usdRate = useUsdRate();
  // النسخة التفصيلية — بها discountUsd لعمود الخصم كي يتوازن الصف:
  // الإجمالي = المدفوع + الخصم + المتبقي (سجل art_yHnC9AAM بند 14أ)
  const invoices = deriveInvoicesDetailed(entries);
  const paymentLog = buildPaymentLog(entries, materialRows);
  const dueUsd = Math.max(balance, 0);

  return (
    <div className="space-y-4">
      {/* ملخص الرصيد — المستحق الجاري من الدفتر دائماً */}
      <div className="rounded-panel border-warm-200 bg-surface-raised flex flex-wrap items-center justify-between gap-3 border px-5 py-3">
        <div className="flex items-center gap-2">
          <Wallet size={16} aria-hidden className="text-warm-400" />
          <span className="text-warm-600 text-sm font-medium">
            {t("ledger.balance")}
          </span>
          <span
            className={cn(
              "numeric text-sm font-semibold",
              dueUsd > 0 ? "text-danger-600" : "text-primary-700",
            )}
          >
            {money(dueUsd)}
          </span>
        </div>
        <Button onClick={onNewEntry} className="h-8 px-3 text-xs">
          <Plus size={14} aria-hidden />
          {t("record.newLedger")}
        </Button>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {/* ─── الفواتير ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText size={16} aria-hidden className="text-warm-400" />
              {t("ledger.invoices")}
              <span className="text-warm-400 numeric text-xs font-normal">
                ({invoices.length})
              </span>
            </CardTitle>
          </CardHeader>
          {invoices.length === 0 ? (
            <p className="text-warm-500 p-5 text-sm">
              {t("ledger.noInvoices")}
            </p>
          ) : (
            <Table>
              <THead>
                <TRow>
                  <TH>{t("ledger.col.no")}</TH>
                  <TH>{t("ledger.col.date")}</TH>
                  <TH>{t("ledger.col.total")}</TH>
                  <TH>{t("ledger.col.paid")}</TH>
                  <TH>{t("ledger.col.discount")}</TH>
                  <TH>{t("ledger.col.remaining")}</TH>
                  <TH>{t("ledger.col.paymentStatus")}</TH>
                </TRow>
              </THead>
              <tbody>
                {invoices.map((inv) => (
                  <TRow key={inv.number}>
                    <TD className="numeric text-ink-900 text-sm">
                      {inv.number}
                    </TD>
                    <TD className="numeric text-warm-600 text-xs">
                      {formatDateCell(inv.date)}
                    </TD>
                    <TD className="numeric text-ink-900 text-sm">
                      {money(inv.totalUsd)}
                    </TD>
                    <TD className="numeric text-primary-700 text-sm">
                      {money(inv.paidUsd)}
                    </TD>
                    <TD
                      className={cn(
                        "numeric text-sm",
                        inv.discountUsd > 0
                          ? "text-warning-700"
                          : "text-warm-400",
                      )}
                    >
                      {money(inv.discountUsd)}
                    </TD>
                    <TD
                      className={cn(
                        "numeric text-sm",
                        inv.remainingUsd > 0
                          ? "text-danger-600"
                          : "text-warm-400",
                      )}
                    >
                      {money(inv.remainingUsd)}
                    </TD>
                    <TD>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${INVOICE_STATUS_CHIP[inv.status]}`}
                      >
                        {t(`invoice.${inv.status}` as TranslationKey)}
                      </span>
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* ─── سجل الدفعات/المخزون ──────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet size={16} aria-hidden className="text-warm-400" />
              {t("ledger.paymentsLog")}
              <span className="text-warm-400 numeric text-xs font-normal">
                ({paymentLog.length})
              </span>
            </CardTitle>
          </CardHeader>
          {paymentLog.length === 0 ? (
            <p className="text-warm-500 p-5 text-sm">{t("ledger.noEntries")}</p>
          ) : (
            <Table>
              <THead>
                <TRow>
                  <TH>{t("ledger.col.date")}</TH>
                  <TH>{t("ledger.col.desc")}</TH>
                  <TH>{t("ledger.col.amount")}</TH>
                  <TH>{t("ledger.col.type")}</TH>
                </TRow>
              </THead>
              <tbody>
                {paymentLog.map((row, index) => (
                  <TRow key={`${row.date}-${index}`}>
                    <TD className="numeric text-warm-600 text-xs">
                      {formatDateCell(row.date)}
                    </TD>
                    <TD className="text-ink-900 max-w-48 truncate text-sm">
                      {row.description}
                    </TD>
                    <TD
                      className={cn(
                        "numeric text-sm font-medium",
                        row.kind === "PAYMENT"
                          ? "text-primary-700"
                          : "text-warm-700",
                      )}
                    >
                      {row.kind === "PAYMENT" ? "−" : "+"}
                      {row.kind === "PAYMENT"
                        ? money(Math.abs(row.amountUsd))
                        : formatPrimaryCostFromUsd(
                            Math.abs(row.amountUsd),
                            usdRate,
                            currency,
                          )}
                    </TD>
                    <TD>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${row.kind === "PAYMENT" ? PAYMENT_CHIP : MATERIAL_CHIP}`}
                      >
                        {row.kind === "PAYMENT"
                          ? t("ledger.kindPayment")
                          : t("ledger.kindInventory")}
                      </span>
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
