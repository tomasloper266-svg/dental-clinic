"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Plus,
  ReceiptText,
  RotateCw,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { ExpenseCategory } from "@/lib/reports-view";
import { EXPENSE_CATEGORIES } from "@/lib/reports-view";
import { formatDualFromSyp } from "@/lib/currency";
import { DualAmount } from "@/components/ui/DualAmount";
import { toDateInputValue } from "@/lib/dates";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_TONES,
  expenseCategoryLabel,
  summarizeExpensesByCategory,
} from "@/lib/reports-view";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { FilterPills } from "@/components/ui/Toolbar";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import DailyBarsChart from "./DailyBarsChart";

// لوحة التقارير — تقرير الفترة (يومي أو شهري) من واجهة التقارير نفسها،
// ورسم يومي للتحصيل مقابل المصاريف بآخر 14 يوماً، وتوزيع المصاريف على
// الفئات مع تسجيل مصروف جديد. كل الحسابات من خدمة التقارير بلا إعادة تفسير.

type ReportJson = {
  from: string;
  to: string;
  collectedSyp: number;
  expensesSyp: number;
  netSyp: number;
  refundsSyp: number;
};

type SeriesJson = {
  date: string;
  collectedSyp: number;
  expensesSyp: number;
  netSyp: number;
  refundsSyp: number;
}[];

type ExpenseJson = {
  id: string;
  category: string;
  amountSyp: number;
  note: string | null;
  spentAt: string;
};

type Mode = "day" | "month";

const DAY_MS = 24 * 60 * 60 * 1000;

function monthUtcStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

const monthLabelFmt = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  month: "long",
  year: "numeric",
});
const expenseDateFmt = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  day: "numeric",
  month: "short",
});

export default function ReportsBoard({
  initialDate,
  usdRate,
}: {
  initialDate: string;
  usdRate: number;
}) {
  const { toast } = useToast();
  const now = new Date();
  const [mode, setMode] = useState<Mode>("day");
  const [dateValue, setDateValue] = useState(initialDate);
  const [monthCursor, setMonthCursor] = useState({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  });

  const [report, setReport] = useState<ReportJson | null>(null);
  const [reportError, setReportError] = useState(false);
  const [series, setSeries] = useState<SeriesJson | null>(null);
  const [seriesError, setSeriesError] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseJson[] | null>(null);
  const [expenseError, setExpenseError] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [category, setCategory] = useState<ExpenseCategory>("MATERIALS");
  const [amountStr, setAmountStr] = useState("");
  const [spentAt, setSpentAt] = useState(initialDate);
  const [note, setNote] = useState("");

  const refresh = useCallback(async () => {
    setReportError(false);
    setSeriesError(false);
    setExpenseError(false);
    try {
      const seriesEnd = toDateInputValue(new Date());
      const periodQuery =
        mode === "day"
          ? `date=${dateValue}`
          : `year=${monthCursor.year}&month=${monthCursor.month}`;
      const [reportRes, seriesRes, expenseRes] = await Promise.all([
        fetch(`/api/reports?${periodQuery}`),
        fetch(`/api/reports?days=14&endDate=${seriesEnd}`),
        fetch(`/api/expenses?from=${periodFrom(mode, dateValue, monthCursor).toISOString()}&to=${periodTo(mode, dateValue, monthCursor).toISOString()}`),
      ]);
      if (!reportRes.ok) throw new Error();
      setReport(((await reportRes.json()) as { report: ReportJson }).report);
      if (!seriesRes.ok) throw new Error();
      setSeries(((await seriesRes.json()) as { series: SeriesJson }).series);
      if (!expenseRes.ok) throw new Error();
      setExpenses(((await expenseRes.json()) as { expenses: ExpenseJson[] }).expenses);
    } catch {
      // نُظهر كل حالة فشل في مكانها بدل تجميعها في رسالة واحدة
      setReport(null);
      setSeries(null);
      setExpenses(null);
      const probe = await fetch(
        mode === "day"
          ? `/api/reports?date=${dateValue}`
          : `/api/reports?year=${monthCursor.year}&month=${monthCursor.month}`,
      ).catch(() => null);
      if (probe?.ok) {
        setReport(((await probe.json()) as { report: ReportJson }).report);
        setSeriesError(true);
        setExpenseError(true);
      } else {
        setReportError(true);
      }
    }
  }, [mode, dateValue, monthCursor]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categoryTotals = useMemo(
    () => summarizeExpensesByCategory(expenses ?? []),
    [expenses],
  );
  const categoryMax = Math.max(1, ...categoryTotals.map((c) => c.totalSyp));

  async function submitExpense() {
    setFormError(null);
    const amountSyp = Number(amountStr);
    if (!Number.isInteger(amountSyp) || amountSyp <= 0) {
      setFormError("المصروف يجب أن يكون رقماً صحيحاً موجباً");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          amountSyp,
          note: note.trim() || undefined,
          spentAt: `${spentAt}T00:00:00Z`,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFormError(data.error ?? "تعذر تسجيل المصروف، أعد المحاولة");
        return;
      }
      toast("سُجّل المصروف");
      setAddOpen(false);
      setAmountStr("");
      setNote("");
      await refresh();
    } catch {
      setFormError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  }

  const periodLabel =
    mode === "day"
      ? new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(`${dateValue}T00:00:00Z`))
      : monthLabelFmt.format(monthUtcStart(monthCursor.year, monthCursor.month));

  return (
    <>
      <PageHeader
        title="التقارير"
        description="التحصيل مقابل المصاريف وصافي الفترة — كل الأرقام من قيود الدفتر وسجل المصاريف كما هي."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={16} aria-hidden />
            مصروف جديد
          </Button>
        }
      />

      {/* مبدّل الفترة */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPills
          ariaLabel="نوع التقرير"
          value={mode}
          onChange={setMode}
          options={[
            { value: "day", label: "تقرير يوم" },
            { value: "month", label: "تقرير شهر" },
          ]}
        />

        {mode === "day" ? (
          <Input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value || initialDate)}
            aria-label="تاريخ التقرير"
            className="w-auto"
          />
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setMonthCursor((prev) =>
                  prev.month === 1
                    ? { year: prev.year - 1, month: 12 }
                    : { ...prev, month: prev.month - 1 },
                )
              }
              aria-label="الشهر السابق"
            >
              <ChevronRight size={14} aria-hidden />
            </Button>
            <span className="min-w-28 text-center text-sm font-medium text-ink-900">
              {monthLabelFmt.format(
                monthUtcStart(monthCursor.year, monthCursor.month),
              )}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setMonthCursor((prev) =>
                  prev.month === 12
                    ? { year: prev.year + 1, month: 1 }
                    : { ...prev, month: prev.month + 1 },
                )
              }
              aria-label="الشهر التالي"
            >
              <ChevronLeft size={14} aria-hidden />
            </Button>
          </div>
        )}
        <p className="text-xs text-warm-500">{periodLabel}</p>
      </div>

      {/* بطاقات الفترة */}
      {reportError ? (
        <div
          role="alert"
          className="mt-4 flex flex-col items-start gap-2 rounded-panel border border-danger-300 bg-danger-50 px-4 py-4"
        >
          <p className="text-xs font-medium text-danger-700">
            تعذر تحميل التقرير — تحقق من الاتصال ثم أعد المحاولة.
          </p>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            <RotateCw size={14} aria-hidden />
            إعادة المحاولة
          </Button>
        </div>
      ) : report === null ? (
        <div aria-busy="true" className="mt-4 grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-panel bg-surface-sunken" />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            value={formatDualFromSyp(report.collectedSyp, usdRate)}
            label="التحصيل"
            icon={DollarSign}
          />
          <StatCard
            value={formatDualFromSyp(report.expensesSyp, usdRate)}
            label="المصاريف"
            icon={ReceiptText}
          />
          <StatCard
            value={formatDualFromSyp(report.refundsSyp, usdRate)}
            label="الاستردادات"
            icon={TriangleAlert}
            tone="danger"
          />
          <StatCard
            value={formatDualFromSyp(report.netSyp, usdRate)}
            label="صافي الفترة"
            icon={Wallet}
            tone={report.netSyp >= 0 ? "primary" : "danger"}
          />
        </div>
      )}

      {/* الرسم اليومي وتوزيع المصاريف */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>اتجاه آخر 14 يوماً</CardTitle>
          </CardHeader>
          <CardBody>
            {seriesError ? (
              <p role="alert" className="text-xs text-danger-600">
                تعذر تحميل الرسم اليومي.
              </p>
            ) : series === null ? (
              <div
                aria-busy="true"
                className="h-40 animate-pulse rounded-field bg-surface-sunken"
              />
            ) : (
              <DailyBarsChart series={series} usdRate={usdRate} />
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>المصاريف حسب الفئة</CardTitle>
          </CardHeader>
          <CardBody>
            {expenseError ? (
              <p role="alert" className="text-xs text-danger-600">
                تعذر تحميل المصاريف.
              </p>
            ) : expenses === null ? (
              <div
                aria-busy="true"
                className="h-40 animate-pulse rounded-field bg-surface-sunken"
              />
            ) : categoryTotals.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="لا مصاريف في هذه الفترة"
                description="سجّل مصروفاً وسيظهر توزيعه على الفئات هنا."
                action={
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <Plus size={14} aria-hidden />
                    مصروف جديد
                  </Button>
                }
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {categoryTotals.map((c) => (
                  <li key={c.category}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-900">
                        {expenseCategoryLabel(c.category)}
                      </span>
                      <span className="numeric text-warm-600">
                        {formatDualFromSyp(c.totalSyp, usdRate)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{ width: `${(c.totalSyp / categoryMax) * 100}%` }}
                        role="img"
                        aria-label={`${expenseCategoryLabel(c.category)}: ${formatDualFromSyp(c.totalSyp, usdRate)}`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* أحدث المصاريف */}
      {expenses !== null && expenses.length > 0 && (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-ink-900">
            أحدث المصاريف
          </h2>
          <Table>
            <THead>
              <TRow>
                <TH>التاريخ</TH>
                <TH>الفئة</TH>
                <TH>البيان</TH>
                <TH className="text-end">المبلغ</TH>
              </TRow>
            </THead>
            <tbody>
              {expenses.slice(0, 8).map((e) => (
                <TRow key={e.id}>
                  <TD className="numeric whitespace-nowrap text-xs text-warm-600">
                    {expenseDateFmt.format(new Date(e.spentAt))}
                  </TD>
                  <TD>
                    <StatusPill tone={EXPENSE_CATEGORY_TONES[e.category] ?? "neutral"}>
                      {expenseCategoryLabel(e.category)}
                    </StatusPill>
                  </TD>
                  <TD className="max-w-64 text-xs text-warm-600">
                    {e.note ?? "—"}
                  </TD>
                  <TD>
                    <DualAmount syp={e.amountSyp} usdRate={usdRate} />
                  </TD>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* نافذة مصروف جديد */}
      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setFormError(null);
        }}
        title="مصروف جديد"
        footer={
          <>
            <Button loading={busy} onClick={() => void submitExpense()}>
              تسجيل المصروف
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setAddOpen(false);
                setFormError(null);
              }}
              disabled={busy}
            >
              إلغاء
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="الفئة" htmlFor="expense-category">
            <Select
              id="expense-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            >
              {EXPENSE_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {EXPENSE_CATEGORY_LABELS[key]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المبلغ (ل.س)" htmlFor="expense-amount">
            <Input
              id="expense-amount"
              type="number"
              inputMode="numeric"
              min={1}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="مثال: 150000"
            />
          </Field>
          <Field label="تاريخ المصروف" htmlFor="expense-date">
            <Input
              id="expense-date"
              type="date"
              value={spentAt}
              onChange={(e) => setSpentAt(e.target.value || initialDate)}
            />
          </Field>
          <Field label="البيان (اختياري)" htmlFor="expense-note">
            <Textarea
              id="expense-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="تفاصيل المصروف…"
              rows={2}
            />
          </Field>
          {formError && (
            <p role="alert" className="text-xs text-danger-600">
              {formError}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

/** بداية نطاق الفترة (UTC) — يوم محدد أو أول شهر */
function periodFrom(mode: Mode, dateValue: string, cursor: { year: number; month: number }): Date {
  return mode === "day"
    ? new Date(`${dateValue}T00:00:00Z`)
    : monthUtcStart(cursor.year, cursor.month);
}

/** نهاية نطاق الفترة الحصرية (UTC) */
function periodTo(mode: Mode, dateValue: string, cursor: { year: number; month: number }): Date {
  if (mode === "day") {
    return new Date(new Date(`${dateValue}T00:00:00Z`).getTime() + DAY_MS);
  }
  return monthUtcStart(
    cursor.month === 12 ? cursor.year + 1 : cursor.year,
    cursor.month === 12 ? 1 : cursor.month + 1,
  );
}
