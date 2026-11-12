"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatSyp } from "@/lib/utils";
import InstructionSendPanel from "@/components/odontogram/InstructionSendPanel";
import type {
  PlanItemDto,
  PlanItemStatus,
} from "@/lib/services/treatment-plan";
import { toothStatusMeta } from "@/lib/odontogram/statuses";

// قسم خطة العلاج المسعّرة — إضافة بنود بأسعار، تعديل غير المنفذ، وبدء التنفيذ.
// بدء التنفيذ يحول البند إلى منفذ ويضيف مشاهدة «علاج منفذ» على الأودوغرام،
// ثم router.refresh() لإعادة القراءة من الخادم — السجل الإلحاقي لا يُستبدل.

type Props = {
  patientId: string;
  initialItems: PlanItemDto[];
  preselectedTooth: number | null;
};

const STATUS_META: Record<
  PlanItemStatus,
  { labelAr: string; chipClass: string }
> = {
  PROPOSED: {
    labelAr: "مخطط",
    chipClass: "bg-gray-100 text-gray-700 border-gray-300",
  },
  ACCEPTED: {
    labelAr: "مقبول",
    chipClass: "bg-blue-100 text-blue-800 border-blue-300",
  },
  DONE: {
    labelAr: "منفذ",
    chipClass: "bg-green-100 text-green-800 border-green-300",
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
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<PlanItemDto[]>(initialItems);
  const [tooth, setTooth] = useState(preselectedTooth?.toString() ?? "");
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

  const base = `/api/patients/${encodeURIComponent(patientId)}/treatment-plan`;

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
          priceSyp: Number(price),
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
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(item: PlanItemDto) {
    setEditingId(item.id);
    setEditProcedure(item.procedure);
    setEditPrice(item.priceSyp.toString());
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
          priceSyp: Number(editPrice),
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
    Number.isInteger(toothNum) && procedure.trim().length >= 2 && price !== "";

  const groups: { status: PlanItemStatus; labelAr: string }[] = [
    { status: "PROPOSED", labelAr: "مخطط" },
    { status: "ACCEPTED", labelAr: "مقبول" },
    { status: "DONE", labelAr: "منفذ" },
  ];

  return (
    <section className="rounded-2xl bg-white p-4 shadow-md">
      <h2 className="text-lg font-bold text-teal-800">خطة العلاج</h2>
      <p className="mb-3 text-xs text-gray-500">
        بنود مسعّرة بالليرة السورية — البند المنفَّذ نهائي ولا يُعدَّل.
      </p>

      <div className="grid grid-cols-3 gap-2 sm:max-w-md">
        <input
          type="number"
          inputMode="numeric"
          min={11}
          max={48}
          value={tooth}
          onChange={(e) => setTooth(e.target.value)}
          placeholder="سن"
          aria-label="رقم السن (FDI)"
          className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-teal-600 focus:outline-none"
        />
        <input
          value={procedure}
          onChange={(e) => setProcedure(e.target.value)}
          placeholder="الإجراء — حشو، خلع…"
          aria-label="الإجراء"
          className="col-span-2 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-teal-600 focus:outline-none"
        />
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="السعر ل.س"
          aria-label="السعر بالليرة السورية"
          className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-teal-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={busy || !canAdd}
          className="col-span-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          إضافة بند
        </button>
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">لا توجد بنود بعد.</p>
      ) : (
        groups.map(({ status, labelAr }) => {
          const group = items.filter((it) => it.status === status);
          if (group.length === 0) return null;
          return (
            <div key={status} className="mt-4">
              <p className="mb-1 text-xs font-semibold text-gray-600">
                {labelAr} ({group.length})
              </p>
              <ul className="space-y-1.5">
                {group.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    {editingId === item.id ? (
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          value={editProcedure}
                          onChange={(e) => setEditProcedure(e.target.value)}
                          aria-label="الإجراء"
                          className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        <input
                          type="number"
                          min={0}
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          aria-label="السعر"
                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => saveEdit(item.id)}
                          disabled={busy}
                          className="col-span-2 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          حفظ التعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg border border-teal-300 bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-800 tabular-nums">
                          {item.toothFdi}
                        </span>
                        <span className="text-sm font-semibold text-gray-800">
                          {item.procedure}
                        </span>
                        <span className="text-xs text-gray-600">
                          {formatSyp(item.priceSyp)}
                        </span>
                        <span
                          className={`ms-auto rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[item.status].chipClass}`}
                        >
                          {STATUS_META[item.status].labelAr}
                        </span>
                        {item.status !== "DONE" && (
                          <div className="flex w-full gap-1.5 sm:w-auto">
                            <button
                              type="button"
                              onClick={() => beginEdit(item)}
                              disabled={busy}
                              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700"
                            >
                              تعديل
                            </button>
                            {item.status === "PROPOSED" && (
                              <button
                                type="button"
                                onClick={() => setStatus(item.id, "ACCEPTED")}
                                disabled={busy}
                                className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs text-blue-800"
                              >
                                قبول
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setStartingId(
                                  startingId === item.id ? null : item.id,
                                )
                              }
                              disabled={busy}
                              className="rounded-lg bg-teal-700 px-2.5 py-1 text-xs font-bold text-white"
                            >
                              بدء التنفيذ
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {startingId === item.id && (
                      <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50 p-2">
                        <p className="mb-1 text-xs font-semibold text-teal-800">
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
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${meta?.chipClass}`}
                              >
                                <span className="font-bold">{meta?.icon}</span>
                                {meta?.labelAr}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-1 text-[11px] text-gray-500">
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
    </section>
  );
}
