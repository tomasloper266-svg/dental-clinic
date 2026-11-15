"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMoney } from "@/components/ui/CurrencyContext";
import InstructionSendPanel from "@/components/odontogram/InstructionSendPanel";
import type {
  PlanItemDto,
  PlanItemStatus,
} from "@/lib/services/treatment-plan";
import { toothStatusMeta } from "@/lib/odontogram/statuses";
import { toothAnatomy, type SurfaceKey } from "@/lib/odontogram/anatomy";
import {
  formatSurfaceAr,
} from "@/lib/odontogram/surfaces";
import { isValidToothFdi } from "@/lib/odontogram/fdi";
import { isUsdAmount } from "@/lib/currency";
import { planTotals, planByTooth } from "@/lib/treatment-plan-view";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { MicButton } from "@/components/ui/MicButton";
import { cn } from "@/components/ui/cn";

// قسم خطة العلاج المسعّرة — إضافة بنود بأسعار، تعديل غير المنفذ، وبدء التنفيذ.
// بدء التنفيذ يحول البند إلى منفذ ويضيف مشاهدة «علاج منفذ» على الأودوغرام،
// ثم router.refresh() لإعادة القراءة من الخادم — السجل الإلحاقي لا يُستبدل.
// العرض: بنود كل حالة مرتبة حسب رقم السن، مع مجموع لكل حالة وإجمالي عام،
// وتدرّج بصري لحالة البند: مخطط (محايد) ← مقبول (ملوّن) ← منفَّذ (صلب).

type Props = {
  patientId: string;
  initialItems: PlanItemDto[];
  preselectedTooth: number | null;
  /** اختياري — يجعل رقم السن زراً ينقل المستخدم إلى تبويب الأودوغرام في ملف المريض */
  onFocusTooth?: (fdi: number) => void;
};

const STATUS_META: Record<
  PlanItemStatus,
  { labelAr: string; chipClass: string }
> = {
  PROPOSED: {
    labelAr: "مخطط",
    chipClass: "border-warm-300 bg-warm-100 text-warm-700",
  },
  ACCEPTED: {
    labelAr: "مقبول",
    chipClass: "border-ink-200 bg-ink-100 text-ink-800",
  },
  DONE: {
    labelAr: "منفذ",
    chipClass: "border-primary-600 bg-primary-600 text-white",
  },
};

const RESULT_STATUSES = [
  "FILLED",
  "ROOT_CANAL",
  "EXTRACTED",
  "CROWN",
  "IMPLANT",
] as const;

export default function TreatmentPlanSection({
  patientId,
  initialItems,
  preselectedTooth,
  onFocusTooth,
}: Props) {
  const router = useRouter();
  const money = useMoney();
  const [items, setItems] = useState<PlanItemDto[]>(initialItems);
  const [tooth, setTooth] = useState(preselectedTooth?.toString() ?? "");
  // أسطح البند — تظهر فقط عند إدخال سن دائم 11–48، وخياراتها من تشريح السن حصراً.
  const [surfaces, setSurfaces] = useState<SurfaceKey[]>([]);
  const [procedure, setProcedure] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProcedure, setEditProcedure] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  // لوحة التعليمات تُفتح تلقائياً بعد إتمام البند — إتمام العلاج يعني TREATMENT_DONE
  const [instructionsForId, setInstructionsForId] = useState<string | null>(
    null,
  );

  // اختيار سن على الأودوغرام يعبّئ بند الخطة الجديد — حتى بعد أول تركيب.
  useEffect(() => {
    if (preselectedTooth !== null) {
      setTooth(preselectedTooth.toString());
      setSurfaces([]);
    }
  }, [preselectedTooth]);

  function handleToothChange(value: string) {
    setTooth(value);
    // السن تغيّر — أسطح السن القديم قد لا تكون تشريحية للجديد.
    setSurfaces([]);
  }

  const base = `/api/patients/${encodeURIComponent(patientId)}/treatment-plan`;

  const totals = useMemo(() => planTotals(items), [items]);

  async function addItem() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toothFdi: Number(tooth),
          procedure,
          priceUsd: Number(price),
          surface: surfaces.length > 0 ? surfaces.join("+") : undefined,
        }),
      });
      const data = (await res.json()) as { item?: PlanItemDto; error?: string };
      if (!res.ok || !data.item) {
        setError(data.error ?? "تعذر إضافة بند الخطة");
        return;
      }
      setItems((prev) => [...prev, data.item as PlanItemDto]);
      setProcedure("");
      setPrice("");
      setSurfaces([]);
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(item: PlanItemDto) {
    setEditingId(item.id);
    setEditProcedure(item.procedure);
    setEditPrice(item.priceUsd.toString());
  }

  async function saveEdit(id: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          procedure: editProcedure,
          priceUsd: Number(editPrice),
        }),
      });
      const data = (await res.json()) as { item?: PlanItemDto; error?: string };
      if (!res.ok || !data.item) {
        setError(data.error ?? "تعذر تعديل البند");
        return;
      }
      setItems((prev) =>
        prev.map((it) => (it.id === id ? (data.item as PlanItemDto) : it)),
      );
      setEditingId(null);
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: "ACCEPTED" | "PROPOSED") {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as { item?: PlanItemDto; error?: string };
      if (!res.ok || !data.item) {
        setError(data.error ?? "تعذر تحديث حالة البند");
        return;
      }
      setItems((prev) =>
        prev.map((it) => (it.id === id ? (data.item as PlanItemDto) : it)),
      );
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  async function startItem(id: string, resultStatus: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resultStatus }),
      });
      const data = (await res.json()) as { item?: PlanItemDto; error?: string };
      if (!res.ok || !data.item) {
        setError(data.error ?? "تعذر بدء تنفيذ البند");
        return;
      }
      setItems((prev) =>
        prev.map((it) => (it.id === id ? (data.item as PlanItemDto) : it)),
      );
      setStartingId(null);
      setInstructionsForId(id);
      // إعادة القراءة من الخادم ليظهر قيد «علاج منفذ» على الأودوغرام فوراً.
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  const toothNum = Number(tooth);
  const canAdd =
    Number.isInteger(toothNum) &&
    procedure.trim().length >= 2 &&
    isUsdAmount(Number(price));

  const groups: { status: PlanItemStatus; labelAr: string }[] = [
    { status: "PROPOSED", labelAr: "مخطط — بانتظار موافقة المريض" },
    { status: "ACCEPTED", labelAr: "مقبول — جاهز للتنفيذ" },
    { status: "DONE", labelAr: "منفَّذ" },
  ];

  const inputClass =
    "rounded-field border-warm-300 bg-surface-raised text-ink-900 placeholder:text-warm-400 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 w-full";

  return (
    <section className="rounded-panel border-warm-200 bg-surface-raised border p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-ink-900 text-base font-semibold">خطة العلاج</h2>
        <p className="text-warm-500 text-xs">
          البند المنفَّذ نهائي ولا يُعدَّل — الأسعار بالليرة السورية.
        </p>
      </div>

      {/* شريط الإجماليات — قرار الطبيب والمريض يعتمد عليه */}
      {items.length > 0 && (
        <div className="border-warm-200 bg-surface-sunken mt-3 grid grid-cols-2 gap-3 rounded-field border p-3 sm:grid-cols-4">
          {(["PROPOSED", "ACCEPTED", "DONE"] as const).map((status) => {
            const meta = STATUS_META[status];
            const summary = totals.byStatus[status];
            return (
              <div key={status}>
                <p className="text-warm-500 text-[11px]">{meta.labelAr}</p>
                <p className="text-ink-900 numeric text-sm font-semibold">
                  <span className="numeric">{summary.count}</span> بند ·{" "}
                  {money(summary.total)}
                </p>
              </div>
            );
          })}
          <div className="border-warm-200 border-e pe-3">
            <p className="text-ink-700 text-[11px] font-semibold">
              الإجمالي الكلي
            </p>
            <p className="text-ink-900 numeric text-sm font-bold">
              {money(totals.grandTotal)}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-[5rem_1fr_8rem_auto]">
        <label className="sr-only" htmlFor="plan-tooth">
          رقم السن (FDI)
        </label>
        <Input
          id="plan-tooth"
          type="number"
          inputMode="numeric"
          min={11}
          max={48}
          value={tooth}
          onChange={(e) => handleToothChange(e.target.value)}
          placeholder="سن"
          className={cn(inputClass, "numeric")}
        />
        <label className="sr-only" htmlFor="plan-procedure">
          الإجراء
        </label>
        <div className="flex items-center gap-1.5">
          <Input
            id="plan-procedure"
            value={procedure}
            onChange={(e) => setProcedure(e.target.value)}
            placeholder="الإجراء — حشو، خلع…"
            className={inputClass}
          />
          <MicButton
            targetId="plan-procedure"
            value={procedure}
            onChange={setProcedure}
          />
        </div>
        <label className="sr-only" htmlFor="plan-price">
          السعر بالدولار
        </label>
        <Input
          id="plan-price"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="السعر $"
          className={cn(inputClass, "numeric")}
        />
        <Button onClick={addItem} loading={busy} disabled={busy || !canAdd}>
          إضافة بند
        </Button>
      </div>

      {/* قائمة الأسطح — تظهر فقط عند إدخال سن دائم 11–48، وخياراتها من تشريح السن حصراً */}
      {isValidToothFdi(toothNum) &&
        (toothAnatomy(toothNum)?.surfaces ?? []).length > 0 && (
          <div className="mt-2">
            <p
              className="text-warm-600 mb-1.5 text-xs font-semibold"
              id="plan-surfaces-label"
            >
              سطح السن (اختياري)
            </p>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-labelledby="plan-surfaces-label"
            >
              {(toothAnatomy(toothNum)?.surfaces ?? []).map((surface) => {
                const active = surfaces.includes(surface);
                return (
                  <button
                    key={surface}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setSurfaces((prev) =>
                        prev.includes(surface)
                          ? prev.filter((s) => s !== surface)
                          : [...prev, surface],
                      )
                    }
                    className={cn(
                      "rounded-field border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
                      active
                        ? "border-primary-600 bg-primary-600 text-white"
                        : "border-warm-300 bg-surface-raised text-warm-600 hover:bg-surface-hover active:bg-surface-sunken",
                    )}
                  >
                    {surface}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {error && (
        <p
          role="alert"
          className="border-danger-300 bg-danger-50 text-danger-700 mt-3 rounded-field border px-3 py-2 text-xs"
        >
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="border-warm-200 mt-5 rounded-field border border-dashed px-4 py-8 text-center">
          <p className="text-warm-600 text-sm font-medium">
            لا توجد بنود في خطة العلاج بعد
          </p>
          <p className="text-warm-400 mt-1 text-xs">
            أضف أول بند أعلاه — أو انقر سناً على الأودوغرام لتعبئة رقمه مباشرة.
          </p>
        </div>
      ) : (
        groups.map(({ status, labelAr }) => {
          // مرتبة حسب رقم السن داخل كل حالة — قراءة سريرية متوقعة
          const group = planByTooth(
            items.filter((it) => it.status === status),
          );
          if (group.length === 0) return null;
          const groupTotal = totals.byStatus[status].total;
          return (
            <div key={status} className="mt-5">
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-1">
                <p className="text-ink-700 text-xs font-semibold">{labelAr}</p>
                <p className="text-warm-500 numeric text-xs">
                  <span className="numeric">{group.length}</span> بنود ·{" "}
                  {money(groupTotal)}
                </p>
              </div>
              <ul className="divide-warm-200 divide-y rounded-field border-warm-200 border">
                {group.map((item) => (
                  <li key={item.id} className="bg-surface-raised px-3 py-2.5">
                    {editingId === item.id ? (
                      <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto_auto]">
                        <div className="flex items-center gap-1.5">
                          <Input
                            id={`plan-procedure-edit-${item.id}`}
                            value={editProcedure}
                            onChange={(e) => setEditProcedure(e.target.value)}
                            aria-label="الإجراء"
                            className={inputClass}
                          />
                          <MicButton
                            targetId={`plan-procedure-edit-${item.id}`}
                            value={editProcedure}
                            onChange={setEditProcedure}
                          />
                        </div>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          aria-label="السعر ($)"
                          className={cn(inputClass, "numeric")}
                        />
                        <Button
                          onClick={() => saveEdit(item.id)}
                          loading={busy}
                          className="h-9"
                        >
                          حفظ التعديل
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          className="h-9"
                        >
                          إلغاء
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {onFocusTooth ? (
                          <button
                            type="button"
                            onClick={() => onFocusTooth(item.toothFdi)}
                            title="عرض السن على الأودوغرام"
                            className="border-ink-200 bg-ink-50 text-ink-800 numeric hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 rounded-field border px-2 py-0.5 text-xs font-bold transition-colors focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            {item.toothFdi}
                          </button>
                        ) : (
                          <span className="border-ink-200 bg-ink-50 text-ink-800 numeric rounded-field border px-2 py-0.5 text-xs font-bold">
                            {item.toothFdi}
                          </span>
                        )}
                        <span className="text-ink-900 text-sm font-semibold">
                          {item.procedure}
                        </span>
                        {item.surface && (
                          <span className="border-steel-200 bg-steel-50 text-steel-700 rounded-field border px-2 py-0.5 text-[11px]">
                            {formatSurfaceAr(item.surface)}
                          </span>
                        )}
                        <span className="text-warm-700 numeric text-xs font-semibold">
                          {money(item.priceUsd)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            STATUS_META[item.status].chipClass,
                          )}
                        >
                          {STATUS_META[item.status].labelAr}
                        </span>
                        {item.status !== "DONE" && (
                          <div className="flex w-full gap-1.5 sm:ms-auto sm:w-auto">
                            <Button
                              variant="ghost"
                              onClick={() => beginEdit(item)}
                              disabled={busy}
                              className="h-8 px-2.5 text-xs"
                            >
                              تعديل
                            </Button>
                            {item.status === "PROPOSED" && (
                              <Button
                                variant="secondary"
                                onClick={() => setStatus(item.id, "ACCEPTED")}
                                disabled={busy}
                                className="h-8 px-2.5 text-xs"
                              >
                                قبول
                              </Button>
                            )}
                            <Button
                              onClick={() =>
                                setStartingId(
                                  startingId === item.id ? null : item.id,
                                )
                              }
                              disabled={busy}
                              className="h-8 px-2.5 text-xs"
                            >
                              بدء التنفيذ
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {startingId === item.id && (
                      <div className="border-primary-200 bg-primary-50 mt-2 rounded-field border p-2">
                        <p className="text-primary-800 mb-1 text-xs font-semibold">
                          الحالة الناتجة على السن {item.toothFdi}:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {RESULT_STATUSES.map((key) => {
                            const meta = toothStatusMeta(key);
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => startItem(item.id, key)}
                                disabled={busy}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-field border px-2 py-1 text-xs font-semibold",
                                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
                                  "hover:opacity-90 disabled:opacity-50",
                                  meta?.chipClass,
                                )}
                              >
                                <span className="font-bold">{meta?.icon}</span>
                                {meta?.labelAr}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-warm-500 mt-1 text-[11px]">
                          سيُضاف قيد «علاج منفذ» لسجل السن — القيود السابقة تبقى
                          محفوظة.
                        </p>
                      </div>
                    )}

                    {instructionsForId === item.id &&
                      item.status === "DONE" && (
                        <InstructionSendPanel
                          patientId={patientId}
                          procedure={item.procedure}
                        />
                      )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}

      {items.length > 0 && (
        <p className="text-warm-400 mt-3 text-[11px]">
          الإجمالي الكلي{" "}
          <span className="numeric font-semibold">
            {money(totals.grandTotal)}
          </span>{" "}
          — منه{" "}
          <span className="numeric font-semibold">
            {money(totals.acceptedTotal)}
          </span>{" "}
          على بنود مقبولة بانتظار التنفيذ.
        </p>
      )}
    </section>
  );
}
