"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Pencil, CheckCircle2, Check, X } from "lucide-react";
import { useMoney } from "@/components/ui/CurrencyContext";
import { allTeeth, toothLabelAr } from "@/lib/odontogram/fdi";
import {
  TOOTH_STATUS_KEYS,
  TOOTH_STATUS_META,
  type ToothStatusKey,
} from "@/lib/odontogram/statuses";
import type {
  PlanDto,
  PlanItemDto,
  PlanItemStatus,
} from "@/lib/services/treatment-plan";
import { planStatusMeta } from "@/lib/treatment-plan-view";
import type { StaffMemberDto } from "@/lib/services/staff";
import type { LedgerEntryDto } from "@/lib/services/ledger";
import {
  deriveInvoicesDetailed,
  summarizeLedger,
} from "@/lib/patient-finance";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import NewPlanModal from "./NewPlanModal";
import IssueInvoiceModal from "./IssueInvoiceModal";
import InvoiceModal from "./InvoiceModal";
import DentalFinancialCard from "./DentalFinancialCard";

// بطاقتا الخطة والعمليات في مخطط الأسنان المستقل — كل تعديل يمر عبر مسارات
// الخدمة القائمة (treatment-plan) ثم router.refresh ليبقى الملف والصفحة متطابقين.

type Props = {
  patientId: string;
  patientName: string;
  plans: PlanDto[];
  unassignedItems: PlanItemDto[];
  doctors: StaffMemberDto[];
  ledger: LedgerEntryDto[];
  usdRate: number;
};

const STATUS_OPTIONS: PlanItemStatus[] = ["PROPOSED", "ACCEPTED"];

// الحالات الناتجة على السن عند الإتمام — نفس مسار بدء التنفيذ في الملف
const RESULT_STATUS_OPTIONS = TOOTH_STATUS_KEYS;

function timeOf(entry: LedgerEntryDto): number {
  return entry.createdAt instanceof Date
    ? entry.createdAt.getTime()
    : new Date(entry.createdAt).getTime();
}

/** مجموع بنود الخطة — الرقم الوحيد في ترويسة البطاقة وتذييلها */
export function planTotalSyp(items: PlanItemDto[]): number {
  return items.reduce((sum, item) => sum + item.priceSyp, 0);
}

export default function DentalPlanSection({
  patientId,
  patientName,
  plans,
  unassignedItems,
  doctors,
  ledger,
  usdRate,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  // المبالغ المعروضة تمر عبر سياق العملة — USD/SYP من الإعدادات يغيّرها كلها.
  const money = useMoney();
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [issuePlan, setIssuePlan] = useState<PlanDto | null>(null);
  const [invoiceIndex, setInvoiceIndex] = useState<number | null>(null);
  // قيد رسوم بانتظار التحديث — يُفتح نموذجه بعد عودة بيانات الدفتر من الخادم
  const [pendingChargeId, setPendingChargeId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const invoices = useMemo(
    () => deriveInvoicesDetailed(ledger),
    [ledger],
  );
  const summary = useMemo(
    () => summarizeLedger(ledger),
    [ledger],
  );

  // قيود الرسوم تصاعدياً — الفاتورة رقم i تقابل القيد رقم i بنفس ترتيب الترقيم
  const allCharges = useMemo(
    () =>
      ledger
        .filter((entry) => entry.type === "CHARGE")
        .sort((a, b) => timeOf(a) - timeOf(b)),
    [ledger],
  );

  useEffect(() => {
    if (pendingChargeId === null) return;
    const index = allCharges.findIndex((charge) => charge.id === pendingChargeId);
    if (index >= 0) {
      setInvoiceIndex(index);
      setPendingChargeId(null);
    }
  }, [allCharges, pendingChargeId]);

  async function patchItem(itemId: string, body: Record<string, unknown>) {
    setRowError(null);
    const res = await fetch(
      `/api/patients/${encodeURIComponent(patientId)}/treatment-plan/${encodeURIComponent(itemId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      setRowError("تعذر تعديل البند — قد يكون منفذاً بالفعل");
      return;
    }
    router.refresh();
  }

  async function deleteItem(itemId: string) {
    setRowError(null);
    const res = await fetch(
      `/api/patients/${encodeURIComponent(patientId)}/treatment-plan/${encodeURIComponent(itemId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      setRowError("تعذر حذف البند — البند المنفذ نهائي");
      return;
    }
    router.refresh();
  }

  async function addRow(planId: string | null, procedure: string, toothFdi: number, priceSyp: number) {
    setRowError(null);
    const res = await fetch(
      `/api/patients/${encodeURIComponent(patientId)}/treatment-plan`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedure, toothFdi, priceSyp, planId }),
      },
    );
    if (!res.ok) {
      setRowError("تعذر إضافة البند — تحقق من الوصف والسعر");
      return;
    }
    router.refresh();
  }

  async function completeItem(itemId: string, resultStatus: ToothStatusKey) {
    setRowError(null);
    const res = await fetch(
      `/api/patients/${encodeURIComponent(patientId)}/treatment-plan/${encodeURIComponent(itemId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultStatus }),
      },
    );
    if (!res.ok) {
      setRowError("تعذر إتمام البند — تحقق من اختيار سن صالح");
      return;
    }
    toast("نُفذ البند وسُجل على السن في المخطط");
    router.refresh();
  }

  async function endPlan(planId: string) {
    const res = await fetch(
      `/api/patients/${encodeURIComponent(patientId)}/plans/${encodeURIComponent(planId)}`,
      { method: "PATCH" },
    );
    if (!res.ok) {
      toast("تعذر إنهاء الخطة — قد تكون منتهية مسبقاً", "danger");
      return;
    }
    toast("انتهت الخطة وبقيت بنودها كما هي");
    router.refresh();
  }

  async function deletePlan(planId: string) {
    const res = await fetch(
      `/api/patients/${encodeURIComponent(patientId)}/plans/${encodeURIComponent(planId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast("تعذر حذف الخطة", "danger");
      return;
    }
    toast("حُذفت الخطة وبقيت بنودها بلا خطة");
    router.refresh();
  }

  const openInvoice = invoiceIndex !== null ? invoices[invoiceIndex] : null;
  const openCharge =
    invoiceIndex !== null && allCharges[invoiceIndex] ? allCharges[invoiceIndex] : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="rounded-panel border-warm-200 bg-surface-raised border p-4 sm:p-5">
          <header className="flex items-center justify-between gap-3">
            <h2 className="text-ink-900 inline-flex items-center gap-2 text-base font-semibold">
              <Pencil size={15} className="text-warning-500" aria-hidden />
              خطة العلاج ({plans.length})
            </h2>
            <Button variant="gold" size="sm" onClick={() => setPlanModalOpen(true)}>
              + خطة جديدة
            </Button>
          </header>

          {plans.length === 0 && unassignedItems.length === 0 && (
            <p className="text-steel-500 mt-4 text-sm">
              لا خطة علاج لهذا المريض بعد — أضف بنوداً من الجدول أدناه أو أنشئ خطة جديدة.
            </p>
          )}

          {plans.map((plan) => {
            const pill = plan.endedAt
              ? { label: "منتهية", toneClass: "bg-warm-100 text-steel-600" }
              : { label: "نشط", toneClass: "bg-success-50 text-success-700" };
            const doneCount = plan.items.filter((item) => item.status === "DONE").length;
            return (
              <PlanOperationsCard
                key={plan.id}
                title={plan.name || "خطة علاج"}
                pill={pill.label}
                pillClass={pill.toneClass}
                createdLabel={new Date(plan.planDate).toLocaleDateString("ar")}
                metaLine={`${plan.items.length} بند · ${doneCount} مكتمل · إجمالي ${money(planTotalSyp(plan.items))}`}
                items={plan.items}
                issueDisabled={doneCount === 0}
                onIssue={() => setIssuePlan(plan)}
                onEndPlan={() => void endPlan(plan.id)}
                onDeletePlan={() => void deletePlan(plan.id)}
                onStatusChange={(itemId, status) => void patchItem(itemId, { status })}
                onToothChange={(itemId, toothFdi) => void patchItem(itemId, { toothFdi })}
                onItemDelete={(itemId) => void deleteItem(itemId)}
                onComplete={(itemId, resultStatus) => void completeItem(itemId, resultStatus)}
                onAddRow={(procedure, toothFdi, priceSyp) =>
                  void addRow(plan.id, procedure, toothFdi, priceSyp)
                }
              />
            );
          })}

          {/* بنود بلا خطة محفوظة — الجدول نفسه بلا أزرار الخطة */}
          {unassignedItems.length > 0 && (
            <PlanOperationsCard
              title="بدون خطة محفوظة حالياً"
              pill="بلا خطة"
              pillClass="bg-warm-100 text-steel-600"
              metaLine={`${unassignedItems.length} بند · إجمالي ${money(planTotalSyp(unassignedItems))}`}
              items={unassignedItems}
              issueDisabled={unassignedItems.every((item) => item.status !== "DONE")}
              onIssue={() =>
                setIssuePlan({
                  id: "",
                  name: "بدون خطة محفوظة",
                  planDate: new Date(),
                  doctorName: null,
                  notes: null,
                  endedAt: null,
                  items: unassignedItems,
                })
              }
              onStatusChange={(itemId, status) => void patchItem(itemId, { status })}
              onToothChange={(itemId, toothFdi) => void patchItem(itemId, { toothFdi })}
              onItemDelete={(itemId) => void deleteItem(itemId)}
              onComplete={(itemId, resultStatus) => void completeItem(itemId, resultStatus)}
              onAddRow={(procedure, toothFdi, priceSyp) =>
                void addRow(null, procedure, toothFdi, priceSyp)
              }
            />
          )}

          {rowError && (
            <p role="alert" className="mt-2 text-sm text-danger-700">
              {rowError}
            </p>
          )}
        </section>
      </div>

      <DentalFinancialCard
        chargesTotalSyp={summary.chargesSyp}
        paidSyp={summary.paidSyp}
        remainingSyp={Math.max(summary.balanceSyp, 0)}
        invoices={invoices}
        onOpenInvoice={(index) => setInvoiceIndex(index)}
      />

      <NewPlanModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        patientId={patientId}
        patientName={patientName}
        unassignedItems={unassignedItems}
        doctors={doctors}
        onCreated={() => {
          setPlanModalOpen(false);
          router.refresh();
        }}
      />

      {issuePlan && (
        <IssueInvoiceModal
          open={issuePlan !== null}
          onClose={() => setIssuePlan(null)}
          patientId={patientId}
          patientName={patientName}
          planName={issuePlan.name || "بدون خطة محفوظة"}
          items={issuePlan.items}
          doctors={doctors}
          onIssued={(chargeIds) => {
            setIssuePlan(null);
            if (chargeIds.length > 0) {
              setPendingChargeId(chargeIds[chargeIds.length - 1]);
            }
            router.refresh();
          }}
        />
      )}

      {openInvoice && openCharge && (
        <InvoiceModal
          open={invoiceIndex !== null}
          onClose={() => setInvoiceIndex(null)}
          patientId={patientId}
          patientName={patientName}
          invoice={openInvoice}
          charges={[openCharge]}
          planItems={[...plans.flatMap((plan) => plan.items), ...unassignedItems]}
          usdRate={usdRate}
          onLedgerChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

type OperationsProps = {
  title: string;
  pill: string;
  pillClass: string;
  createdLabel?: string;
  metaLine?: string;
  items: PlanItemDto[];
  issueDisabled: boolean;
  onIssue: () => void;
  onEndPlan?: () => void;
  onDeletePlan?: () => void;
  onStatusChange: (itemId: string, status: PlanItemStatus) => void;
  onToothChange: (itemId: string, toothFdi: number) => void;
  onItemDelete: (itemId: string) => void;
  onComplete: (itemId: string, resultStatus: ToothStatusKey) => void;
  onAddRow: (procedure: string, toothFdi: number, priceSyp: number) => void;
};

/** بطاقة عمليات خطة واحدة — الجدول وصفي الإضافة والتذييل */
function PlanOperationsCard({
  title,
  pill,
  pillClass,
  createdLabel,
  metaLine,
  items,
  issueDisabled,
  onIssue,
  onEndPlan,
  onDeletePlan,
  onStatusChange,
  onToothChange,
  onItemDelete,
  onComplete,
  onAddRow,
}: OperationsProps) {
  const money = useMoney();
  const totalSyp = planTotalSyp(items);
  const doneSyp = items
    .filter((item) => item.status === "DONE")
    .reduce((sum, item) => sum + item.priceSyp, 0);
  const remainingSyp = totalSyp - doneSyp;

  return (
    <div className="border-warm-200 mt-4 rounded-panel border p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-ink-900 inline-flex items-center gap-2 text-sm font-semibold">
            {title}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                pillClass,
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {pill}
            </span>
          </p>
          <p className="text-steel-500 numeric mt-0.5 text-xs">
            {metaLine}
            {createdLabel ? ` · أُنشئت ${createdLabel}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onEndPlan && onDeletePlan && (
            <>
              <Button
                variant="danger"
                size="sm"
                onClick={onDeletePlan}
                title="حذف الخطة"
              >
                <Trash2 size={14} aria-hidden />
              </Button>
              <Button variant="secondary" size="sm" onClick={onEndPlan}>
                إلغاء الخطة
              </Button>
            </>
          )}
          <Button variant="gold" size="sm" onClick={onIssue} disabled={issueDisabled}>
            إصدار فاتورة من البنود المكتملة
          </Button>
        </div>
      </header>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-warm-200 text-steel-500 border-b text-xs">
            <th className="px-2 py-2 text-start font-medium">الإجراء</th>
            <th className="px-2 py-2 text-start font-medium">السن</th>
            <th className="px-2 py-2 text-start font-medium">السعر</th>
            <th className="px-2 py-2 text-start font-medium">الحالة</th>
            <th className="px-2 py-2 text-start font-medium">إتمام</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-warm-100">
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="text-steel-500 px-2 py-4 text-center text-sm">
                لا بنود في هذه الخطة بعد.
              </td>
            </tr>
          )}
          {items.map((item) => (
            <PlanRow
              key={item.id}
              item={item}
              onStatusChange={onStatusChange}
              onToothChange={onToothChange}
              onDelete={onItemDelete}
              onComplete={onComplete}
            />
          ))}
        </tbody>
      </table>

      <AddRow onAdd={onAddRow} />

      <footer className="border-warm-200 mt-2 flex items-center justify-start gap-6 border-t pt-2 text-sm">
        <span className="text-steel-600">
          إجمالي الخطة{" "}
          <span className="numeric text-ink-900 font-semibold">{money(totalSyp)}</span>
        </span>
        <span className="text-steel-600">
          المكتمل منها{" "}
          <span className="numeric font-semibold text-success-600">
            {money(doneSyp)}
          </span>
        </span>
        {remainingSyp > 0 && (
          <span className="text-steel-600">
            المتبقي منها{" "}
            <span className="numeric font-semibold text-danger-600">
              {money(remainingSyp)}
            </span>
          </span>
        )}
      </footer>
    </div>
  );
}

/** صف الإضافة أسفل الجدول — وصف الخدمة، السن، السعر، وزر الإضافة الذهبي */
function AddRow({
  onAdd,
}: {
  onAdd: (procedure: string, toothFdi: number, priceSyp: number) => void;
}) {
  const [procedure, setProcedure] = useState("");
  const [toothFdi, setToothFdi] = useState(0);
  const [priceStr, setPriceStr] = useState("0");

  const price = Number(priceStr);

  function submit() {
    if (procedure.trim().length < 2) return;
    if (!Number.isInteger(price) || price < 0) return;
    onAdd(procedure.trim(), toothFdi, price);
    setProcedure("");
    setToothFdi(0);
    setPriceStr("0");
  }

  return (
    <div className="border-warm-200 mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
      <input
        value={procedure}
        onChange={(event) => setProcedure(event.target.value)}
        placeholder="وصف الإجراء"
        aria-label="وصف الإجراء"
        className="focus-ring w-44 flex-1 rounded-field border border-warm-300 bg-surface px-2 py-1.5 text-sm text-ink-900"
      />
      <select
        value={toothFdi}
        onChange={(event) => setToothFdi(Number(event.target.value))}
        aria-label="سن الإجراء"
        className="focus-ring w-28 rounded-field border border-warm-300 bg-surface px-2 py-1.5 text-xs text-ink-900"
      >
        <option value={0}>—</option>
        {toothOptions}
      </select>
      <input
        type="number"
        min={0}
        value={priceStr}
        onChange={(event) => setPriceStr(event.target.value)}
        aria-label="سعر الإجراء"
        className="focus-ring numeric w-24 rounded-field border border-warm-300 bg-surface px-2 py-1.5 text-sm text-ink-900"
      />
      <Button variant="gold" size="sm" onClick={submit} disabled={procedure.trim().length < 2}>
        + إضافة
      </Button>
    </div>
  );
}

function PlanRow({
  item,
  onStatusChange,
  onToothChange,
  onDelete,
  onComplete,
}: {
  item: PlanItemDto;
  onStatusChange: (itemId: string, status: PlanItemStatus) => void;
  onToothChange: (itemId: string, toothFdi: number) => void;
  onDelete: (itemId: string) => void;
  onComplete: (itemId: string, resultStatus: ToothStatusKey) => void;
}) {
  const money = useMoney();
  const meta = planStatusMeta(item.status);
  const locked = item.status === "DONE";
  return (
    <tr>
      <td className="text-ink-900 px-2 py-2">{item.procedure}</td>
      <td className="px-2 py-2">
        <select
          value={item.toothFdi}
          disabled={locked}
          onChange={(event) => onToothChange(item.id, Number(event.target.value))}
          aria-label={`سن البند ${item.procedure}`}
          className="focus-ring w-28 rounded-field border border-warm-300 bg-surface px-2 py-1 text-xs text-ink-900 disabled:opacity-60"
        >
          <option value={0}>—</option>
          {toothOptions}
        </select>
      </td>
      <td className="numeric px-2 py-2 font-semibold">{money(item.priceSyp)}</td>
      <td className="px-2 py-2">
        <select
          value={item.status}
          disabled={locked}
          onChange={(event) =>
            onStatusChange(item.id, event.target.value as PlanItemStatus)
          }
          aria-label={`حالة البند ${item.procedure}`}
          className={cn(
            "focus-ring inline-flex rounded-full px-2 py-1 text-[11px] font-medium disabled:opacity-80",
            meta.toneClass,
          )}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {planStatusMeta(status).labelAr}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        {locked ? (
          <CheckCircle2 size={17} className="text-success-600" aria-label="منفذ" />
        ) : (
          <CompletionCell itemId={item.id} toothFdi={item.toothFdi} onComplete={onComplete} onDelete={() => onDelete(item.id)} />
        )}
      </td>
    </tr>
  );
}

/** خلية الإتمام — تحديد الصندوق يطلب الحالة الناتجة على السن قبل التنفيذ */
function CompletionCell({
  itemId,
  toothFdi,
  onComplete,
  onDelete,
}: {
  itemId: string;
  toothFdi: number;
  onComplete: (itemId: string, resultStatus: ToothStatusKey) => void;
  onDelete: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<ToothStatusKey>("FILLED");

  if (!asking) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="checkbox"
          onChange={() => setAsking(true)}
          checked={false}
          aria-label={`إتمام البند ${itemId}`}
          className="accent-warning-500 h-4 w-4"
        />
        <button
          type="button"
          onClick={onDelete}
          title="حذف البند"
          className="rounded-field text-danger-600 hover:bg-danger-50 p-1"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={result}
        onChange={(event) => setResult(event.target.value as ToothStatusKey)}
        aria-label="الحالة الناتجة على السن"
        className="focus-ring rounded-field border border-warm-300 bg-surface px-1.5 py-1 text-[11px] text-ink-900"
      >
        {RESULT_STATUS_OPTIONS.filter((key) => key !== "HEALTHY").map((key) => (
          <option key={key} value={key}>
            {TOOTH_STATUS_META[key].labelAr}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          setAsking(false);
          onComplete(itemId, result);
        }}
        disabled={toothFdi === 0}
        title={toothFdi === 0 ? "اختر سناً أولاً" : "تأكيد التنفيذ"}
        className="rounded-field text-success-700 hover:bg-success-50 p-1 disabled:opacity-40"
      >
        <Check size={15} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        title="إلغاء"
        className="rounded-field text-steel-500 hover:bg-surface-hover p-1"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

// خيارات الأسنان — 32 سناً بترقيم FDI
const toothOptions = allTeeth().map((tooth) => (
  <option key={tooth.fdi} value={tooth.fdi}>
    {toothLabelAr(tooth.fdi)}
  </option>
));
