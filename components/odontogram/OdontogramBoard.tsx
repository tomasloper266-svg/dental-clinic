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
import { toothAnatomy, type SurfaceKey } from "@/lib/odontogram/anatomy";
import ToothSvg from "@/components/odontogram/ToothSvg";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field, Input } from "@/components/ui/Field";
import { cn } from "@/components/ui/cn";

// لوحة الأودوغرام التفاعلية — السن يُنقر لفتح لوحة حالته وسجله الكامل.
// المشاهدات إلحاقية: كل حفظ يضيف قيداً جديداً بتاريخه ولا يستبدل السابق.
// الهوية البصرية: السن السليم بلا تلوين، والحالات اللافتة وحدها تحمل لوناً
// وأيقونة نصية — التمييز لا يعتمد على اللون وحده.

type Props = {
  patientId: string;
  initialFindings: FindingDto[];
  // الاختيار محكوم من الأب (OdontogramWorkbench) ليشاركه قسم خطة العلاج.
  selectedTooth: number | null;
  onSelectTooth: (fdi: number | null) => void;
};

function formatDateAr(iso: string): string {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function QuadrantLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-warm-400 py-1 text-center text-[11px] font-medium">
      {children}
    </p>
  );
}

export default function OdontogramBoard({
  patientId,
  initialFindings,
  selectedTooth,
  onSelectTooth,
}: Props) {
  const [findings, setFindings] = useState<FindingDto[]>(initialFindings);
  const [chosenStatus, setChosenStatus] = useState<string | null>(null);
  const [chosenKind, setChosenKind] = useState<"EXISTING" | "DIAGNOSIS">(
    "EXISTING",
  );
  const [surfaces, setSurfaces] = useState<SurfaceKey[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = useMemo(() => latestFindingByTooth(findings), [findings]);

  function selectTooth(fdi: number) {
    onSelectTooth(fdi);
    setError(null);
    setNote("");
    setSurfaces([]);
    const current = latest.get(fdi);
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
            surface: surfaces.length > 0 ? surfaces.join("+") : undefined,
            note: note || undefined,
          }),
        },
      );
      const data = (await res.json()) as {
        finding?: FindingDto;
        error?: string;
      };
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

  const selected = selectedTooth;
  const history = selected !== null ? findingsForTooth(findings, selected) : [];
  const selectedLatest = selected !== null ? latest.get(selected) : undefined;
  const selectedLatestMeta = selectedLatest
    ? toothStatusMeta(selectedLatest.status)
    : null;
  const selectedSurfaceOptions =
    selected !== null ? (toothAnatomy(selected)?.surfaces ?? []) : [];

  function renderRow(cells: ToothCell[]) {
    return (
      <div className="flex justify-center gap-0.5 overflow-x-auto py-1">
        {cells.map((cell) => {
          const current = latest.get(cell.fdi);
          const meta = current ? toothStatusMeta(current.status) : null;
          const anatomy = toothAnatomy(cell.fdi);
          return (
            <ToothSvg
              key={cell.fdi}
              tooth={anatomy as NonNullable<ReturnType<typeof toothAnatomy>>}
              meta={meta}
              selected={selected === cell.fdi}
              onSelect={selectTooth}
            />
          );
        })}
      </div>
    );
  }

  return (
    <section>
      <div className="rounded-panel border-warm-200 bg-surface-raised border p-4 sm:p-5">
        <h2 className="text-ink-900 text-base font-semibold">مخطط الأسنان</h2>
        <p className="text-warm-500 mt-1 text-xs">
          رسم تشريحي بالترقيم FDI الدائم (11–48) — أرباع المريض كما يواجهها
          الطبيب: قواطع وأنياب وضواحك وأضراس بأشكالها، التيجان تواجه خط الإطباق.
          انقر سناً لعرض حالته وسجله وتسجيل مشاهدة جديدة.
        </p>

        <div className="mt-4 space-y-1">
          <QuadrantLabel>
            {QUADRANT_LABEL_AR[1]} / {QUADRANT_LABEL_AR[2]}
          </QuadrantLabel>
          {renderRow(upperRowLeftToRight())}
          <div
            className="border-warm-300 my-2 border-t border-dashed"
            aria-hidden
          />
          {renderRow(lowerRowLeftToRight())}
          <QuadrantLabel>
            {QUADRANT_LABEL_AR[4]} / {QUADRANT_LABEL_AR[3]}
          </QuadrantLabel>
        </div>

        <div className="border-warm-200 mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1.5 border-t pt-3">
          {TOOTH_STATUS_KEYS.map((key) => {
            const meta = TOOTH_STATUS_META[key];
            return (
              <span
                key={key}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                  meta.chipClass,
                )}
              >
                <span className="font-bold">{meta.icon}</span>
                {meta.labelAr}
              </span>
            );
          })}
        </div>
      </div>

      {/* لوحة تفاصيل السن — جانبية للحفاظ على الأودوغرام مرئياً بجانبها */}
      <Drawer
        open={selected !== null}
        onClose={() => onSelectTooth(null)}
        title={
          selected !== null ? `السن ${selected} — ${toothNameAr(selected)}` : ""
        }
        className="max-w-md"
      >
        {selected !== null && (
          <div className="space-y-5">
            {selectedLatestMeta && selectedLatest && (
              <div className="flex items-center gap-2">
                <span className="text-warm-600 text-xs">
                  الحالة المسجلة حالياً:
                </span>
                <Badge className={cn("border", selectedLatestMeta.chipClass)}>
                  <span className="font-bold">{selectedLatestMeta.icon}</span>
                  {selectedLatestMeta.labelAr}
                </Badge>
                <span className="text-warm-500 text-xs">
                  {findingKindLabel(selectedLatest.kind)}
                </span>
              </div>
            )}

            <div>
              <p className="text-warm-600 mb-1.5 text-xs font-semibold">
                نوع القيد الجديد
              </p>
              <div className="flex gap-2" role="group" aria-label="نوع القيد">
                {(["EXISTING", "DIAGNOSIS"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={chosenKind === kind}
                    onClick={() => setChosenKind(kind)}
                    className={cn(
                      "rounded-field border px-3 py-1.5 text-xs font-medium transition-colors",
                      "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
                      chosenKind === kind
                        ? "border-primary-600 bg-primary-600 text-white"
                        : "border-warm-300 bg-surface-raised text-warm-600 hover:bg-surface-hover active:bg-surface-sunken",
                    )}
                  >
                    {findingKindLabel(kind)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-warm-600 mb-1.5 text-xs font-semibold">
                الحالة الجديدة
              </p>
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label="حالة السن"
              >
                {TOOTH_STATUS_KEYS.map((key) => {
                  const meta = TOOTH_STATUS_META[key];
                  const active = chosenStatus === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setChosenStatus(key)}
                      className={cn(
                        "rounded-field inline-flex items-center gap-1 border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
                        meta.chipClass,
                        active
                          ? "ring-primary-600 ring-2 ring-offset-1"
                          : "opacity-80 hover:opacity-100",
                      )}
                    >
                      <span className="font-bold">{meta.icon}</span>
                      {meta.labelAr}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedSurfaceOptions.length > 0 && (
              <div>
                <p className="text-warm-600 mb-1.5 text-xs font-semibold">
                  سطح السن (اختياري — يمكن اختيار أكثر من سطح)
                </p>
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="سطح السن"
                >
                  {selectedSurfaceOptions.map((surface) => {
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

            <Field
              label="ملاحظة (اختياري)"
              htmlFor={`finding-note-${selected}`}
            >
              <Input
                id={`finding-note-${selected}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="مثال: تسوس سطح مضغي"
              />
            </Field>

            {error && (
              <p
                role="alert"
                className="border-danger-300 bg-danger-50 text-danger-700 rounded-field border px-3 py-2 text-xs"
              >
                {error}
              </p>
            )}

            <div>
              <Button
                onClick={saveFinding}
                loading={saving}
                disabled={!chosenStatus}
                className="w-full sm:w-auto"
              >
                {saving ? "جارٍ الحفظ…" : "تسجيل المشاهدة"}
              </Button>
              <p className="text-warm-400 mt-1.5 text-[11px]">
                التسجيل يضيف قيداً جديداً — القيود السابقة لا تُمحى ولا تُستبدل.
              </p>
            </div>

            {history.length > 0 && (
              <div className="border-warm-200 border-t pt-4">
                <p className="text-warm-600 mb-2 text-xs font-semibold">
                  سجل هذا السن (
                  <span className="numeric">{history.length}</span>)
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
                          className="bg-surface text-warm-700 rounded-field flex flex-wrap items-center gap-2 px-3 py-2 text-xs"
                        >
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 font-semibold",
                              meta?.chipClass ?? "",
                            )}
                          >
                            {meta?.icon} {meta?.labelAr ?? f.status}
                          </span>
                          <span className="text-warm-500">
                            {findingKindLabel(f.kind)}
                          </span>
                          <span className="text-warm-400 numeric">
                            {formatDateAr(f.recordedAt)}
                          </span>
                          {f.surface && (
                            <span className="text-steel-600">
                              السطح: {f.surface}
                            </span>
                          )}
                          {f.note && <span className="w-full">{f.note}</span>}
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </section>
  );
}
