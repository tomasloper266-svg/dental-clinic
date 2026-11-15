"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Coins, Plus, ReceiptText, RotateCw, Wallet, X } from "lucide-react";
import type { LedgerEntryType } from "@/lib/services/ledger";
import { formatDateCell } from "@/lib/dates";
import { formatDayLabel } from "@/lib/appointment-ui";
import { useMoney } from "@/components/ui/CurrencyContext";
import { formatDualFromUsd, isUsdAmount } from "@/lib/currency";
import { usePatientSearch, type PatientOption } from "@/lib/use-patient-search";
import { toCsv, withUtf8Bom } from "@/lib/csv";
import { emitLedgerChanged } from "@/lib/ledger-events";
import {
  LEDGER_AMOUNT_CLASSES,
  LEDGER_SETTLEMENT_META,
  LEDGER_TYPE_META,
  buildLedgerRows,
  chargeSettlementSplit,
  filterBySettlement,
  searchLedgerRows,
  summarizeLedger,
  outstandingDuesUsd,
  type SettlementFilter,
} from "@/lib/finance-view";
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
import { PillAction } from "@/components/ui/TableActions";
import { DualAmount } from "@/components/ui/DualAmount";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";

// الفواتير والمدفوعات — بنية المرجع حرفياً: ترويسة كبيرة بحبة «قيد جديد»،
// ثم بطاقة محتوى واحدة تجمع شريط الأدوات (بحث، حبوب حالة السداد، تصدير CSV)،
// وبطاقات الإحصاء، وجدول القيود بأفاتار المريض وأعمدة الإجمالي/المسدد/
// المتبقي وشارة حالة السداد وإجراءَي عرض/تسديد. كل المبالغ بالعملتين معاً
// عبر lib/currency.ts بسعر الصرف من الإعدادات. القيد غير قابل للتعديل أو
// الحذف — التصحيح بقيد عكسي. حالة السداد تصنيف عرض مشتق من الرصيد الجاري
// لكل مريض، بلا أي تغيير في الحساب المالي للخدمة.

type ClinicEntryJson = {
  id: string;
  patientId: string;
  type: LedgerEntryType;
  amountUsd: number;
  note: string | null;
  createdAt: string;
  patientName: string;
  patientPhone: string | null;
};

type TypeFilter = "ALL" | LedgerEntryType;
type AdjustDir = "add" | "sub";

const TYPE_ORDER: LedgerEntryType[] = [
  "CHARGE",
  "PAYMENT",
  "ADJUSTMENT",
  "REFUND",
];

const SETTLEMENT_ORDER: ReadonlyArray<SettlementFilter> = [
  "ALL",
  "settled",
  "unsettled",
  "partial",
];

/** إشارة المبلغ من اختيارات الواجهة — نفس قواعد validateEntrySign في الخدمة */
function signedAmount(
  type: LedgerEntryType,
  magnitude: number,
  dir: AdjustDir,
): number {
  if (type === "PAYMENT") return -magnitude;
  if (type === "ADJUSTMENT") return dir === "add" ? magnitude : -magnitude;
  return magnitude;
}

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

export default function FinanceBoard({ usdRate }: { usdRate: number }) {
  const money = useMoney();
  const { toast } = useToast();
  const [entries, setEntries] = useState<ClinicEntryJson[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [settlementFilter, setSettlementFilter] = useState<SettlementFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // حقول قيد جديد
  const [entryPatient, setEntryPatient] = useState<PatientOption | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [type, setType] = useState<LedgerEntryType>("CHARGE");
  const [amountStr, setAmountStr] = useState("");
  const [adjustDir, setAdjustDir] = useState<AdjustDir>("add");
  const [note, setNote] = useState("");

  const suggestions = usePatientSearch(
    patientQuery,
    addOpen && entryPatient === null,
  );

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

  const summary = useMemo(() => summarizeLedger(entries ?? []), [entries]);
  const duesUsd = useMemo(
    () => outstandingDuesUsd(entries ?? []),
    [entries],
  );

  // الصفوف: أرصدة جارية (عام ولكل مريض) وحالة سداد مشتقة، ثم الأحدث أولاً.
  const allRows = useMemo(
    () => (entries === null ? null : buildLedgerRows(entries)),
    [entries],
  );

  const settlementCounts = useMemo(() => {
    const counts: Record<SettlementFilter, number> = {
      ALL: allRows?.length ?? 0,
      settled: 0,
      partial: 0,
      unsettled: 0,
    };
    for (const row of allRows ?? []) {
      if (row.settlement !== null) counts[row.settlement] += 1;
    }
    return counts;
  }, [allRows]);

  const typeCounts = useMemo(() => {
    const counts: Record<TypeFilter, number> = {
      ALL: entries?.length ?? 0,
      CHARGE: 0,
      PAYMENT: 0,
      ADJUSTMENT: 0,
      REFUND: 0,
    };
    for (const e of entries ?? []) counts[e.type] += 1;
    return counts;
  }, [entries]);

  const rows = useMemo(() => {
    if (allRows === null) return null;
    const bySettlement = filterBySettlement(allRows, settlementFilter);
    const searched = searchLedgerRows(bySettlement, search);
    if (typeFilter === "ALL") return searched;
    return searched.filter((row) => row.entry.type === typeFilter);
  }, [allRows, settlementFilter, search, typeFilter]);

  const amountValue = Number(amountStr);
  const finalAmount =
    amountStr !== "" && Number.isFinite(amountValue) && amountValue > 0
      ? signedAmount(type, amountValue, adjustDir)
      : null;

  function openCreate() {
    setEntryPatient(null);
    setPatientQuery("");
    setType("CHARGE");
    setAmountStr("");
    setAdjustDir("add");
    setNote("");
    setFormError(null);
    setAddOpen(true);
  }

  /** حبة «تسديد» — قيد دفعة جاهز للمريض بمبلغ المستحق المتبقي بعده */
  function openSettle(row: {
    entry: ClinicEntryJson;
    patientBalanceAfter: number;
  }) {
    setEntryPatient({
      id: row.entry.patientId,
      name: row.entry.patientName,
      phone: row.entry.patientPhone,
    });
    setPatientQuery("");
    setType("PAYMENT");
    setAmountStr(
      row.patientBalanceAfter > 0 ? String(row.patientBalanceAfter) : "",
    );
    setAdjustDir("add");
    setNote("");
    setFormError(null);
    setAddOpen(true);
  }

  async function submitEntry() {
    setFormError(null);
    if (!entryPatient) {
      setFormError("اختر المريض أولاً");
      return;
    }
    const magnitude = Number(amountStr);
    if (!isUsdAmount(magnitude) || magnitude <= 0) {
      setFormError("المبلغ يجب أن يكون رقماً موجباً بمنزلتين عشريتين كحد أقصى");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/patients/${encodeURIComponent(entryPatient.id)}/ledger`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type,
            amountUsd: signedAmount(type, magnitude, adjustDir),
            note: note.trim() || undefined,
          }),
        },
      );
      const data = (await res.json()) as { entry?: object; error?: string };
      if (!res.ok || !data.entry) {
        setFormError(data.error ?? "تعذر تسجيل القيد، أعد المحاولة");
        return;
      }
      toast("سُجّل القيد في الدفتر");
      emitLedgerChanged();
      setAddOpen(false);
      setEntryPatient(null);
      setPatientQuery("");
      setType("CHARGE");
      setAmountStr("");
      setAdjustDir("add");
      setNote("");
      await refresh();
    } catch {
      setFormError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!rows) return;
    const csv = toCsv(
      ["التاريخ", "المريض", "الهاتف", "النوع", "البيان", "المبلغ", "الرصيد الجاري", "الحالة"],
      rows.map(({ entry, balance, settlement }) => [
        formatDateCell(entry.createdAt),
        entry.patientName,
        entry.patientPhone ?? "",
        LEDGER_TYPE_META[entry.type].label,
        entry.note ?? "",
        entry.amountUsd,
        balance,
        settlement === null ? "" : LEDGER_SETTLEMENT_META[settlement].label,
      ]),
    );
    downloadCsv("دفتر-مالي.csv", csv);
    toast("صُدِّر ملف CSV");
  }

  const filterLabels: Record<TypeFilter, string> = {
    ALL: "الكل",
    CHARGE: LEDGER_TYPE_META.CHARGE.label,
    PAYMENT: LEDGER_TYPE_META.PAYMENT.label,
    ADJUSTMENT: LEDGER_TYPE_META.ADJUSTMENT.label,
    REFUND: LEDGER_TYPE_META.REFUND.label,
  };

  return (
    <>
      <PageHeader
        title="الفواتير والمدفوعات"
        description={formatDayLabel(new Date())}
        actions={
          <Button shape="pill" onClick={openCreate}>
            <Plus size={16} aria-hidden />
            قيد جديد
          </Button>
        }
      />

      {loadError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-panel border border-danger-300 bg-danger-50 px-4 py-4"
        >
          <p className="text-xs font-medium text-danger-700">
            تعذر تحميل الدفتر — تحقق من الاتصال ثم أعد المحاولة.
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
              value={search}
              onChange={setSearch}
              placeholder="ابحث برقم الفاتورة أو اسم المريض…"
              aria-label="بحث باسم المريض أو البيان"
            />
            <div className="flex flex-wrap items-center gap-2">
              <FilterPills
                options={SETTLEMENT_ORDER.map((key) => ({
                  value: key,
                  label:
                    key === "ALL" ? "الكل" : LEDGER_SETTLEMENT_META[key].label,
                  count: settlementCounts[key],
                }))}
                value={settlementFilter}
                onChange={setSettlementFilter}
                ariaLabel="تصفية بحالة السداد"
              />
              <FilterPills
                options={(["ALL", ...TYPE_ORDER] as TypeFilter[]).map((key) => ({
                  value: key,
                  label: filterLabels[key],
                  count: typeCounts[key],
                }))}
                value={typeFilter}
                onChange={setTypeFilter}
                ariaLabel="تصفية بنوع القيد"
              />
              <ExportButton onClick={exportCsv} />
            </div>
          </PanelToolbar>

          {/* بطاقات الإحصاء — كل الأرقام من القيود نفسها وبالعملتين معاً */}
          <div className="grid gap-3 px-5 pt-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              value={String(entries?.length ?? 0)}
              label="عدد القيود"
              icon={BookOpen}
            />
            <StatCard
              value={formatDualFromUsd(summary.chargesUsd, usdRate)}
              label="إجمالي الرسوم المُصدرة"
              icon={ReceiptText}
            />
            <StatCard
              value={formatDualFromUsd(summary.paymentsUsd, usdRate)}
              label="إجمالي المدخول (الدفعات)"
              icon={Coins}
            />
            <StatCard
              value={formatDualFromUsd(duesUsd, usdRate)}
              label="المستحقات غير المسددة"
              icon={Wallet}
              tone="danger"
            />
          </div>

          <div className="px-5 pb-5 pt-4">
            {entries === null ? (
              <div aria-busy="true" className="flex flex-col gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-11 animate-pulse rounded-field bg-surface-sunken"
                  />
                ))}
              </div>
            ) : rows === null || rows.length === 0 ? (
              entries.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="الدفتر فارغ"
                  description="سجّل أول قيد برسوم علاج أو دفعة، وستُبنى الحسابات والرصيد من القيود تلقائياً."
                  action={
                    <Button size="sm" onClick={openCreate}>
                      <Plus size={14} aria-hidden />
                      قيد جديد
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="لا قيود مطابقة للتصفية"
                  description="عدّل حالة السداد أو نوع القيد أو نص البحث لتوسيع النتائج."
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSettlementFilter("ALL");
                        setTypeFilter("ALL");
                        setSearch("");
                      }}
                    >
                      مسح التصفية
                    </Button>
                  }
                />
              )
            ) : (
              <>
                {/* جدول الشاشات المتوسطة فأعلى */}
                <Table className="hidden md:table">
                  <THead>
                    <TRow>
                      <TH>التاريخ</TH>
                      <TH>المريض</TH>
                      <TH className="hidden lg:table-cell">النوع</TH>
                      <TH className="hidden xl:table-cell">البيان</TH>
                      <TH className="text-end">الإجمالي</TH>
                      <TH className="text-end">المسدد</TH>
                      <TH className="text-end">المتبقي</TH>
                      <TH>الحالة</TH>
                      <TH>
                        <span className="sr-only">إجراءات</span>
                      </TH>
                    </TRow>
                  </THead>
                  <tbody>
                    {rows.map(({ entry, patientBalanceAfter, settlement }) => {
                      const split =
                        entry.type === "CHARGE"
                          ? chargeSettlementSplit(patientBalanceAfter, entry.amountUsd)
                          : null;
                      return (
                        <TRow key={entry.id}>
                          <TD className="numeric whitespace-nowrap text-xs text-warm-600">
                            {formatDateCell(entry.createdAt)}
                          </TD>
                          <TD>
                            <EntityCell
                              name={entry.patientName}
                              subtitle={entry.patientPhone ?? undefined}
                            />
                          </TD>
                          <TD className="hidden lg:table-cell">
                            <StatusPill tone={LEDGER_TYPE_META[entry.type].tone}>
                              {LEDGER_TYPE_META[entry.type].label}
                            </StatusPill>
                          </TD>
                          <TD className="hidden max-w-64 truncate text-xs text-warm-600 xl:table-cell">
                            {entry.note ?? "—"}
                          </TD>
                          <TD className="text-end">
                            <DualAmount
                              usd={entry.amountUsd}
                              usdRate={usdRate}
                              valueClassName={LEDGER_AMOUNT_CLASSES[entry.type]}
                            />
                          </TD>
                          <TD className="text-end">
                            {split ? (
                              <DualAmount usd={split.paidUsd} usdRate={usdRate} />
                            ) : (
                              <span className="text-xs text-warm-400">—</span>
                            )}
                          </TD>
                          <TD className="text-end">
                            {split ? (
                              <DualAmount
                                usd={split.remainingUsd}
                                usdRate={usdRate}
                                tone={split.remainingUsd > 0 ? "danger" : "default"}
                              />
                            ) : (
                              <span className="text-xs text-warm-400">—</span>
                            )}
                          </TD>
                          <TD>
                            {settlement === null ? (
                              <span className="text-xs text-warm-400">—</span>
                            ) : (
                              <StatusPill
                                tone={LEDGER_SETTLEMENT_META[settlement].tone}
                              >
                                {LEDGER_SETTLEMENT_META[settlement].label}
                              </StatusPill>
                            )}
                          </TD>
                          <TD>
                            <div className="flex items-center justify-end gap-1.5">
                              <PillAction href={`/patients/${entry.patientId}`}>
                                عرض
                              </PillAction>
                              <PillAction
                                variant="success"
                                onClick={() =>
                                  openSettle({ entry, patientBalanceAfter })
                                }
                                className={
                                  settlement === "settled"
                                    ? "pointer-events-none opacity-50"
                                    : undefined
                                }
                              >
                                تسديد
                              </PillAction>
                            </div>
                          </TD>
                        </TRow>
                      );
                    })}
                  </tbody>
                </Table>

                {/* بطاقات الموبايل */}
                <ul className="flex flex-col gap-2 md:hidden">
                  {rows.map(({ entry, balance, settlement }) => (
                    <li key={entry.id}>
                      <Card>
                        <div className="flex flex-col gap-2 px-5 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <StatusPill tone={LEDGER_TYPE_META[entry.type].tone}>
                              {LEDGER_TYPE_META[entry.type].label}
                            </StatusPill>
                            <span className="numeric text-xs text-warm-500">
                              {formatDateCell(entry.createdAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <EntityCell
                              name={entry.patientName}
                              subtitle={entry.patientPhone ?? undefined}
                            />
                            <DualAmount
                              usd={entry.amountUsd}
                              usdRate={usdRate}
                              valueClassName={cn(
                                "text-sm",
                                LEDGER_AMOUNT_CLASSES[entry.type],
                              )}
                            />
                          </div>
                          {entry.note && (
                            <p className="text-xs text-warm-500">{entry.note}</p>
                          )}
                          <div className="flex items-center justify-between gap-2 border-t border-warm-200 pt-2">
                            {settlement === null ? (
                              <span className="text-xs text-warm-500">
                                الرصيد بعد القيد:{" "}
                                <span className="numeric">{money(balance)}</span>
                              </span>
                            ) : (
                              <StatusPill
                                tone={LEDGER_SETTLEMENT_META[settlement].tone}
                              >
                                {LEDGER_SETTLEMENT_META[settlement].label}
                              </StatusPill>
                            )}
                            <div className="flex items-center gap-1.5">
                              <PillAction href={`/patients/${entry.patientId}`}>
                                عرض
                              </PillAction>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>

                {entries.length >= 300 && (
                  <p className="mt-2 text-xs text-warm-500">
                    تُعرض أحدث 300 قيد — استخدم التصفية للوصول إلى قيود أقدم.
                  </p>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* نافذة قيد جديد */}
      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setFormError(null);
        }}
        title="قيد جديد"
        footer={
          <>
            <Button loading={busy} onClick={() => void submitEntry()}>
              تسجيل القيد
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
          {entryPatient ? (
            <div className="flex items-center justify-between rounded-field border border-warm-200 bg-surface-sunken px-3 py-2">
              <p className="text-sm font-medium text-ink-900">
                {entryPatient.name}
              </p>
              <button
                type="button"
                onClick={() => setEntryPatient(null)}
                aria-label="تغيير المريض"
                className="text-warm-400 hover:text-ink-900"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          ) : (
            <Field label="المريض" htmlFor="entry-patient">
              <div className="relative">
                <Input
                  id="entry-patient"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو الهاتف…"
                  autoComplete="off"
                />
                {suggestions.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-field border border-warm-200 bg-surface-raised shadow-md">
                    {suggestions.slice(0, 6).map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setEntryPatient(p);
                            setPatientQuery("");
                          }}
                          className="w-full px-3 py-2 text-start text-sm text-ink-900 hover:bg-surface-hover"
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Field>
          )}

          <Field label="نوع القيد" htmlFor="entry-type">
            <Select
              id="entry-type"
              value={type}
              onChange={(e) => setType(e.target.value as LedgerEntryType)}
            >
              {TYPE_ORDER.map((key) => (
                <option key={key} value={key}>
                  {LEDGER_TYPE_META[key].label}
                </option>
              ))}
            </Select>
          </Field>

          {type === "ADJUSTMENT" && (
            <fieldset className="flex gap-2">
              <legend className="mb-1.5 text-sm font-medium text-ink-900">
                اتجاه التصحيح
              </legend>
              <Button
                variant={adjustDir === "add" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setAdjustDir("add")}
                aria-pressed={adjustDir === "add"}
              >
                إضافة إلى الرصيد
              </Button>
              <Button
                variant={adjustDir === "sub" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setAdjustDir("sub")}
                aria-pressed={adjustDir === "sub"}
              >
                خصم من الرصيد
              </Button>
            </fieldset>
          )}

          <Field
            label="المبلغ ($)"
            htmlFor="entry-amount"
            hint={
              finalAmount !== null
                ? `سيُسجَّل بالدفتر: ${formatDualFromUsd(finalAmount, usdRate)}`
                : type === "PAYMENT"
                  ? "تُسجَّل الدفعة بقيمة سالبة تخفض رصيد المريض"
                  : undefined
            }
          >
            <Input
              id="entry-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0.01}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="مثال: 250"
            />
          </Field>

          <Field label="البيان (اختياري)" htmlFor="entry-note">
            <Textarea
              id="entry-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="سبب القيد أو ملاحظة…"
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
