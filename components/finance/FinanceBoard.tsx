"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, RotateCw, Search, X } from "lucide-react";
import type { LedgerEntryType } from "@/lib/services/ledger";
import { formatSyp } from "@/lib/utils";
import { usePatientSearch, type PatientOption } from "@/lib/use-patient-search";
import {
  LEDGER_AMOUNT_CLASSES,
  LEDGER_TYPE_META,
  formatEntryDate,
  runningBalances,
  sortEntriesAsc,
  summarizeLedger,
} from "@/lib/finance-view";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";

// لوحة الدفتر المالي — قيود العيادة كلها في جدول واحد مع الرصيد الجاري
// المحسوب من القيود نفسها، وتصفية بالنوع وبالمريض، وتسجيل قيد جديد عبر
// مسار دفتر المريض نفسه. القيد غير قابل للتعديل أو الحذف — التصحيح بقيد عكسي.

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

type TypeFilter = "ALL" | LedgerEntryType;
type AdjustDir = "add" | "sub";

const TYPE_ORDER: LedgerEntryType[] = [
  "CHARGE",
  "PAYMENT",
  "ADJUSTMENT",
  "REFUND",
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

export default function FinanceBoard() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<ClinicEntryJson[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [patientFilter, setPatientFilter] = useState<PatientOption | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
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

  const filterCounts = useMemo(() => {
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

  // الصفوف المرئية: تصفية ثم ترتيب زمني تصاعدي للرصيد الجاري، وتُعرض
  // الأحدث أولاً في الجدول كما في الدفاتر الورقية.
  const rows = useMemo(() => {
    const filtered = (entries ?? []).filter(
      (e) =>
        (typeFilter === "ALL" || e.type === typeFilter) &&
        (!patientFilter || e.patientId === patientFilter.id),
    );
    const asc = sortEntriesAsc(filtered);
    const balances = runningBalances(asc);
    return asc
      .map((entry, index) => ({ entry, balance: balances[index] }))
      .reverse();
  }, [entries, typeFilter, patientFilter]);

  const amountValue = Number(amountStr);
  const finalAmount =
    amountStr !== "" && Number.isFinite(amountValue) && amountValue > 0
      ? signedAmount(type, amountValue, adjustDir)
      : null;

  async function submitEntry() {
    setFormError(null);
    if (!entryPatient) {
      setFormError("اختر المريض أولاً");
      return;
    }
    const magnitude = Number(amountStr);
    if (!Number.isInteger(magnitude) || magnitude <= 0) {
      setFormError("المبلغ يجب أن يكون رقماً صحيحاً موجباً");
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
            amountSyp: signedAmount(type, magnitude, adjustDir),
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
        title="الدفتر المالي"
        description="قيود الرسوم والدفعات والتصحيحات والاستردادات — القيد غير قابل للتعديل أو الحذف، والتصحيح بقيد عكسي."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={16} aria-hidden />
            قيد جديد
          </Button>
        }
      />

      {/* ملخص الدفتر */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardBody className="py-4">
            <p className="text-xs text-warm-500">إيرادات الرسوم</p>
            <p className="numeric mt-1 text-lg font-semibold text-ink-900">
              {formatSyp(summary.chargesSyp)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <p className="text-xs text-warm-500">الدفعات المستلمة</p>
            <p className="numeric mt-1 text-lg font-semibold text-primary-700">
              {formatSyp(summary.paymentsSyp)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <p className="text-xs text-warm-500">
              الرصيد الحالي (المستحق على المرضى)
            </p>
            <p
              className={cn(
                "numeric mt-1 text-lg font-semibold",
                summary.balanceSyp > 0 ? "text-warning-700" : "text-ink-900",
              )}
            >
              {formatSyp(summary.balanceSyp)}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* تصفية */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(["ALL", ...TYPE_ORDER] as TypeFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTypeFilter(key)}
            aria-pressed={typeFilter === key}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              typeFilter === key
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-warm-300 bg-surface-raised text-warm-700 hover:bg-surface-hover",
            )}
          >
            {filterLabels[key]}
            <span className="numeric ms-1.5 opacity-70">
              {filterCounts[key]}
            </span>
          </button>
        ))}

        <div className="relative ms-auto w-full sm:w-64">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-3 my-auto text-warm-400"
          />
          <input
            type="text"
            value={patientFilter ? patientFilter.name : filterQuery}
            onChange={(e) => {
              setFilterQuery(e.target.value);
              setPatientFilter(null);
            }}
            placeholder="تصفية بمريض…"
            aria-label="تصفية القيود بمريض"
            className="h-9 w-full rounded-field border border-warm-300 bg-surface-raised ps-9 pe-8 text-xs text-ink-900 placeholder:text-warm-400 focus:border-primary-500 focus:outline-2 focus:outline-primary-500"
          />
          {patientFilter && (
            <button
              type="button"
              onClick={() => {
                setPatientFilter(null);
                setFilterQuery("");
              }}
              aria-label="إزالة تصفية المريض"
              className="absolute inset-y-0 end-2 my-auto text-warm-400 hover:text-ink-900"
            >
              <X size={14} aria-hidden />
            </button>
          )}
          {!patientFilter && suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-field border border-warm-200 bg-surface-raised shadow-md">
              {suggestions.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPatientFilter(p);
                      setFilterQuery("");
                    }}
                    className="w-full px-3 py-2 text-start text-xs text-ink-900 hover:bg-surface-hover"
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* الجدول */}
      <div className="mt-3">
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
        ) : entries === null ? (
          <div aria-busy="true" className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded-field bg-surface-sunken"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          entries.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="الدفتر فارغ"
              description="سجّل أول قيد برسوم علاج أو دفعة، وستُبنى الحسابات والرصيد من القيود تلقائياً."
              action={
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus size={14} aria-hidden />
                  قيد جديد
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={BookOpen}
              title="لا قيود مطابقة للتصفية"
              description="عدّل نوع القيد أو اختيار المريض لتوسيع النتائج."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTypeFilter("ALL");
                    setPatientFilter(null);
                    setFilterQuery("");
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
                  <TH>النوع</TH>
                  <TH>البيان</TH>
                  <TH className="text-end">المبلغ</TH>
                  <TH className="text-end">الرصيد الجاري</TH>
                </TRow>
              </THead>
              <tbody>
                {rows.map(({ entry, balance }) => (
                  <TRow key={entry.id}>
                    <TD className="numeric whitespace-nowrap text-xs text-warm-600">
                      {formatEntryDate(entry.createdAt)}
                    </TD>
                    <TD>
                      <p className="font-medium text-ink-900">
                        {entry.patientName}
                      </p>
                    </TD>
                    <TD>
                      <StatusPill tone={LEDGER_TYPE_META[entry.type].tone}>
                        {LEDGER_TYPE_META[entry.type].label}
                      </StatusPill>
                    </TD>
                    <TD className="max-w-64 text-xs text-warm-600">
                      {entry.note ?? "—"}
                    </TD>
                    <TD
                      className={cn(
                        "numeric text-end font-medium",
                        LEDGER_AMOUNT_CLASSES[entry.type],
                      )}
                    >
                      {formatSyp(entry.amountSyp)}
                    </TD>
                    <TD className="numeric text-end text-warm-700">
                      {formatSyp(balance)}
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>

            {/* بطاقات الموبايل */}
            <ul className="flex flex-col gap-2 md:hidden">
              {rows.map(({ entry, balance }) => (
                <li key={entry.id}>
                  <Card>
                    <CardBody className="flex flex-col gap-2 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <StatusPill tone={LEDGER_TYPE_META[entry.type].tone}>
                          {LEDGER_TYPE_META[entry.type].label}
                        </StatusPill>
                        <span className="numeric text-xs text-warm-500">
                          {formatEntryDate(entry.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink-900">
                          {entry.patientName}
                        </p>
                        <span
                          className={cn(
                            "numeric text-sm font-semibold",
                            LEDGER_AMOUNT_CLASSES[entry.type],
                          )}
                        >
                          {formatSyp(entry.amountSyp)}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="text-xs text-warm-500">{entry.note}</p>
                      )}
                      <p className="numeric border-t border-warm-200 pt-2 text-xs text-warm-600">
                        الرصيد بعد القيد: {formatSyp(balance)}
                      </p>
                    </CardBody>
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
            label="المبلغ (ل.س)"
            htmlFor="entry-amount"
            hint={
              finalAmount !== null
                ? `سيُسجَّل بالدفتر: ${formatSyp(finalAmount)}`
                : type === "PAYMENT"
                  ? "تُسجَّل الدفعة بقيمة سالبة تخفض رصيد المريض"
                  : undefined
            }
          >
            <Input
              id="entry-amount"
              type="number"
              inputMode="numeric"
              min={1}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="مثال: 250000"
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
