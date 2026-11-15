"use client";

import { useState } from "react";
import {
  TOOTH_STATUS_KEYS,
  TOOTH_STATUS_META,
  findingKindLabel,
  toothStatusMeta,
} from "@/lib/odontogram/statuses";
import { toothAnatomy, type SurfaceKey } from "@/lib/odontogram/anatomy";
import { formatSurfaceAr } from "@/lib/odontogram/surfaces";
import type { FindingDto } from "@/lib/services/findings";
import type { PeriodontalReadingDto } from "@/lib/services/periodontal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { MicButton } from "@/components/ui/MicButton";
import PeriodontalReadingForm from "@/components/odontogram/PeriodontalReadingForm";
import { cn } from "@/components/ui/cn";

// نموذج تسجيل حالة السن المشترك — كان المنطق مكرراً نصياً بين لوحتين
// (OdontogramBoard وToothRecordPanel) فاستُخرج إلى مكوّن واحد تستهلكه اللوحتان
// بحجتيهما. القيد إلحاقي عبر مسار findings: الحفظ يضيف مشاهدة ولا يستبدل سابقة.

type Props = {
  patientId: string;
  fdi: number;
  /** سجل هذا السن — للحالة الحالية أعلى النموذج وللسجل أسفله */
  history: FindingDto[];
  onSaved: (finding: FindingDto) => void;
  /** تهيئة الحالة المختارة من آخر قيد — لوحة الأودوغرام تفعل ذلك عند فتح السن */
  preselectLatest?: boolean;
  /** لون زر الحفظ — لوحة المخطط الوطني تستخدم الذهبية */
  saveVariant?: "primary" | "gold";
  /** تسمية قسم نوع القيد — اللوحتان أرسلتا نصين مختلفين قبل التوحيد */
  kindHeading?: string;
  /** معرّف حقل الملاحظة — يميّز حقل كل لوحة (ويُستخدم للإملاء) */
  noteInputId?: string;
  /** قراءات الدواعم للمريض — تمريرها مع onReadingSaved يفتح تبويب «الدواعم» */
  readings?: PeriodontalReadingDto[];
  /** حفظ قياس دواعم — غيابه يعني أن اللوحة لا تستهلك الدواعم بعد */
  onReadingSaved?: (reading: PeriodontalReadingDto) => void;
};

function formatDateAr(iso: string): string {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function ToothRecordForm({
  patientId,
  fdi,
  history,
  onSaved,
  preselectLatest = false,
  saveVariant = "primary",
  kindHeading = "نوع القيد",
  noteInputId,
  readings,
  onReadingSaved,
}: Props) {
  const latest = history.length ? history[history.length - 1] : null;
  const latestMeta = latest ? toothStatusMeta(latest.status) : null;

  const [chosenKind, setChosenKind] = useState<"EXISTING" | "DIAGNOSIS">(
    preselectLatest && latest ? "DIAGNOSIS" : "EXISTING",
  );
  const [chosenStatus, setChosenStatus] = useState<string | null>(
    preselectLatest ? (latest?.status ?? null) : null,
  );
  const [surfaces, setSurfaces] = useState<SurfaceKey[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // تبويب لوحة السن: الحالة العامة أو الدواعم — يظهر التبويبان حين تستهلك
  // اللوحة الدواعم (onReadingSaved)؛ وإلا يبقى نموذج الحالة كما هو.
  const [tab, setTab] = useState<"status" | "periodontal">("status");

  // أسطح السن من تشريحه حصراً — لا اختيار سطح غير تابع للنوع التشريحي.
  const surfaceOptions = toothAnatomy(fdi)?.surfaces ?? [];
  const resolvedNoteId = noteInputId ?? `finding-note-${fdi}`;

  async function save() {
    if (!chosenStatus) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/patients/${encodeURIComponent(patientId)}/findings`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            toothFdi: fdi,
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
      onSaved(data.finding as FindingDto);
      setNote("");
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {onReadingSaved && (
        <div
          className="border-warm-200 flex gap-2 border-b pb-2"
          role="tablist"
          aria-label="لوحة السن"
        >
          {(
            [
              ["status", "الحالة"],
              ["periodontal", "الدواعم"],
            ] as const
          ).map(([key, labelAr]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "rounded-field px-3 py-1.5 text-xs font-semibold transition-colors",
                "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
                tab === key
                  ? "bg-primary-600 text-white"
                  : "bg-surface-raised text-warm-600 hover:bg-surface-hover active:bg-surface-sunken",
              )}
            >
              {labelAr}
            </button>
          ))}
        </div>
      )}

      <div hidden={tab !== "status"} className="space-y-5">
        {latestMeta && latest && (
          <div className="flex items-center gap-2">
            <span className="text-warm-600 text-xs">الحالة المسجلة حالياً:</span>
            <Badge className={cn("border", latestMeta.chipClass)}>
              <span className="font-bold">{latestMeta.icon}</span>
              {latestMeta.labelAr}
            </Badge>
            <span className="text-warm-500 text-xs">
              {findingKindLabel(latest.kind)}
            </span>
          </div>
        )}

        <div>
          <p className="text-warm-600 mb-1.5 text-xs font-semibold">
            {kindHeading}
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

        {surfaceOptions.length > 0 && (
          <div>
            <p className="text-warm-600 mb-1.5 text-xs font-semibold">
              سطح السن (اختياري — يمكن اختيار أكثر من سطح)
            </p>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="سطح السن"
            >
              {surfaceOptions.map((surface) => {
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

        <Field label="ملاحظة (اختياري)" htmlFor={resolvedNoteId}>
          <div className="flex items-center gap-1.5">
            <Input
              id={resolvedNoteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="مثال: تسوس سطح مضغي"
            />
            <MicButton
              targetId={resolvedNoteId}
              value={note}
              onChange={setNote}
            />
          </div>
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
            variant={saveVariant}
            onClick={save}
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
              سجل هذا السن (<span className="numeric">{history.length}</span>)
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
                          السطح: {formatSurfaceAr(f.surface)}
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

      {onReadingSaved && (
        <div
          hidden={tab !== "periodontal"}
          role="tabpanel"
          className="space-y-4"
        >
          <PeriodontalReadingForm
            patientId={patientId}
            fdi={fdi}
            readings={readings ?? []}
            onSaved={onReadingSaved}
            saveVariant={saveVariant}
          />
        </div>
      )}
    </div>
  );
}
