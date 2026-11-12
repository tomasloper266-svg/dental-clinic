"use client";

import { useMemo, useState } from "react";
import {
  upperRowLeftToRight,
  lowerRowLeftToRight,
  toothNameAr,
  QUADRANT_LABEL_AR,
  type ToothCell,
} from "@/lib/odontogram/fdi";
import {
  TOOTH_STATUS_META,
  TOOTH_STATUS_KEYS,
  findingKindLabel,
  toothStatusMeta,
} from "@/lib/odontogram/statuses";
import {
  latestFindingByTooth,
  findingsForTooth,
} from "@/lib/odontogram/findings-view";
import type { FindingDto } from "@/lib/services/findings";

// لوحة الأودوغرام التفاعلية — السن يُنقر لفتح لوحة حالته وسجله الكامل.
// المشاهدات إلحاقية: كل حفظ يضيف قيداً جديداً بتاريخه ولا يستبدل السابق.

type Props = {
  patientId: string;
  initialFindings: FindingDto[];
};

function formatDateAr(iso: string): string {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function OdontogramBoard({ patientId, initialFindings }: Props) {
  const [findings, setFindings] = useState<FindingDto[]>(initialFindings);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [chosenStatus, setChosenStatus] = useState<string | null>(null);
  const [chosenKind, setChosenKind] = useState<"EXISTING" | "DIAGNOSIS">(
    "EXISTING",
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = useMemo(() => latestFindingByTooth(findings), [findings]);

  function selectTooth(cell: ToothCell) {
    setSelectedTooth(cell.fdi);
    setError(null);
    setNote("");
    const current = latest.get(cell.fdi);
    setChosenStatus(current?.status ?? null);
    setChosenKind(current ? "DIAGNOSIS" : "EXISTING");
  }

  async function saveFinding() {
    if (!selectedTooth || !chosenStatus) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/patients/${encodeURIComponent(patientId)}/findings`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            toothFdi: selectedTooth,
            kind: chosenKind,
            status: chosenStatus,
            note: note || undefined,
          }),
        },
      );
      const data = (await res.json()) as { finding?: FindingDto; error?: string };
      if (!res.ok || !data.finding) {
        setError(data.error ?? "تعذر تسجيل المشاهدة");
        return;
      }
      // الإلحاق فقط — السجل السابق يبقى محفوظاً في القائمة والتاريخ.
      setFindings((prev) => [...prev, data.finding as FindingDto]);
      setNote("");
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  const selected = selectedTooth !== null ? selectedTooth : null;
  const history = selected !== null ? findingsForTooth(findings, selected) : [];
  const selectedLatest = selected !== null ? latest.get(selected) : undefined;

  function renderRow(cells: ToothCell[]) {
    return (
      <div className="flex justify-center gap-1 overflow-x-auto py-1">
        {cells.map((cell) => {
          const current = latest.get(cell.fdi);
          const meta = current ? toothStatusMeta(current.status) : null;
          const isSelected = selected === cell.fdi;
          return (
            <button
              key={cell.fdi}
              type="button"
              onClick={() => selectTooth(cell)}
              aria-label={`سن ${cell.fdi} — ${cell.nameAr}`}
              className={`flex h-11 w-9 shrink-0 flex-col items-center justify-center rounded-lg border text-center transition ${
                meta ? meta.cellClass : "border-gray-300 bg-white text-gray-700"
              } ${isSelected ? "ring-2 ring-teal-600 ring-offset-1" : ""}`}
            >
              <span className="text-xs font-bold leading-none">{meta?.icon ?? ""}</span>
              <span className="mt-0.5 text-[10px] leading-none tabular-nums">
                {cell.fdi}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-md">
        <h2 className="mb-1 text-lg font-bold text-teal-800">مخطط الأسنان</h2>
        <p className="mb-3 text-xs text-gray-500">
          الترقيم FDI الدائم (11–48) — أرباع المريض كما يواجهها الطبيب. انقر سناً
          لعرض حالته وسجله.
        </p>

        <div className="space-y-1">
          <p className="text-center text-[11px] font-semibold text-gray-400">
            {QUADRANT_LABEL_AR[1]} / {QUADRANT_LABEL_AR[2]}
          </p>
          {renderRow(upperRowLeftToRight())}
          <div className="my-1 border-t border-dashed border-gray-300" />
          {renderRow(lowerRowLeftToRight())}
          <p className="text-center text-[11px] font-semibold text-gray-400">
            {QUADRANT_LABEL_AR[4]} / {QUADRANT_LABEL_AR[3]}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 border-t border-gray-100 pt-3">
          {TOOTH_STATUS_KEYS.map((key) => {
            const meta = TOOTH_STATUS_META[key];
            return (
              <span
                key={key}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${meta.chipClass}`}
              >
                <span className="font-bold">{meta.icon}</span>
                {meta.labelAr}
              </span>
            );
          })}
        </div>
      </div>

      {selected !== null && (
        <div className="rounded-2xl bg-white p-4 shadow-md">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-bold text-teal-800">
              السن {selected} — {toothNameAr(selected)}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedTooth(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              إغلاق
            </button>
          </div>

          {selectedLatest && (
            <p className="mt-1 text-xs text-gray-500">
              الحالة المسجلة حالياً:{" "}
              <span
                className={`rounded-full border px-2 py-0.5 font-semibold ${
                  toothStatusMeta(selectedLatest.status)?.chipClass ?? ""
                }`}
              >
                {toothStatusMeta(selectedLatest.status)?.icon}{" "}
                {toothStatusMeta(selectedLatest.status)?.labelAr}
              </span>{" "}
              ({findingKindLabel(selectedLatest.kind)})
            </p>
          )}

          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-gray-600">
              نوع القيد الجديد
            </p>
            <div className="flex gap-2">
              {(["EXISTING", "DIAGNOSIS"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setChosenKind(kind)}
                  className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                    chosenKind === kind
                      ? "border-teal-600 bg-teal-50 text-teal-800"
                      : "border-gray-300 bg-white text-gray-600"
                  }`}
                >
                  {findingKindLabel(kind)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-gray-600">
              الحالة الجديدة
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TOOTH_STATUS_KEYS.map((key) => {
                const meta = TOOTH_STATUS_META[key];
                const active = chosenStatus === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setChosenStatus(key)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                      active
                        ? "ring-2 ring-teal-600 ring-offset-1 " + meta.chipClass
                        : meta.chipClass + " opacity-70"
                    }`}
                  >
                    <span className="font-bold">{meta.icon}</span>
                    {meta.labelAr}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3">
            <label
              htmlFor={`finding-note-${selected}`}
              className="mb-1 block text-xs font-semibold text-gray-600"
            >
              ملاحظة (اختياري)
            </label>
            <input
              id={`finding-note-${selected}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              placeholder="مثال: تسوس سطح مضغي"
            />
          </div>

          {error && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={saveFinding}
            disabled={saving || !chosenStatus}
            className="mt-3 w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {saving ? "جارٍ الحفظ…" : "تسجيل المشاهدة"}
          </button>
          <p className="mt-1 text-[11px] text-gray-400">
            التسجيل يضيف قيداً جديداً — القيود السابقة لا تُمحى ولا تُستبدل.
          </p>

          {history.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="mb-2 text-xs font-semibold text-gray-600">
                سجل هذا السن ({history.length})
              </p>
              <ul className="space-y-1.5">
                {history
                  .slice()
                  .reverse()
                  .map((f) => {
                    const meta = toothStatusMeta(f.status);
                    return (
                      <li
                        key={f.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700"
                      >
                        <span
                          className={`rounded-full border px-2 py-0.5 font-semibold ${
                            meta?.chipClass ?? ""
                          }`}
                        >
                          {meta?.icon} {meta?.labelAr ?? f.status}
                        </span>
                        <span className="text-gray-500">
                          {findingKindLabel(f.kind)}
                        </span>
                        <span className="tabular-nums text-gray-400">
                          {formatDateAr(f.recordedAt)}
                        </span>
                        {f.note && <span className="text-gray-600">{f.note}</span>}
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
