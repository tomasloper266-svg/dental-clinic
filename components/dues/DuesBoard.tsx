"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, RotateCw, UserRound, Users, Wallet } from "lucide-react";
import type { LedgerEntryType } from "@/lib/services/ledger";
import { formatDateCell } from "@/lib/dates";
import { formatDayLabel } from "@/lib/appointment-ui";
import { toCsv, withUtf8Bom } from "@/lib/csv";
import {
  buildDuesRows,
  searchDuesRows,
  sortDuesRows,
  summarizeDues,
  type DuesRowView,
  type DuesSortKey,
} from "@/lib/dues-view";
import { formatDualFromSyp } from "@/lib/currency";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { PanelToolbar, SearchInput, SortSelect } from "@/components/ui/Toolbar";
import { EntityCell } from "@/components/ui/EntityCell";
import { PillAction } from "@/components/ui/TableActions";
import { DualAmount } from "@/components/ui/DualAmount";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import SettlePaymentModal from "@/components/finance/SettlePaymentModal";

// شاشة المستحقات — بنية المرجع: ترويسة كبيرة بتصدير CSV، أربع بطاقات إحصاء
// (الإجمالي، عدد المدينين، الأعلى فردياً، المتوسط)، ثم بطاقة سجل المدينين
// بجدولها: المريض بأفاتاره، الهاتف، إجمالي الفواتير، المسدد، الرصيد المستحق
// بالعملتين معاً، آخر قيد غير مسدد بمدة تأخره، وإجراءَي تسديد/الملف.
// كل الأرقام تُبنى نقياً من قيود الدفتر عبر lib/dues-view.ts.

type ClinicEntryJson = {
  id: string;
  patientId: string;
  type: LedgerEntryType;
  amountSyp: number;
  note: string | null;
  createdAt: string;
  patientName: string;
  patientPhone: string | null;
};

const SORT_OPTIONS: ReadonlyArray<{ value: DuesSortKey; label: string }> = [
  { value: "amount", label: "المبلغ المستحق" },
  { value: "overdue", label: "الأقدم تأخراً" },
  { value: "name", label: "الاسم" },
];

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

function OverdueCell({ row }: { row: DuesRowView }) {
  if (row.lastUnpaidChargeAt === null || row.overdueDays === null) {
    return <span className="text-xs text-warm-400">—</span>;
  }
  return (
    <span className="flex flex-col items-start leading-tight">
      <span className="numeric whitespace-nowrap text-xs text-warm-700">
        {formatDateCell(row.lastUnpaidChargeAt)}
      </span>
      <span className="whitespace-nowrap text-[11px] text-warm-500">
        متأخر <span className="numeric">{row.overdueDays}</span> يوم
      </span>
    </span>
  );
}

type Props = {
  usdRate: number;
};

export default function DuesBoard({ usdRate }: Props) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<ClinicEntryJson[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<DuesSortKey>("amount");
  const [settling, setSettling] = useState<DuesRowView | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/finance/ledger");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { entries: ClinicEntryJson[] };
      setEntries(data.entries);
    } catch {
      setEntries(null);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const allRows = useMemo(
    () => (entries === null ? null : buildDuesRows(entries, new Date())),
    [entries],
  );
  const summary = useMemo(() => summarizeDues(allRows ?? []), [allRows]);
  const rows = useMemo(() => {
    if (allRows === null) return null;
    return sortDuesRows(searchDuesRows(allRows, query), sortKey);
  }, [allRows, query, sortKey]);

  function exportCsv() {
    if (!rows) return;
    const csv = toCsv(
      ["المريض", "الهاتف", "إجمالي الفواتير", "المسدد", "الرصيد المستحق", "آخر قيد غير مسدد", "أيام التأخر"],
      rows.map((row) => [
        row.patientName,
        row.patientPhone ?? "",
        formatDualFromSyp(row.chargesSyp, usdRate),
        formatDualFromSyp(row.paidSyp, usdRate),
        formatDualFromSyp(row.dueSyp, usdRate),
        row.lastUnpaidChargeAt === null
          ? ""
          : formatDateCell(row.lastUnpaidChargeAt),
        row.overdueDays ?? "",
      ]),
    );
    downloadCsv("المستحقات.csv", csv);
    toast("صُدِّر ملف CSV");
  }

  return (
    <div className="w-full">
      <PageHeader
        title="المستحقات"
        description={formatDayLabel(new Date())}
        actions={
          <Button variant="secondary" shape="pill" onClick={exportCsv} disabled={!rows}>
            تصدير CSV
          </Button>
        }
      />

      {/* بطاقات الإحصاء الأربع — كل الأرقام من صفوف المدينين نفسها */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          value={formatDualFromSyp(summary.totalDuesSyp, usdRate)}
          label="إجمالي المستحقات غير المسددة"
          icon={Wallet}
          tone="danger"
        />
        <StatCard
          value={String(summary.debtors)}
          label="عدد المرضى المدينين"
          icon={Users}
        />
        <StatCard
          value={formatDualFromSyp(summary.maxDueSyp, usdRate)}
          label="أعلى رصيد فردي"
          icon={UserRound}
        />
        <StatCard
          value={formatDualFromSyp(summary.avgDueSyp, usdRate)}
          label="متوسط الرصيد"
          icon={CalendarClock}
        />
      </div>

      {loadError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-panel border border-danger-300 bg-danger-50 px-4 py-4"
        >
          <p className="text-xs font-medium text-danger-700">
            تعذر تحميل المستحقات — تحقق من الاتصال ثم أعد المحاولة.
          </p>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            <RotateCw size={14} aria-hidden />
            إعادة المحاولة
          </Button>
        </div>
      ) : (
        <Card>
          <PanelToolbar className="border-b border-warm-200">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="ابحث باسم المريض أو هاتفه…"
              aria-label="بحث في المستحقات"
            />
            <SortSelect
              options={SORT_OPTIONS}
              value={sortKey}
              onChange={setSortKey}
              ariaLabel="ترتيب المستحقات"
            />
          </PanelToolbar>

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
                  title="الدفتر فارغ"
                  description="سجّل قيود الرسوم والدفعات في الدفتر المالي، وستظهر المستحقات هنا تلقائياً."
                  className="border-0 bg-transparent py-10"
                />
              ) : (
                <EmptyState
                  icon={Wallet}
                  title={query.trim() ? "لا نتائج مطابقة" : "لا مستحقات غير مسددة"}
                  description={
                    query.trim()
                      ? "جرّب اسماً أو رقماً أقصر."
                      : "كل المرضى مسددون — لا يوجد أي رصيد مستحق."
                  }
                  className="border-0 bg-transparent py-10"
                />
              )
            ) : (
              <>
                <Table wrapperClassName="border-0 rounded-none">
                  <THead>
                    <TRow>
                      <TH>المريض</TH>
                      <TH className="hidden md:table-cell">الهاتف</TH>
                      <TH className="text-end">إجمالي الفواتير</TH>
                      <TH className="text-end">المسدد</TH>
                      <TH className="text-end">الرصيد المستحق</TH>
                      <TH className="hidden lg:table-cell">آخر قيد غير مسدد</TH>
                      <TH className="w-[12%]">
                        <span className="sr-only">إجراءات</span>
                      </TH>
                    </TRow>
                  </THead>
                  <tbody>
                    {rows.map((row) => (
                      <TRow key={row.patientId}>
                        <TD>
                          <EntityCell
                            name={row.patientName}
                            subtitle={
                              row.lastUnpaidChargeAt
                                ? `آخر قيد غير مسدد ${formatDateCell(row.lastUnpaidChargeAt)}`
                                : undefined
                            }
                          />
                        </TD>
                        <TD className="numeric hidden whitespace-nowrap text-xs text-warm-600 md:table-cell">
                          {row.patientPhone ?? "—"}
                        </TD>
                        <TD className="text-end">
                          <DualAmount syp={row.chargesSyp} usdRate={usdRate} />
                        </TD>
                        <TD className="text-end">
                          <DualAmount syp={row.paidSyp} usdRate={usdRate} />
                        </TD>
                        <TD className="text-end">
                          <DualAmount
                            syp={row.dueSyp}
                            usdRate={usdRate}
                            tone="danger"
                          />
                        </TD>
                        <TD className="hidden lg:table-cell">
                          <OverdueCell row={row} />
                        </TD>
                        <TD>
                          <div className="flex items-center justify-end gap-1.5">
                            <PillAction
                              variant="success"
                              onClick={() => setSettling(row)}
                            >
                              تسديد
                            </PillAction>
                            <PillAction
                              variant="outline"
                              href={`/patients/${row.patientId}`}
                            >
                              الملف
                            </PillAction>
                          </div>
                        </TD>
                      </TRow>
                    ))}
                  </tbody>
                </Table>

                {/* بطاقات الموبايل */}
                <ul className="flex flex-col gap-2 md:hidden">
                  {rows.map((row) => (
                    <li key={row.patientId}>
                      <Card>
                        <div className="flex flex-col gap-2 px-5 py-3">
                          <EntityCell
                            name={row.patientName}
                            subtitle={row.patientPhone ?? undefined}
                          />
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-warm-500">الرصيد المستحق</span>
                            <DualAmount
                              syp={row.dueSyp}
                              usdRate={usdRate}
                              tone="danger"
                            />
                          </div>
                          {row.overdueDays !== null && (
                            <p className="text-[11px] text-warm-500">
                              متأخر <span className="numeric">{row.overdueDays}</span> يوم
                              عن آخر قيد غير مسدد
                            </p>
                          )}
                          <div className="flex items-center justify-end gap-1.5 border-t border-warm-200 pt-2">
                            <PillAction
                              variant="success"
                              onClick={() => setSettling(row)}
                            >
                              تسديد
                            </PillAction>
                            <PillAction
                              variant="outline"
                              href={`/patients/${row.patientId}`}
                            >
                              الملف
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

      <SettlePaymentModal
        open={settling !== null}
        onClose={() => setSettling(null)}
        onSaved={() => void refresh()}
        patientId={settling?.patientId ?? ""}
        patientName={settling?.patientName ?? ""}
        dueSyp={settling?.dueSyp ?? 0}
        usdRate={usdRate}
      />
    </div>
  );
}
