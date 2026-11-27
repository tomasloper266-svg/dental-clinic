"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CircleDollarSign,
  DollarSign,
  Info,
  RotateCw,
  Users,
  Wallet,
} from "lucide-react";
import { useMoney } from "@/components/ui/CurrencyContext";
import { formatDateCell, formatWeekdayDateCell } from "@/lib/dates";
import { toCsv, withUtf8Bom } from "@/lib/csv";
import { buildDuesRows, sortDuesRows, type DuesRowView } from "@/lib/dues-view";
import { deriveClinicInvoices } from "@/lib/invoices-view";
import type { ClinicLedgerEntryDto } from "@/lib/services/ledger";
import type { PatientDto } from "@/lib/services/patients";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { PillAction } from "@/components/ui/TableActions";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import RecordPaymentModal from "@/components/finance/RecordPaymentModal";

// شاشة المستحقات — على شكل المرجع: ترويسة بتصدير CSV، أربع بطاقات إحصاء
// (الإجمالي بالأحمر، عدد المرضى، أعلى رصيد فردي، متوسط الرصيد)، شريط ملاحظة،
// ثم جدول المدينين: المريض بشارة مرقّمة وسطر «آخر فاتورة»، الهاتف، إجمالي
// الفواتير، المسدد، الفرقة المتبقية بالأحمر، آخر دفعة، وإجراءَي تسديد/الملف.
// كل الأرقام تُبنى نقياً من قيود الدفتر عبر lib/dues-view.ts، والتسديد عبر
// نموذج «تسديد دفعة» نفسه المشترك مع صفحة الفواتير (RecordPaymentModal).

type ClinicEntryJson = ClinicLedgerEntryDto & { createdAt: string };

type PayState = { patientId: string; dueUsd: number } | null;

/** تنزيل نص CSV من المتصفح — إلحاق BOM ليُقرأ العربية في Excel */
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([withUtf8Bom(csv)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** خلية المريض بشارة مرقّمة ذهبية وسطر «آخر فاتورة» — على شكل المرجع */
function PatientCell({ row, index }: { row: DuesRowView; index: number }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="numeric grid size-8 shrink-0 place-items-center rounded-full border border-warning-500/50 bg-warning-500/10 text-xs font-bold text-warning-600"
      >
        {index + 1}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink-900">
          {row.patientName}
        </span>
        {row.lastChargeAt && (
          <span className="numeric block truncate text-xs text-warning-600">
            {t("dues.lastInvoice")} {formatDateCell(row.lastChargeAt)}
          </span>
        )}
      </span>
    </div>
  );
}

export default function DuesBoard({ usdRate }: { usdRate: number }) {
  const { t } = useI18n();
  const money = useMoney();
  const { toast } = useToast();
  const [entries, setEntries] = useState<ClinicEntryJson[] | null>(null);
  const [patients, setPatients] = useState<PatientDto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [payState, setPayState] = useState<PayState>(null);

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      const [entriesRes, patientsRes] = await Promise.all([
        fetch("/api/finance/ledger"),
        fetch("/api/patients"),
      ]);
      if (!entriesRes.ok || !patientsRes.ok) throw new Error();
      const entriesData = (await entriesRes.json()) as {
        entries: ClinicEntryJson[];
      };
      const patientsData = (await patientsRes.json()) as {
        patients: PatientDto[];
      };
      setEntries(entriesData.entries);
      setPatients(patientsData.patients);
    } catch {
      setEntries(null);
      setPatients(null);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo(
    () =>
      entries === null ? null : sortDuesRows(buildDuesRows(entries, new Date()), "amount"),
    [entries],
  );

  const summary = useMemo(() => {
    if (rows === null) return null;
    let totalDuesUsd = 0;
    let maxDueUsd = 0;
    for (const row of rows) {
      totalDuesUsd += row.dueUsd;
      if (row.dueUsd > maxDueUsd) maxDueUsd = row.dueUsd;
    }
    return {
      totalDuesUsd,
      debtors: rows.length,
      maxDueUsd,
      avgDueUsd: rows.length === 0 ? 0 : Math.round(totalDuesUsd / rows.length),
    };
  }, [rows]);

  // كل فواتير العيادة — لبناء خيارات «على الفاتورة» في نموذج التسديد
  const invoices = useMemo(
    () => (entries === null ? null : deriveClinicInvoices(entries)),
    [entries],
  );

  function exportCsv() {
    if (!rows) return;
    const csv = toCsv(
      [t("common.patient"), t("common.phoneNumber"), t("invoices.totalInvoices"), t("common.paid"), t("dues.remainingSplit"), t("dues.lastPayment")],
      rows.map((row) => [
        row.patientName,
        row.patientPhone ?? "",
        money(row.chargesUsd),
        money(row.paidUsd),
        money(row.dueUsd),
        row.lastPaymentAt === null ? "" : formatDateCell(row.lastPaymentAt),
      ]),
    );
    downloadCsv(t("dues.csvName"), csv);
    toast(t("settings.csvExported"));
  }

  return (
    <div className="w-full">
      <PageHeader
        title={t("common.dues")}
        description={formatWeekdayDateCell(new Date())}
        actions={
          <Button variant="secondary" shape="pill" onClick={exportCsv} disabled={!rows}>
            {t("settings.exportCsv")}
          </Button>
        }
      />

      {/* بطاقات الإحصاء الأربع — كل الأرقام من صفوف المدينين نفسها */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          value={
            summary === null
              ? "—"
              : money(summary.totalDuesUsd)
          }
          label={t("invoices.totalOutstanding")}
          icon={CircleDollarSign}
          tone="danger"
        />
        <StatCard
          value={summary === null ? "—" : String(summary.debtors)}
          label={t("dues.patientsWithBalance")}
          icon={Users}
          iconClassName="bg-warning-500/10 text-warning-600"
        />
        <StatCard
          value={
            summary === null
              ? "—"
              : money(summary.maxDueUsd)
          }
          label={t("dues.highestIndividual")}
          icon={DollarSign}
          iconClassName="bg-steel-500/10 text-steel-600"
        />
        <StatCard
          value={
            summary === null
              ? "—"
              : money(summary.avgDueUsd)
          }
          label={t("dues.avgBalance")}
          icon={BarChart3}
          iconClassName="bg-primary-500/10 text-primary-700"
        />
      </div>

      {loadError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-panel border border-danger-300 bg-danger-50 px-4 py-4"
        >
          <p className="text-xs font-medium text-danger-700">
            {t("dues.loadFailed")}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            <RotateCw size={14} aria-hidden />
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <Card>
          {/* شريط الملاحظة أعلى الجدول — على شكل المرجع */}
          <div className="flex items-center gap-2 border-b border-warm-200 px-5 py-3">
            <span
              aria-hidden
              className="grid size-6 shrink-0 place-items-center rounded-[8px] bg-warning-500/10 text-warning-600"
            >
              <Info size={14} />
            </span>
            <p className="text-xs text-warm-600">
              {t("dues.subtitle")}
            </p>
          </div>

          <div className="px-5 pb-5 pt-4">
            {rows === null ? (
              <div aria-busy="true" className="flex flex-col gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-11 animate-pulse rounded-field bg-surface-sunken"
                  />
                ))}
              </div>
            ) : rows.length === 0 ? (
              entries !== null && entries.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title={t("finance.ledgerEmpty")}
                  description={t("finance.ledgerHint")}
                  className="border-0 bg-transparent py-10"
                />
              ) : (
                <EmptyState
                  icon={Wallet}
                  title={t("dues.noneOutstanding")}
                  description={t("dues.allSettled")}
                  className="border-0 bg-transparent py-10"
                />
              )
            ) : (
              <>
                <Table wrapperClassName="border-0 rounded-none">
                  <THead>
                    <TRow>
                      <TH>{t("common.patient")}</TH>
                      <TH className="hidden md:table-cell">{t("common.phoneNumber")}</TH>
                      <TH className="text-end">{t("invoices.totalInvoices")}</TH>
                      <TH className="text-end">{t("common.paid")}</TH>
                      <TH className="text-end text-danger-600">{t("dues.remainingSplit")}</TH>
                      <TH className="hidden lg:table-cell">{t("dues.lastPayment")}</TH>
                      <TH className="w-[12%]">
                        <span className="sr-only">{t("common.actions")}</span>
                      </TH>
                    </TRow>
                  </THead>
                  <tbody>
                    {rows.map((row, index) => (
                      <TRow key={row.patientId}>
                        <TD>
                          <PatientCell row={row} index={index} />
                        </TD>
                        <TD className="numeric hidden whitespace-nowrap text-xs text-warning-600 md:table-cell">
                          {row.patientPhone ?? "—"}
                        </TD>
                        <TD className="numeric whitespace-nowrap text-end">
                          {money(row.chargesUsd)}
                        </TD>
                        <TD className="numeric whitespace-nowrap text-end">
                          {money(row.paidUsd)}
                        </TD>
                        <TD className="numeric whitespace-nowrap text-end font-semibold text-danger-600">
                          {money(row.dueUsd)}
                        </TD>
                        <TD className="numeric hidden whitespace-nowrap text-xs text-warning-600 lg:table-cell">
                          {row.lastPaymentAt === null
                            ? "—"
                            : formatDateCell(row.lastPaymentAt)}
                        </TD>
                        <TD>
                          <div className="flex items-center justify-end gap-1.5">
                            <PillAction
                              variant="successSoft"
                              className="border border-primary-500/40"
                              onClick={() =>
                                setPayState({
                                  patientId: row.patientId,
                                  dueUsd: row.dueUsd,
                                })
                              }
                            >
                              {t("common.settle")}
                            </PillAction>
                            <PillAction
                              variant="outline"
                              href={`/patients/${row.patientId}`}
                            >
                              {t("common.file")}
                            </PillAction>
                          </div>
                        </TD>
                      </TRow>
                    ))}
                  </tbody>
                </Table>

                {/* بطاقات الموبايل */}
                <ul className="flex flex-col gap-2 md:hidden">
                  {rows.map((row, index) => (
                    <li key={row.patientId}>
                      <Card>
                        <div className="flex flex-col gap-2 px-5 py-3">
                          <PatientCell row={row} index={index} />
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-warm-500">{t("dues.remainingSplit")}</span>
                            <span className="numeric font-semibold text-danger-600">
                              {money(row.dueUsd)}
                            </span>
                          </div>
                          {row.lastPaymentAt !== null && (
                            <p className="numeric text-[11px] text-warm-500">
                              {t("dues.lastPayment")} {formatDateCell(row.lastPaymentAt)}
                            </p>
                          )}
                          <div className="flex items-center justify-end gap-1.5 border-t border-warm-200 pt-2">
                            <PillAction
                              variant="successSoft"
                              className="border border-primary-500/40"
                              onClick={() =>
                                setPayState({
                                  patientId: row.patientId,
                                  dueUsd: row.dueUsd,
                                })
                              }
                            >
                              {t("common.settle")}
                            </PillAction>
                            <PillAction
                              variant="outline"
                              href={`/patients/${row.patientId}`}
                            >
                              {t("common.file")}
                            </PillAction>
                          </div>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>
      )}

      {payState && patients && invoices && (
        <RecordPaymentModal
          onClose={() => setPayState(null)}
          onSaved={() => {
            setPayState(null);
            void refresh();
          }}
          usdRate={usdRate}
          patients={patients}
          invoices={invoices}
          initialPatientId={payState.patientId}
          initialDueUsd={payState.dueUsd}
        />
      )}
    </div>
  );
}
