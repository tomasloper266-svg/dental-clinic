"use client";

import { useCallback, useEffect, useState } from "react";
import type { MaterialDto } from "@/lib/services/inventory";

// لوحة المخزون — قائمة المواد مع التوريد والاستعمال والتعديل،
// وتنبيه بارز لكل مادة وصلت حد التنبيه أو تحته.

type PatientOption = { id: string; name: string };

type Action = "supply" | "usage" | "edit" | null;

export default function InventoryBoard() {
  const [materials, setMaterials] = useState<MaterialDto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openAction, setOpenAction] = useState<Action>(null);

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/materials");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { materials: MaterialDto[] };
      setMaterials(data.materials);
    } catch {
      setMaterials(null);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const lowCount = materials?.filter((m) => m.isLow).length ?? 0;

  async function apply(
    materialId: string,
    path: "supply" | "usage" | "edit",
    body: Record<string, unknown>,
    successNote: string,
  ): Promise<boolean> {
    setBusyId(materialId);
    setMessage(null);
    try {
      const res = await fetch(`/api/materials/${materialId}/${path}`, {
        method: path === "edit" ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "تعذر تنفيذ العملية، أعد المحاولة");
        return false;
      }
      setMessage(successNote);
      await refresh();
      return true;
    } catch {
      setMessage("تعذر الاتصال بالخادم، حاول مرة أخرى");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError && (
        <div role="alert" className="flex flex-col gap-2">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
            تعذر تحميل المخزون، أعد المحاولة
          </p>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {!loadError && lowCount > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          ⚠ {lowCount} مادة وصلت حد التنبيه أو تحته — راجع القائمة أدناه وأورد
          ما ينقص.
        </div>
      )}

      {message && (
        <p
          role="status"
          className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800"
        >
          {message}
        </p>
      )}

      <AddMaterialForm
        onAdded={async () => {
          setMessage("أُضيفت المادة");
          await refresh();
        }}
        onError={setMessage}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-teal-800">مواد العيادة</h2>
        {materials === null && !loadError && (
          <>
            <div className="h-20 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
            <div className="h-20 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
          </>
        )}
        {materials !== null && materials.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-center text-sm text-gray-500">
            لا مواد بعد — أضف أول مادة من النموذج أعلاه.
          </div>
        )}
        {materials?.map((m) => (
          <MaterialCard
            key={m.id}
            material={m}
            busy={busyId === m.id}
            openAction={openAction}
            setOpenAction={setOpenAction}
            apply={apply}
          />
        ))}
      </section>
    </div>
  );
}

function MaterialCard({
  material,
  busy,
  openAction,
  setOpenAction,
  apply,
}: {
  material: MaterialDto;
  busy: boolean;
  openAction: Action;
  setOpenAction: (a: Action) => void;
  apply: (
    materialId: string,
    path: "supply" | "usage" | "edit",
    body: Record<string, unknown>,
    successNote: string,
  ) => Promise<boolean>;
}) {
  const close = () => setOpenAction(null);
  const isOpen = (a: Action) => openAction === a && !busy;

  return (
    <article
      className={`rounded-xl border bg-white p-3 text-sm shadow-sm ${
        material.isLow ? "border-red-300" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">{material.name}</p>
        {material.isLow && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
            ⚠ تحت حد التنبيه
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-gray-600">
        الرصيد: {material.quantityOnHand} {material.unit} · حد التنبيه:{" "}
        {material.minQuantity}
        {material.costSyp !== null ? ` · ${material.costSyp} ل.س` : ""}
      </p>

      <div className="mt-2 flex flex-wrap gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpenAction(isOpen("supply") ? null : "supply")}
          className="rounded-full bg-teal-700 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {busy && openAction === "supply" ? "…" : "توريد"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpenAction(isOpen("usage") ? null : "usage")}
          className="rounded-full bg-teal-700 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {busy && openAction === "usage" ? "…" : "استعمال"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpenAction(isOpen("edit") ? null : "edit")}
          className="rounded-full border border-teal-700 px-3 py-1 text-[11px] font-semibold text-teal-700 disabled:opacity-50"
        >
          {busy && openAction === "edit" ? "…" : "تعديل"}
        </button>
      </div>

      {isOpen("supply") && (
        <QuantityForm
          label="كمية التوريد"
          unit={material.unit}
          submitLabel="أضف الكمية"
          onSubmit={async (quantity) => {
            const ok = await apply(
              material.id,
              "supply",
              { quantity },
              "سُجل التوريد",
            );
            if (ok) close();
          }}
        />
      )}

      {isOpen("usage") && (
        <UsageForm
          unit={material.unit}
          onSubmit={async (quantity, patientId) => {
            const ok = await apply(
              material.id,
              "usage",
              { quantityUsed: quantity, patientId },
              "سُجل الاستعمال وخصمت الكمية",
            );
            if (ok) close();
          }}
        />
      )}

      {isOpen("edit") && (
        <EditMaterialForm
          material={material}
          onSubmit={async (body) => {
            const ok = await apply(material.id, "edit", body, "حُررت المادة");
            if (ok) close();
          }}
        />
      )}
    </article>
  );
}

function QuantityForm({
  label,
  unit,
  submitLabel,
  onSubmit,
}: {
  label: string;
  unit: string;
  submitLabel: string;
  onSubmit: (quantity: number) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-2 flex flex-col gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        const quantity = Number(value);
        if (!value.trim() || !Number.isFinite(quantity) || quantity <= 0) {
          setError("أدخل كمية رقماً موجباً");
          return;
        }
        setError(null);
        await onSubmit(quantity);
      }}
    >
      <label className="text-[11px] text-gray-600">
        {label} ({unit})
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          inputMode="decimal"
        />
      </label>
      {error && (
        <p role="alert" className="text-[11px] text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white"
      >
        {submitLabel}
      </button>
    </form>
  );
}

function UsageForm({
  unit,
  onSubmit,
}: {
  unit: string;
  onSubmit: (quantity: number, patientId?: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [search, setSearch] = useState("");
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [options, setOptions] = useState<PatientOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!search.trim()) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/patients?q=${encodeURIComponent(search.trim())}`,
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { patients: PatientOption[] };
        setOptions(data.patients);
      } catch {
        setOptions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <form
      className="mt-2 flex flex-col gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        const quantity = Number(value);
        if (!value.trim() || !Number.isFinite(quantity) || quantity <= 0) {
          setError("أدخل كمية رقماً موجباً");
          return;
        }
        setError(null);
        await onSubmit(quantity, patient?.id);
      }}
    >
      <label className="text-[11px] text-gray-600">
        الكمية المستعملة ({unit})
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          inputMode="decimal"
        />
      </label>
      <label className="text-[11px] text-gray-600">
        المريض (اختياري)
        {patient ? (
          <span className="mt-1 flex items-center justify-between rounded-lg bg-teal-50 px-2 py-1.5 text-sm text-teal-900">
            {patient.name}
            <button
              type="button"
              onClick={() => {
                setPatient(null);
                setSearch("");
              }}
              className="text-[11px] text-red-700 underline"
            >
              إزالة
            </button>
          </span>
        ) : (
          <>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الهاتف"
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
            {options.length > 0 && (
              <span className="mt-1 flex flex-col gap-1">
                {options.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPatient(p);
                      setSearch("");
                      setOptions([]);
                    }}
                    className="rounded-lg border border-gray-200 px-2 py-1 text-right text-xs"
                  >
                    {p.name}
                  </button>
                ))}
              </span>
            )}
          </>
        )}
      </label>
      {error && (
        <p role="alert" className="text-[11px] text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white"
      >
        سجل الاستعمال
      </button>
    </form>
  );
}

function EditMaterialForm({
  material,
  onSubmit,
}: {
  material: MaterialDto;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(material.name);
  const [unit, setUnit] = useState(material.unit);
  const [minQuantity, setMinQuantity] = useState(String(material.minQuantity));
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-2 flex flex-col gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        const min = Number(minQuantity);
        if (!name.trim() || !unit.trim() || !Number.isFinite(min) || min < 0) {
          setError("تحقق من الاسم والوحدة وحد التنبيه");
          return;
        }
        setError(null);
        await onSubmit({
          name: name.trim(),
          unit: unit.trim(),
          minQuantity: min,
        });
      }}
    >
      <label className="text-[11px] text-gray-600">
        الاسم
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-[11px] text-gray-600">
        وحدة القياس
        <input
          type="text"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-[11px] text-gray-600">
        حد التنبيه
        <input
          type="number"
          step="0.01"
          min="0"
          value={minQuantity}
          onChange={(e) => setMinQuantity(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          inputMode="decimal"
        />
      </label>
      {error && (
        <p role="alert" className="text-[11px] text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white"
      >
        احفظ التعديل
      </button>
    </form>
  );
}

function AddMaterialForm({
  onAdded,
  onError,
}: {
  onAdded: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [costSyp, setCostSyp] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
      >
        + مادة جديدة
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const min = Number(minQuantity);
        const cost = costSyp.trim() === "" ? undefined : Number(costSyp);
        if (!name.trim() || !unit.trim() || !Number.isFinite(min) || min < 0) {
          setError("الاسم والوحدة مطلوبان وحد التنبيه رقم غير سالب");
          return;
        }
        if (cost !== undefined && (!Number.isInteger(cost) || cost < 0)) {
          setError("السعر رقماً صحيحاً غير سالب أو اتركه فارغاً");
          return;
        }
        setSaving(true);
        setError(null);
        onError(null);
        try {
          const res = await fetch("/api/materials", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              unit: unit.trim(),
              minQuantity: min,
              ...(cost !== undefined ? { costSyp: cost } : {}),
            }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) {
            onError(data.error ?? "تعذر إضافة المادة، أعد المحاولة");
            return;
          }
          setName("");
          setUnit("");
          setMinQuantity("");
          setCostSyp("");
          setOpen(false);
          await onAdded();
        } catch {
          onError("تعذر الاتصال بالخادم، حاول مرة أخرى");
        } finally {
          setSaving(false);
        }
      }}
    >
      <p className="text-sm font-bold text-teal-800">مادة جديدة</p>
      <label className="text-[11px] text-gray-600">
        الاسم
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-[11px] text-gray-600">
        وحدة القياس (علبة، أنبوب، غرام…)
        <input
          type="text"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-[11px] text-gray-600">
        حد التنبيه
        <input
          type="number"
          step="0.01"
          min="0"
          value={minQuantity}
          onChange={(e) => setMinQuantity(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          inputMode="decimal"
        />
      </label>
      <label className="text-[11px] text-gray-600">
        السعر بوحدة السوري (اختياري)
        <input
          type="number"
          min="0"
          value={costSyp}
          onChange={(e) => setCostSyp(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          inputMode="numeric"
        />
      </label>
      {error && (
        <p role="alert" className="text-[11px] text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? "…" : "أضف المادة"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
