"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Calendar,
  DollarSign,
  Info,
  ReceiptText,
  RotateCw,
  TriangleAlert,
  User,
  UserPlus,
  Wallet,
} from "lucide-react";
import { useMoney } from "@/components/ui/CurrencyContext";
import { downloadCsv } from "@/lib/csv";
import {
  PERIOD_PRESET_OPTIONS,
  buildPeriodCsv,
  monthLabel,
  presetRange,
  type DayRange,
  type ReportsPeriodSelection,
  type ReportsPeriodSummaryJson,
} from "@/lib/reports-period-view";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { FilterPills } from "@/components/ui/Toolbar";
import { Input } from "@/components/ui/Field";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import VerticalBarsChart from "./VerticalBarsChart";
import AppointmentOutcomesDonut from "./AppointmentOutcomesDonut";
import HorizontalRevenueBars from "./HorizontalRevenueBars";

// لوحة التقارير — تقرير فترة كامل على شكل المرجع: خيارات فترة جاهزة
// (الكل، آخر 30 يوم، 3 و6 أشهر، السنة كاملة) ومدى مخصص من/إلى يعيد حساب
// كل البطاقات والرسوم، وتصدير CSV لبيانات الفترة نفسها. كل الأرقام من
// خدمة ملخص الفترة بلا إعادة تفسير.

const usdFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

/** بطاقة عنوان رسم بأيقونة ذهبية — شكل موحّد لكل بطاقات التقارير */
function ChartTitle({
  icon: Icon,
  children,
}: {
  icon: typeof BarChart3;
  children: React.ReactNode;
}) {
  return (
    <CardTitle className="flex items-center gap-2">
      <Icon size={16} className="text-warning-600" aria-hidden />
      {children}
    </CardTitle>
  );
}

/** حقل مدى التاريخ المخصص — تسمية صغيرة فوق منتقي التقويم */
function RangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-warm-500">{label}</span>
      <Input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value || value)}
        aria-label={label}
        className="w-36 bg-surface-sunken text-xs"
      />
    </label>
  );
}

export default function ReportsBoard({
  todayValue,
  todayLabel,
  usdRate,
}: {
  todayValue: string;
  todayLabel: string;
  usdRate: number;
}) {
  const { t } = useI18n();
  // الفترة تبدأ بلا حدود — أول جلب بلا معاملات يعيد فترة «الكل» مع
  // أقدم يوم حركة (rangeStart) أساس الخيارات الجاهزة.
  const [range, setRange] = useState<DayRange | null>(null);
  const [selection, setSelection] = useState<ReportsPeriodSelection>("all");
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReportsPeriodSummaryJson | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rangeInvalid, setRangeInvalid] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoadError(false);
    try {
      const url =
        range === null
          ? "/api/reports/summary"
          : `/api/reports/summary?from=${range.from}&to=${range.to}`;
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { summary: ReportsPeriodSummaryJson };
      setSummary(data.summary);
      setRangeStart(data.summary.rangeStart);
      // أول جلب: تثبيت حدود «الكل» على ما أعادته الخدمة فعلاً
      setRange((current) => current ?? { from: data.summary.from, to: data.summary.to });
    } catch {
      if (signal?.aborted) return;
      setSummary(null);
      setLoadError(true);
    }
  }, [range]);

  useEffect(() => {
    // نطاق مخصص غير صالح: نُظهر التنبيه دون جلب — آخر بيانات صالحة تبقى معروضة
    if (range !== null && range.from > range.to) {
      setRangeInvalid(true);
      return;
    }
    setRangeInvalid(false);
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh, range]);

  function selectPreset(value: ReportsPeriodSelection) {
    if (value === "custom") return;
    setSelection(value);
    setRange(presetRange(value, todayValue, rangeStart ?? todayValue));
  }

  function editRange(field: "from" | "to", value: string) {
    setSelection("custom");
    setRange((current) => ({
      from: field === "from" ? value : (current?.from ?? value),
      to: field === "to" ? value : (current?.to ?? value),
    }));
  }

  function exportCsv() {
    if (!summary) return;
    downloadCsv(t("reports.periodCsvName"), buildPeriodCsv(summary, usdRate));
  }

  // المبالغ المعروضة تمر عبر سياق العملة — USD/SYP من الإعدادات يغيّرها كلها.
  const usd = useMoney();
  const avgInvoiceUsd =
    summary && summary.invoiceCount > 0
      ? Math.round(summary.totalChargesUsd / summary.invoiceCount)
      : 0;
  // متوسط الدفعة لتعريف «محصّل الفترة» — التعريفان منفصلان لا يجتمعان في رقم
  const avgPaymentUsd =
    summary && summary.paymentCount > 0
      ? Math.round(summary.totalPaymentsUsd / summary.paymentCount)
      : 0;

  return (
    <>
      <PageHeader title={t("common.reports")} description={todayLabel} />

      {/* شريط الأدوات — المدى المخصص والحِبّات يميناً وزر التصدير يساراً */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <RangeField
            label={t("common.from")}
            value={range?.from ?? todayValue}
            onChange={(value) => editRange("from", value)}
          />
          <RangeField
            label={t("common.to")}
            value={range?.to ?? todayValue}
            onChange={(value) => editRange("to", value)}
          />
          <FilterPills
            ariaLabel={t("reports.period")}
            accent="warning"
            value={selection}
            onChange={selectPreset}
            options={PERIOD_PRESET_OPTIONS}
            className="pb-1"
          />
        </div>
        <Button
          variant="secondary"
          shape="pill"
          onClick={exportCsv}
          disabled={!summary}
        >
          {t("reports.exportCsv")}
        </Button>
      </div>
      {rangeInvalid && (
        <p role="alert" className="mt-2 text-xs text-danger-600">
          {t("reports.fromBeforeTo")}
        </p>
      )}

      {/* بطاقات الإحصاء */}
      {loadError ? (
        <div
          role="alert"
          className="mt-4 flex flex-col items-start gap-2 rounded-panel border border-danger-300 bg-danger-50 px-4 py-4"
        >
          <p className="text-xs font-medium text-danger-700">
            {t("reports.loadFailed")}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            <RotateCw size={14} aria-hidden />
            {t("common.retry")}
          </Button>
        </div>
      ) : summary === null ? (
        <div aria-busy="true" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-panel bg-surface-sunken"
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            value={usd(summary.totalChargesUsd)}
            label={t("invoices.totalInvoices")}
            icon={DollarSign}
            valueClassName="text-warning-600"
          />
          <StatCard
            value={String(summary.invoiceCount)}
            label={t("invoices.issued")}
            subLabel={t("reports.averageLabel", { amount: usd(avgInvoiceUsd) })}
            icon={ReceiptText}
            iconClassName="bg-warning-500/10 text-warning-600"
            className="border-warning-500/50"
          />
          <StatCard
            value={usd(summary.totalPaymentsUsd)}
            label={t("reports.periodCollected")}
            subLabel={t("reports.averagePayments", { amount: usd(avgPaymentUsd), count: summary.paymentCount })}
            icon={Wallet}
          />
          <StatCard
            value={String(summary.paymentCount)}
            label={t("finance.paymentReceived")}
            icon={DollarSign}
            iconClassName="bg-ink-600/10 text-ink-700"
          />
          <StatCard
            value={usd(summary.outstandingUsd)}
            label={t("dues.currentDues")}
            icon={TriangleAlert}
            tone="danger"
          />
        </div>
      )}

      {/* الرسوم والقوائم — على شكل المرجع: البطاقة العريضة يميناً والضيقة يساراً */}
      {summary !== null && (
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <ChartTitle icon={BarChart3}>{t("reports.monthlyRevenueInPeriod")}</ChartTitle>
            </CardHeader>
            <CardBody>
              {summary.monthlyRevenue.some((month) => month.chargesUsd > 0) ? (
                <VerticalBarsChart
                  ariaLabel={t("reports.monthlyRevenueInPeriod")}
                  points={summary.monthlyRevenue.map((month) => ({
                    label: monthLabel(month.month),
                    value: Math.round(month.chargesUsd * 100) / 100,
                    valueText: usdFormatter.format(
                      Math.round(month.chargesUsd * 100) / 100,
                    ),
                    title: `${monthLabel(month.month)}: ${usd(month.chargesUsd)}`,
                  }))}
                />
              ) : (
                <EmptyState icon={BarChart3} title={t("reports.noRevenue")} />
              )}
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <ChartTitle icon={Calendar}>{t("reports.appointmentOutcomes")}</ChartTitle>
            </CardHeader>
            <CardBody>
              <AppointmentOutcomesDonut outcomes={summary.appointmentOutcomes} />
            </CardBody>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <ChartTitle icon={User}>{t("reports.revenueByDoctorInvoices")}</ChartTitle>
            </CardHeader>
            <CardBody>
              {summary.revenueByDoctor.length > 0 ? (
                <HorizontalRevenueBars
                  rows={summary.revenueByDoctor.map((row) => ({
                    label: row.doctor,
                    value: row.chargesUsd,
                  }))}
                  amountText={usd}
                />
              ) : (
                <EmptyState icon={User} title={t("invoices.noneInPeriod")} />
              )}
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <ChartTitle icon={BarChart3}>{t("reports.revenueByTreatment")}</ChartTitle>
            </CardHeader>
            <CardBody>
              {summary.revenueByProcedure.length > 0 ? (
                <HorizontalRevenueBars
                  rows={summary.revenueByProcedure.map((row) => ({
                    label: row.procedure,
                    value: row.chargesUsd,
                  }))}
                  amountText={usd}
                />
              ) : (
                <EmptyState icon={BarChart3} title={t("invoices.noneInPeriod")} />
              )}
            </CardBody>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <ChartTitle icon={UserPlus}>{t("reports.patientGrowth")}</ChartTitle>
            </CardHeader>
            <CardBody>
              {summary.patientGrowth.some((month) => month.count > 0) ? (
                <VerticalBarsChart
                  ariaLabel={t("reports.patientGrowthLatestLeft")}
                  points={[...summary.patientGrowth]
                    .reverse()
                    .map((month) => ({
                      label: monthLabel(month.month),
                      value: month.count,
                      valueText: String(month.count),
                      title: t("reports.newPatientsTitle", { month: monthLabel(month.month), count: month.count }),
                    }))}
                />
              ) : (
                <EmptyState icon={UserPlus} title={t("reports.noRegistrations")} />
              )}
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <ChartTitle icon={Info}>{t("reports.topPatients")}</ChartTitle>
            </CardHeader>
            <Table>
              <THead>
                <TRow>
                  <TH>{t("common.patient")}</TH>
                  <TH className="text-start text-warning-700">{t("common.total")}</TH>
                </TRow>
              </THead>
              <tbody>
                {summary.topPatients.length > 0 ? (
                  summary.topPatients.map((patient) => (
                    <TRow key={patient.patientId}>
                      <TD className="text-sm">{patient.patientName}</TD>
                      <TD className="numeric text-sm font-semibold text-warning-600">
                        {usd(patient.chargesUsd)}
                      </TD>
                    </TRow>
                  ))
                ) : (
                  <TRow>
                    <TD colSpan={2}>
                      <EmptyState icon={Info} title={t("invoices.noneInPeriod")} />
                    </TD>
                  </TRow>
                )}
              </tbody>
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}
