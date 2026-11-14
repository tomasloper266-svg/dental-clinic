"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CircleDollarSign,
  Eye,
  FileText,
  Plus,
  RotateCw,
  Search,
  Trash2,
} from "lucide-react";
import { formatDateCell, formatWeekdayDateCell } from "@/lib/dates";
import { toCsv, withUtf8Bom } from "@/lib/csv";
import { useMoney } from "@/components/ui/CurrencyContext";
import {
  deriveClinicInvoices,
  filterInvoicesByStatus,
  INVOICE_FILTER_LABELS,
  INVOICE_FILTER_ORDER,
  INVOICE_STATUS_TONE,
  searchInvoices,
  summarizeInvoices,
  type ClinicInvoiceRow,
  type InvoiceFilter,
} from "@/lib/invoices-view";
import type { ClinicLedgerEntryDto } from "@/lib/services/ledger";
import type { PatientDto } from "@/lib/services/patients";
import type { PlanItemDto } from "@/lib/services/treatment-plan";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import {
  ExportButton,
  FilterPills,
  PanelToolbar,
  SearchInput,
} from "@/components/ui/Toolbar";
import { EntityCell } from "@/components/ui/EntityCell";
import { IconAction, PillAction } from "@/components/ui/TableActions";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import InvoiceModal from "@/components/dental/InvoiceModal";
import RecordPaymentModal from "@/components/finance/RecordPaymentModal";
import NewInvoiceModal from "@/components/finance/NewInvoiceModal";

// صفحة «الفواتير والمدفوعات» — الفاتورة هنا قيد رسوم في الدفتر المالي (لا
// نموذج مستقل)، والتجميع والترقيم والحالة كلها مشتقة عبر lib/invoices-view.
// كل الأزرار موصولة بمسارات الدفتر الحقيقية: التسديد قيد دفعة، والإصدار
// قيود رسوم، والحذف مسموح فقط لفاتورة لم يُخصص لها شيء (409 لغيرها).

type ClinicEntryJson = ClinicLedgerEntryDto & { createdAt: string };

type DetailState = { row: ClinicInvoiceRow };
type PayState = { patientId: string | null; chargeId: string | null };

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

/** هل أُخصص للفاتورة دفعات أو خصم — يمنع حذفها من الواجهة مسبقاً */
function invoiceHasAllocation(row: ClinicInvoiceRow): boolean {
  return row.paidSyp + row.discountSyp > 0;
}

export default function InvoicesBoard({ usdRate }: { usdRate: number }) {
  const money = useMoney();
  const { toast } = useToast();
  const [entries, setEntries] = useState<ClinicEntryJson[] | null>(null);
  const [patients, setPatients] = useState<PatientDto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InvoiceFilter>("ALL");
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [detailPlanItems, setDetailPlanItems] = useState<PlanItemDto[] | null>(
    null,
  );
  const [payState, setPayState] = useState<PayState | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [deletingChargeId, setDeletingChargeId] = useState<string | null>(null);

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

  // كل فواتير العيادة — مجمعة لكل مريض ليبقى الترقيم INV-<سنة>-<تسلسل> ثابتاً
  const allInvoices = useMemo(
    () => (entries === null ? null : deriveClinicInvoices(entries)),
    [entries],
  );

  const filterCounts = useMemo(() => {
    const counts: Record<InvoiceFilter, number> = {
      ALL: allInvoices?.length ?? 0,
      UNPAID: 0,
      PARTIAL: 0,
      PAID: 0,
    };
    for (const row of allInvoices ?? []) counts[row.status] += 1;
    return counts;
  }, [allInvoices]);

  const filtered = useMemo(() => {
    if (allInvoices === null) return null;
    return searchInvoices(
      filterInvoicesByStatus(allInvoices, filter),
      search,
    );
  }, [allInvoices, filter, search]);

  const summary = useMemo(
    () => summarizeInvoices(filtered ?? []),
    [filtered],
  );

  const resetFilters = useCallback(() => {
    setSearch("");
    setFilter("ALL");
  }, []);

  const filtersDirty = search.trim() !== "" || filter !== "ALL";

  function exportCsv() {
    if (!filtered) return;
    const csv = toCsv(
      ["الرقم", "المريض", "التاريخ", "الإجمالي", "المدفوع", "المتبقي", "الحالة"],
      filtered.map((row) => [
        row.number,
        row.patientName,
        formatDateCell(row.date),
        money(row.totalSyp),
        money(row.paidSyp),
        money(row.remainingSyp),
        INVOICE_FILTER_LABELS[row.status],
      ]),
    );
    downloadCsv("الفواتير.csv", csv);
    toast("صُدّر ملف الفواتير");
  }

  // بنود المخطط العلاجي للمريض في نافذة التفاصيل — لعرض حالة البند
  useEffect(() => {
    if (!detail) {
      setDetailPlanItems(null);
      return;
    }
    let cancelled = false;
    setDetailPlanItems(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/patients/${encodeURIComponent(detail.row.patientId)}/treatment-plan`,
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { items: PlanItemDto[] };
        if (!cancelled) setDetailPlanItems(data.items);
      } catch {
        if (!cancelled) setDetailPlanItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detail]);

  const detailCharges = useMemo(() => {
    if (!detail || !entries) return [];
    return entries.filter((entry) => entry.id === detail.row.chargeId);
  }, [detail, entries]);

  const detailPatient = useMemo(
    () => patients?.find((p) => p.id === detail?.row.patientId) ?? null,
    [patients, detail],
  );

  async function deleteInvoice(row: ClinicInvoiceRow) {
    if (!entries || invoiceHasAllocation(row)) return;
    setDeletingChargeId(row.chargeId);
    try {
      const res = await fetch(
        `/api/patients/${encodeURIComponent(row.patientId)}/ledger/${encodeURIComponent(row.chargeId)}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "تعذر حذف الفاتورة", "danger");
        return;
      }
      toast("حُذفت الفاتورة من الدفتر");
      if (detail?.row.chargeId === row.chargeId) setDetail(null);
      await refresh();
    } catch {
      toast("تعذر الاتصال بالخادم، حاول مرة أخرى", "danger");
    } finally {
      setDeletingChargeId(null);
    }
  }

  const rows = filtered;
  const loading = rows === null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="الفواتير والمدفوعات"
        description={formatWeekdayDateCell(new Date())}
        actions={
          <Button
            variant="gold"
            shape="pill"
            onClick={() => setNewOpen(true)}
            disabled={patients !== null && patients.length === 0}
          >
            <Plus size={16} aria-hidden />
            فاتورة جديدة
          </Button>
        }
      />

      <Card>
        <PanelToolbar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="ابحث برقم الفاتورة أو اسم المريض"
            aria-label="ابحث في الفواتير"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <FilterPills
              accent="warning"
              ariaLabel="تصفية الفواتير بالحالة"
              value={filter}
              onChange={setFilter}
              options={INVOICE_FILTER_ORDER.map((value) => ({
                value,
                label: INVOICE_FILTER_LABELS[value],
                count: filterCounts[value],
              }))}
            />
            <ExportButton onClick={exportCsv} disabled={loading} />
            {filtersDirty && (
              <IconAction
                icon={Trash2}
                label="مسح التصفية"
                onClick={resetFilters}
              />
            )}
          </div>
        </PanelToolbar>

        {/* بطاقات الإحصاء الثلاث — مجاميع الصفوف بعد الفلاتر */}
        <div className="grid gap-3 px-5 pt-1 sm:grid-cols-3">
          <StatCard
            value={String(summary.count)}
            label="فاتورة (بعد الفلاتر)"
            icon={FileText}
            iconClassName="bg-warning-500/10 text-warning-600"
          />
          <StatCard
            value={money(summary.totalSyp)}
            label="إجمالي الإصدار"
            icon={CircleDollarSign}
            valueClassName="text-warning-600"
            iconClassName="bg-primary-500/10 text-primary-700"
          />
          <StatCard
            value={money(summary.remainingSyp)}
            label="المتبقي عليها"
            icon={AlertTriangle}
            tone="danger"
          />
        </div>

        {loadError ? (
          <EmptyState
            icon={RotateCw}
            title="تعذر تحميل الفواتير"
            description="تحقق من الاتصال ثم أعد المحاولة"
            action={
              <Button variant="secondary" onClick={() => void refresh()}>
                <RotateCw size={15} aria-hidden />
                إعادة المحاولة
              </Button>
            }
          />
        ) : loading ? (
          <div className="flex flex-col gap-2 p-5" aria-busy>
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="bg-surface-sunken h-10 animate-pulse rounded-field"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          filtersDirty ? (
            <EmptyState
              icon={Search}
              title="لا فواتير مطابقة للتصفية"
              description="عدّل كلمة البحث أو الحالة المختارة"
              action={
                <Button variant="secondary" onClick={resetFilters}>
                  مسح التصفية
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="لا فواتير بعد"
              description="أصدر أول فاتورة من زر «فاتورة جديدة»"
            />
          )
        ) : (
          <Table>
            <THead>
              <TRow>
                <TH>الرقم</TH>
                <TH>المريض</TH>
                <TH>التاريخ</TH>
                <TH>الإجمالي</TH>
                <TH>المدفوع</TH>
                <TH>المتبقي</TH>
                <TH>الحالة</TH>
                <TH>إجراءات</TH>
              </TRow>
            </THead>
            <tbody>
              {rows.map((row) => {
                const hasAllocation = invoiceHasAllocation(row);
                return (
                  <TRow
                    key={row.chargeId}
                    className="cursor-pointer"
                    onClick={() => setDetail({ row })}
                  >
                    <TD className="numeric text-warning-600 font-semibold">
                      {row.number}
                    </TD>
                    <TD>
                      <EntityCell
                        name={row.patientName}
                        subtitle={row.patientPhone}
                      />
                    </TD>
                    <TD className="numeric">{formatDateCell(row.date)}</TD>
                    <TD className="numeric">
                      {money(row.totalSyp)}
                    </TD>
                    <TD className="numeric text-success-600">
                      {money(row.paidSyp)}
                    </TD>
                    <TD
                      className={cn(
                        "numeric font-semibold",
                        row.remainingSyp > 0 ? "text-danger-600" : "text-ink-900",
                      )}
                    >
                      {money(row.remainingSyp)}
                    </TD>
                    <TD>
                      <StatusPill tone={INVOICE_STATUS_TONE[row.status]}>
                        {INVOICE_FILTER_LABELS[row.status]}
                      </StatusPill>
                    </TD>
                    <TD>
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                        role="presentation"
                      >
                        <PillAction
                          variant="gold"
                          onClick={() => setDetail({ row })}
                        >
                          <Eye size={13} aria-hidden />
                          عرض
                        </PillAction>
                        <PillAction
                          variant="successSoft"
                          onClick={() =>
                            setPayState({
                              patientId: row.patientId,
                              chargeId: row.chargeId,
                            })
                          }
                          disabled={row.remainingSyp <= 0}
                          title={
                            row.remainingSyp <= 0
                              ? "الفاتورة مسددة بالكامل"
                              : undefined
                          }
                        >
                          تسديد
                        </PillAction>
                        <IconAction
                          icon={Trash2}
                          label={
                            hasAllocation
                              ? "لا يمكن حذف فاتورة عليها دفعات أو خصم"
                              : "حذف الفاتورة"
                          }
                          disabled={hasAllocation || deletingChargeId === row.chargeId}
                          onClick={() => void deleteInvoice(row)}
                        />
                      </div>
                    </TD>
                  </TRow>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {detail && (
        <InvoiceModal
          open
          onClose={() => setDetail(null)}
          patientId={detail.row.patientId}
          patientName={detail.row.patientName}
          invoice={detail.row}
          charges={detailCharges}
          planItems={detailPlanItems ?? []}
          usdRate={usdRate}
          companionLine={
            detailPatient?.emergencyContacts
              ? `المرافق: ${detailPatient.emergencyContacts}`
              : null
          }
          onLedgerChanged={() => void refresh()}
          onSettle={() => {
            const row = detail.row;
            setDetail(null);
            setPayState({ patientId: row.patientId, chargeId: row.chargeId });
          }}
        />
      )}

      {payState && patients && (
        <RecordPaymentModal
          onClose={() => setPayState(null)}
          onSaved={() => {
            setPayState(null);
            void refresh();
          }}
          usdRate={usdRate}
          patients={patients}
          invoices={allInvoices ?? []}
          initialPatientId={payState.patientId}
          initialChargeId={payState.chargeId}
        />
      )}

      {newOpen && patients && (
        <NewInvoiceModal
          onClose={() => setNewOpen(false)}
          onIssued={() => {
            setNewOpen(false);
            void refresh();
          }}
          usdRate={usdRate}
          patients={patients}
        />
      )}
    </div>
  );
}
