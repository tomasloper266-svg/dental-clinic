"use client";

import { Plus, ReceiptText, Wallet } from "lucide-react";
import type { LedgerEntryDto } from "@/lib/services/ledger";
import {
  INVOICE_STATUS_CHIP,
  INVOICE_STATUS_LABELS,
  buildPaymentLog,
  deriveInvoices,
} from "@/lib/patient-finance";
import { formatDateCell } from "@/lib/dates";
import { useMoney, useDisplayCurrency, useUsdRate } from "@/components/ui/CurrencyContext";
import { formatPrimaryCostFromSyp } from "@/lib/currency";
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
    costSyp: number;
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
  const money = useMoney();
  const currency = useDisplayCurrency();
  const usdRate = useUsdRate();
  const invoices = deriveInvoices(entries);
  const paymentLog = buildPaymentLog(entries, materialRows);
  const dueSyp = Math.max(balance, 0);

  return (
    <div className="space-y-4">
      {/* ملخص الرصيد — المستحق الجاري من الدفتر دائماً */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-warm-200 bg-surface-raised px-5 py-3">
        <div className="flex items-center gap-2">
          <Wallet size={16} aria-hidden className="text-warm-400" />
          <span className="text-warm-600 text-sm font-medium">
            الرصيد الجاري
          </span>
          <span
            className={cn(
              "numeric text-sm font-semibold",
              dueSyp > 0 ? "text-danger-600" : "text-primary-700",
            )}
          >
            {money(dueSyp)}
          </span>
        </div>
        <Button onClick={onNewEntry} className="h-8 px-3 text-xs">
          <Plus size={14} aria-hidden />
          سجل عملية
        </Button>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {/* ─── الفواتير ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText size={16} aria-hidden className="text-warm-400" />
              الفواتير
              <span className="text-warm-400 numeric text-xs font-normal">
                ({invoices.length})
              </span>
            </CardTitle>
          </CardHeader>
          {invoices.length === 0 ? (
            <p className="text-warm-500 p-5 text-sm">
              لا فواتير بعد — كل قيد رسوم يُعرض هنا كفاتورة.
            </p>
          ) : (
            <Table>
              <THead>
                <TRow>
                  <TH>الرقم</TH>
                  <TH>التاريخ</TH>
                  <TH>الإجمالي</TH>
                  <TH>المدفوع</TH>
                  <TH>المتبقي</TH>
                  <TH>حالة الدفع</TH>
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
                      {money(inv.totalSyp)}
                    </TD>
                    <TD className="numeric text-primary-700 text-sm">
                      {money(inv.paidSyp)}
                    </TD>
                    <TD
                      className={cn(
                        "numeric text-sm",
                        inv.remainingSyp > 0 ? "text-danger-600" : "text-warm-400",
                      )}
                    >
                      {money(inv.remainingSyp)}
                    </TD>
                    <TD>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${INVOICE_STATUS_CHIP[inv.status]}`}
                      >
                        {INVOICE_STATUS_LABELS[inv.status]}
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
              سجل الدفعات/المخزون
              <span className="text-warm-400 numeric text-xs font-normal">
                ({paymentLog.length})
              </span>
            </CardTitle>
          </CardHeader>
          {paymentLog.length === 0 ? (
            <p className="text-warm-500 p-5 text-sm">
              لا دفعات ولا استهلاك مواد بعد.
            </p>
          ) : (
            <Table>
              <THead>
                <TRow>
                  <TH>التاريخ</TH>
                  <TH>الوصف</TH>
                  <TH>المبلغ</TH>
                  <TH>النوع</TH>
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
                        ? money(Math.abs(row.amountSyp))
                        : formatPrimaryCostFromSyp(
                            Math.abs(row.amountSyp),
                            usdRate,
                            currency,
                          )}
                    </TD>
                    <TD>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${row.kind === "PAYMENT" ? PAYMENT_CHIP : MATERIAL_CHIP}`}
                      >
                        {row.kind === "PAYMENT" ? "دفعة" : "مخزون"}
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
